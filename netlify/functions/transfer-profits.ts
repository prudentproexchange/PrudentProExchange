// netlify/functions/transfer-profits.ts

import { serve } from 'std/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables')
}

const supabase = createClient(supabaseUrl, supabaseKey)

serve(async (req) => {
  try {
    // Fetch all investments with status = 'profit_ready'
    const { data: investments, error } = await supabase
      .from('investments')
      .select('id, user_id, total_profit, end_time')
      .eq('status', 'profit_ready')

    if (error) throw error
    if (!investments) return new Response('No investments found', { status: 200 })

    const now = Date.now()
    const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000

    // Filter investments where end_time + 14 days <= now
    const readyToProcess = investments.filter(inv => {
      const endTimeMs = new Date(inv.end_time).getTime()
      return endTimeMs + fourteenDaysMs <= now
    })

    // Process each eligible investment
    for (const inv of readyToProcess) {
      const { error: rpcError } = await supabase.rpc('transfer_profit_to_account', {
        user_uuid: inv.user_id,
        invest_id: inv.id,
        profit_amount: inv.total_profit,
      })

      if (rpcError) {
        console.error(`RPC error on investment ${inv.id}:`, rpcError.message)
        // Optionally decide to continue or fail immediately
        // return new Response(`RPC error: ${rpcError.message}`, { status: 500 })
      }
    }

    return new Response(`Processed ${readyToProcess.length} investments`, { status: 200 })
  } catch (err) {
    console.error('Function error:', err)
    return new Response('Error: ' + (err instanceof Error ? err.message : String(err)), { status: 500 })
  }
})
