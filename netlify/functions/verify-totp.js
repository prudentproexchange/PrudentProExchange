// netlify/functions/verify-totp.js

const { createClient } = require('@supabase/supabase-js');
const { authenticator } = require('otplib');

// Initialize Supabase with your service‐role key
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
    console.log('verify-totp called with body:', event.body);

    // 1) Only POST allowed
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
    }

    // 2) Must have a request body
    if (!event.body) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'No request body provided' }) };
    }

    // 3) Parse & validate
    const { user_id, token } = JSON.parse(event.body);
    const uuidRe  = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const tokenRe = /^\d{6}$/;
    if (!uuidRe.test(user_id) || !tokenRe.test(token)) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Invalid user_id or token format' }) };
    }

    // 4) Fetch the secret (zero or multiple rows → profile = null)
    const { data: profile, error: dbError } = await supabase
      .from('profiles')
      .select('two_fa_secret')
      .eq('id', user_id)
      .maybeSingle();

    if (dbError) {
      console.error('DB error fetching 2FA secret:', dbError);
      return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Database error' }) };
    }
    if (!profile || !profile.two_fa_secret) {
      console.warn(`No 2FA secret found for user ${user_id}`);
      return { statusCode: 200, body: JSON.stringify({ ok: false, error: 'No 2FA secret found; please re-enable 2FA.' }) };
    }

    // 5) Verify the TOTP code
    const valid = authenticator.verify({ token, secret: profile.two_fa_secret });
    return { statusCode: 200, body: JSON.stringify({ ok: valid }) };

  } catch (err) {
    console.error('Unhandled error in verify-totp:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Internal server error' }) };
  }
};
