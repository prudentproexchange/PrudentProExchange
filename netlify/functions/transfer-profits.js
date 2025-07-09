import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler() {
  try {
    const now = new Date().toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    // Step 1: Mark active investments as 'profit_ready' when end_time is reached
    const { data: activeInvestments, error: activeError } = await supabase
      .from('investments')
      .select('id')
      .eq('status', 'active')
      .lte('end_time', now);
    if (activeError) throw activeError;
    for (const inv of activeInvestments) {
      await supabase
        .from('investments')
        .update({ status: 'profit_ready' })
        .eq('id', inv.id);
    }

    // Step 2: Transfer profits after 7 days
    const { data: profitReadyInvestments, error: profitError } = await supabase
      .from('investments')
      .select('id, user_id, total_profit, end_time')
      .eq('status', 'profit_ready')
      .lte('end_time', sevenDaysAgo);
    if (profitError) throw profitError;
    let profitCount = 0;
    for (const inv of profitReadyInvestments) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ interest_wallet: supabase.raw('interest_wallet + ?', [inv.total_profit]) })
        .eq('id', inv.user_id);
      if (profileError) throw profileError;
      await supabase
        .from('transactions')
        .insert({
          user_id: inv.user_id,
          type: 'profit',
          amount: inv.total_profit,
          status: 'completed',
          created_at: new Date().toISOString()
        });
      await supabase
        .from('investments')
        .update({ status: 'profit_transferred' })
        .eq('id', inv.id);
      profitCount++;
    }

    // Step 3: Transfer capital after 14 days
    const { data: profitTransferredInvestments, error: capitalError } = await supabase
      .from('investments')
      .select('id, user_id, principal, end_time')
      .eq('status', 'profit_transferred')
      .lte('end_time', fourteenDaysAgo);
    if (capitalError) throw capitalError;
    let capitalCount = 0;
    for (const inv of profitTransferredInvestments) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ interest_wallet: supabase.raw('interest_wallet + ?', [inv.principal]) })
        .eq('id', inv.user_id);
      if (profileError) throw profileError;
      await supabase
        .from('transactions')
        .insert({
          user_id: inv.user_id,
          type: 'capital',
          amount: inv.principal,
          status: 'completed',
          created_at: new Date().toISOString()
        });
      await supabase
        .from('investments')
        .update({ status: 'completed' })
        .eq('id', inv.id);
      capitalCount++;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: `Processed ${profitCount} profit transfers and ${capitalCount} capital transfers.` 
      })
    };
  } catch (err) {
    console.error('Error in Netlify function:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
}
