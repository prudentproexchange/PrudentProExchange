// netlify/functions/verify-totp.js

import { createClient } from '@supabase/supabase-js';
import { authenticator } from 'otplib';

// Initialize Supabase with the service-role key
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// TOTP defaults
authenticator.options = {
  digits: 6,
  step: 30,
  algorithm: 'sha1',
};

export default async function handler(event) {
  try {
    if (event.method !== 'POST') {
      return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await event.json();
    const { user_id, token } = body;

    // Fetch the stored secret from Supabase
    const { data, error: dbError } = await supabase
      .from('user_2fa')
      .select('secret')
      .eq('user_id', user_id)
      .maybeSingle();

    if (dbError) {
      console.error('DB error fetching 2FA secret:', dbError);
      return new Response(JSON.stringify({ ok: false, error: 'Database error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!data || !data.secret) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'No secret found; please enable 2FA first.',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const valid = authenticator.verify({ token, secret: data.secret });

    return new Response(JSON.stringify({ ok: valid }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Unexpected error in verify-totp:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
