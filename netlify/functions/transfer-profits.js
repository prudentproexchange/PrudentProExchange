import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
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
        profit_amount: inv.total_profit
      })
    }

    return res.status(200).json({ message: `Processed ${investments.length} investments` })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
