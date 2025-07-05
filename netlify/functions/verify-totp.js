// netlify/functions/verify-totp.js

const { createClient } = require('@supabase/supabase-js');
const { authenticator } = require('otplib');

// Initialize Supabase with the service‐role key
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// TOTP defaults: 6 digits, 30-second window, SHA-1
authenticator.options = {
  digits: 6,
  step: 30,
  algorithm: 'sha1'
};

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
    }
    if (!event.body) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'No request body' }) };
    }

    const { user_id, token } = JSON.parse(event.body);

    // Fetch the stored secret from user_2fa
    const { data, error: dbError } = await supabase
      .from('user_2fa')
      .select('secret')
      .eq('user_id', user_id)
      .maybeSingle();

    if (dbError) {
      console.error('DB error fetching 2FA secret:', dbError);
      return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Database error' }) };
    }
    if (!data || !data.secret) {
      console.warn('No 2FA secret found for user:', user_id);
      return { statusCode: 200, body: JSON.stringify({ ok: false, error: 'No secret found; please enable 2FA first.' }) };
    }

    // Verify the TOTP code
    const valid = authenticator.verify({ token, secret: data.secret });
    return { statusCode: 200, body: JSON.stringify({ ok: valid }) };

  } catch (err) {
    console.error('Unexpected error in verify-totp:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Internal server error' }) };
  }
};
