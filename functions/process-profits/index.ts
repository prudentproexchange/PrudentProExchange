import { serve } from 'std/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = Deno.env.get('https://iwkdznjqfbsfkscnbrkc.supabase.co')!
const supabaseKey = Deno.env.get('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3a2R6bmpxZmJzZmtzY25icmtjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDYyOTY4OCwiZXhwIjoyMDY2MjA1Njg4fQ.HPkLtB4-tf6R_4HtyhJVJ1iixIMAY_FVUDqjhHKymRw')!
const supabase = createClient(supabaseUrl, supabaseKey)

serve(async (req) => {
  try {
    const { data: investments, error } = await supabase
      .from('investments')
      .select('id, user_id, total_profit, end_time')
      .eq('status', 'profit_ready')
      .lte('end_time', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())

    if (error) throw error

    for (const inv of investments) {
      await supabase.rpc('transfer_profit_to_account', {
        user_uuid: inv.user_id,
        invest_id: inv.id,
        profit_amount: inv.total_profit,
      })
    }

    return new Response(`Processed ${investments.length} investments`, { status: 200 })
  } catch (err) {
    return new Response('Error: ' + err.message, { status: 500 })
  }
})
