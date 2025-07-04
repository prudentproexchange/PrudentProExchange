const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

exports.handler = async (event) => {
  const supabase = createClient(
    'https://iwkdznjqfbsfkscnbrkc.supabase.co',
    process.env.SUPABASE_KEY
  );

  try {
    const { user_id, pin } = JSON.parse(event.body);
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('withdrawal_pin')
      .eq('id', user_id)
      .single();
    if (error) throw error;
    if (!profile.withdrawal_pin) throw new Error('No PIN set');

    const isValid = await bcrypt.compare(pin, profile.withdrawal_pin);
    if (!isValid) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Invalid PIN' }) };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: error.message }) };
  }
};
