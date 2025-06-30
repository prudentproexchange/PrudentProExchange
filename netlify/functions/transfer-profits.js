const { handler } = require('@netlify/functions');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async function () {
  try {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const { data: investments, error } = await supabase
      .from('investments')
      .select('id, user_id, total_profit')
      .eq('status', 'profit_ready')
      .lte('end_time', fourteenDaysAgo);

    if (error) throw error;

    for (const inv of investments) {
      await supabase.rpc('transfer_profit_to_account', {
        user_uuid: inv.user_id,
        invest_id: inv.id,
        profit_amount: inv.total_profit,
      });
    }

    return {
      statusCode: 200,
      body: `Processed ${investments.length} investments.`,
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: 'Error: ' + err.message,
    };
  }
};
