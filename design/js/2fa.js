// js/2fa.js

// 1) Init Supabase client (anon key), explicitly enabling session persistence
const supabaseClient = supabase.createClient(
  'https://iwkdznjqfbsfkscnbrkc.supabase.co',
  '<YOUR_ANON_KEY>',
  {
    auth: {
      persistSession: true,
      detectSessionInUrl: false
    }
  }
);

let userId;

// 2) Page init
async function init2FAPage() {
  AOS.init({ duration: 800, once: true });

  // --- WAIT FOR SESSION TO BE RESTORED ---
  // This avoids a race where your code runs before the stored session
  const { data: { session }, error: sessionErr } = await supabaseClient.auth.getSession();
  if (sessionErr || !session) {
    // no session found → back to login
    return window.location.replace('login.html');
  }
  userId = session.user.id;

  // --- LOAD PROFILE + 2FA STATE ---
  const [ { data: profile, error: profErr }, { data: twofa, error: twofaErr } ] =
    await Promise.all([
      supabaseClient
        .from('profiles')
        .select('first_name, photo_url')
        .eq('id', userId)
        .single(),
      supabaseClient
        .from('user_2fa')
        .select('secret, enabled')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

  if (profErr)   return showError('Error loading profile: ' + profErr.message);
  if (twofaErr)  return showError('Error loading 2FA status: ' + twofaErr.message);

  // --- RENDER UI ---
  document.getElementById('welcomeName').textContent = profile.first_name || 'User';
  if (profile.photo_url) {
    const { data: urlData } = supabaseClient
      .storage.from('profile-photos')
      .getPublicUrl(profile.photo_url);
    document.getElementById('navProfilePhoto').src = urlData.publicUrl;
    document.getElementById('navProfilePhoto').style.display = 'block';
    document.getElementById('defaultProfileIcon').style.display = 'none';
  }

  const enabled = twofa?.enabled === true;
  document.getElementById('twofa-status').textContent = enabled
    ? '2FA is currently enabled.'
    : '2FA is currently disabled.';
  document.getElementById('enable-2fa-section').style.display  = enabled ? 'none' : 'block';
  document.getElementById('disable-2fa-section').style.display = enabled ? 'block' : 'none';

  // Ensure we show a QR/secret if we don’t already have one
  if (!twofa?.secret) {
    await generateTotpSecret();
  } else {
    document.getElementById('qrcode').src       = twofa.qr_code_url || '';
    document.getElementById('qrcode').style.display = 'block';
    document.getElementById('secret').textContent  = twofa.secret;
  }

  setupEventListeners();
}

// 3) Call create-totp (unchanged)
async function generateTotpSecret() { /* … */ }

// 4) Wire up your buttons (unchanged)…

// HELPER: showError, setupEventListeners, etc.

document.addEventListener('DOMContentLoaded', init2FAPage);
