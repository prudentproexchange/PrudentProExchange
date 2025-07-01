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

    // Validate user_id (assuming UUID format) and token
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!user_id || !uuidRegex.test(user_id) || !/^\d{6}$/.test(token)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ ok: false, error: 'Invalid user_id or token format' })
      };
    }

    // Fetch user's Base32 secret from Supabase
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('two_fa_secret')
      .eq('id', user_id)
      .single();

    if (error || !profile?.two_fa_secret) {
      console.error('Supabase error or no secret found:', error?.message || 'No secret');
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
