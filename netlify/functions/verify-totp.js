// netlify/functions/verify-totp.js
const { createClient } = require('@supabase/supabase-js')
const { authenticator }   = require('otplib')

// initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // use a service role key
)

exports.handler = async (event) => {
  try {
    const { user_id, token } = JSON.parse(event.body)
    if (!user_id || !/^\d{6}$/.test(token)) {
      return { statusCode: 400, body: JSON.stringify({ ok: false }) }
    }

    // fetch that user's secret
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('two_fa_secret')
      .eq('id', user_id)
      .single()

    if (error || !profile?.two_fa_secret) {
      return { statusCode: 200, body: JSON.stringify({ ok: false }) }
    }

    // verify the code
    const valid = authenticator.check(profile.two_fa_secret, token)
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: !!valid })
    }

  } catch (err) {
    console.error(err)
    return { statusCode: 500, body: JSON.stringify({ ok: false }) }
  }
}
