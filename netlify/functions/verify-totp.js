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
    console.log('🔑 Incoming verify-totp:', { user_id, token });

    // Fetch the stored secret
    const { data: profile, error: dbError } = await supabase
      .from('profiles')
      .select('two_fa_secret')
      .eq('id', user_id)
      .maybeSingle();

    if (dbError) {
      console.error('❌ DB error:', dbError);
      return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Database error' }) };
    }
    if (!profile || !profile.two_fa_secret) {
      console.warn('⚠️  No secret for user:', user_id);
      return { statusCode: 200, body: JSON.stringify({ ok: false, error: 'No secret found' }) };
    }

    // **DEBUG LOG** the secret you fetched
    console.log('🔒 Stored secret is:', profile.two_fa_secret);

    // Now verify
    const valid = authenticator.verify({ token, secret: profile.two_fa_secret });
    console.log(`📊 Verification result for token ${token}:`, valid);

    // **For debugging only**: echo back the secret and token you checked
    // Remove this `debug` field when you’re done diagnosing
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: valid, debug: { secret: profile.two_fa_secret, token } })
    };
  } catch (err) {
    console.error('🔥 Unexpected error in verify-totp:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Internal server error' }) };
  }
};
