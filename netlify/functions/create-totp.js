// netlify/functions/create-totp.js
const { createClient } = require('@supabase/supabase-js');
const { authenticator } = require('otplib');

// initialize Supabase with service-role key
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// configure otplib for TOTP defaults
authenticator.options = {
  digits: 6,
  step: 30,
  algorithm: 'sha1'
};

exports.handler = async (event) => {
  console.log('📝 create-totp invoked:', event.httpMethod, 'body=', event.body);
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed, use POST' }) };
    }
    if (!event.body) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No request body provided' }) };
    }

    const { user_id } = JSON.parse(event.body);
    console.log('🆔 Parsed user_id:', user_id);
    if (!user_id) {
      return { statusCode: 400, body: JSON.stringify({ error: 'user_id required' }) };
    }

    // 1) generate a NEW Base32 secret
    const secret = authenticator.generateSecret();

    // 2) build the OTPAuth URI
    const otpAuth = authenticator.keyuri(
      user_id,                // account name
      'PrudentProExchange',   // issuer
      secret
    );

    // 3) upsert into your dedicated user_2fa table
    const { error: upsertErr } = await supabase
      .from('user_2fa')
      .upsert({
        user_id,
        secret,
        enabled: false,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (upsertErr) {
      console.error('Supabase upsert error:', upsertErr);
      return { statusCode: 500, body: JSON.stringify({ error: 'Database error updating 2FA record' }) };
    }

    // 4) return secret + QR-code URL
    const qr_code_url =
      `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(otpAuth)}&size=200x200`;

    console.log('✅ create-totp success:', { secret, qr_code_url });
    return { statusCode: 200, body: JSON.stringify({ secret, qr_code_url }) };
  } catch (err) {
    console.error('❌ create-totp exception:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
