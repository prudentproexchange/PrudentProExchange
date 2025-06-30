import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function handler() {
  try {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
    const { data: investments, error } = await supabase
      .from('investments')
      .select('id, user_id, total_profit, end_time')
      .eq('status', 'profit_ready')
      .lte('end_time', fourteenDaysAgo)

    if (error) throw error

    let count = 0
    for (const inv of investments) {
      const { error: rpcError } = await supabase.rpc('transfer_profit_to_account', {
        user_uuid: inv.user_id,
        invest_id: inv.id,
        profit_amount: inv.total_profit,
      })
      if (rpcError) throw rpcError
      count++
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Processed ${count} investments.` })
    }
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    }
  }
}
