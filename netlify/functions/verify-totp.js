// netlify/functions/verify-totp.js

const { createClient } = require('@supabase/supabase-js');
const { authenticator } = require('otplib');

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configure otplib for TOTP defaults
authenticator.options = {
  digits: 6,
  step: 30,
  algorithm: 'sha1'
};

exports.handler = async (event) => {
  try {
    console.log('verify-totp called with body:', event.body);

    // Validate environment variables
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing Supabase environment variables');
      return {
        statusCode: 500,
        body: JSON.stringify({ ok: false, error: 'Server configuration error' })
      };
    }

    // Check HTTP method
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ ok: false, error: 'Method not allowed' })
      };
    }

    // Check if event.body exists and is not empty
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ ok: false, error: 'No request body provided' })
      };
    }

    // Parse and validate input
    let { user_id, token } = JSON.parse(event.body);
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!user_id || !uuidRegex.test(user_id) || !/^\d{6}$/.test(token)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ ok: false, error: 'Invalid user_id or token format' })
      };
    }

    // Fetch user's Base32 secret from Supabase
    const { data: profile, error: dbError } = await supabase
      .from('profiles')
      .select('two_fa_secret')
      .eq('id', user_id)
      .maybeSingle();    // <-- use maybeSingle()

    if (dbError) {
      console.error('DB error fetching secret:', dbError);
      return {
        statusCode: 500,
        body: JSON.stringify({ ok: false, error: 'Database error' })
      };
    }
    if (!profile || !profile.two_fa_secret) {
      console.warn('No 2FA secret found for user:', user_id);
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: false, error: 'No secret found for user' })
      };
    }

    // Verify the TOTP code
    const valid = authenticator.verify({ token, secret: profile.two_fa_secret });
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: valid })
    };
  } catch (err) {
    console.error('Error in verify-totp:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: 'Internal server error' })
    };
  }
};
