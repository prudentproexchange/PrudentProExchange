// js/2fa.js

// 1) Init Supabase client (anon key)
const supabaseClient = supabase.createClient(
  'https://iwkdznjqfbsfkscnbrkc.supabase.co',
  '<YOUR_ANON_KEY>'
);

let userId;

// 2) Page init
async function init2FAPage() {
  AOS.init({ duration: 800, once: true });

  // 2.1 Get current user
  const { data: authData, error: authErr } = await supabaseClient.auth.getUser();
  if (authErr || !authData.user) {
    return window.location.replace('login.html');
  }
  userId = authData.user.id;

  // 2.2 Fetch profile info + 2FA row
  const [ profileResp, twofaResp ] = await Promise.all([
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

  if (profileResp.error) {
    return showError('Error loading profile: ' + profileResp.error.message);
  }
  if (twofaResp.error) {
    return showError('Error loading 2FA status: ' + twofaResp.error.message);
  }

  const profile = profileResp.data;
  const twofa   = twofaResp.data || { secret: null, enabled: false };

  // 2.3 Update UI
  document.getElementById('welcomeName').textContent = profile.first_name || 'User';
  if (profile.photo_url) {
    const { data: urlData } = supabaseClient
      .storage.from('profile-photos')
      .getPublicUrl(profile.photo_url);
    document.getElementById('navProfilePhoto').src = urlData.publicUrl;
    document.getElementById('navProfilePhoto').style.display = 'block';
    document.getElementById('defaultProfileIcon').style.display = 'none';
  }

  const enabled = twofa.enabled === true;
  document.getElementById('twofa-status').textContent = enabled
    ? '2FA is currently enabled.'
    : '2FA is currently disabled.';
  document.getElementById('enable-2fa-section').style.display = enabled ? 'none' : 'block';
  document.getElementById('disable-2fa-section').style.display = enabled ? 'block' : 'none';

  // 2.4 If no secret, generate + store one
  if (!twofa.secret) {
    await generateTotpSecret();
  } else {
    // if secret already exists but not yet shown (e.g. page reload), display it
    document.getElementById('qrcode').src = twofa.qr_code_url || '';
    document.getElementById('qrcode').style.display = 'block';
    document.getElementById('secret').textContent = twofa.secret;
  }

  setupEventListeners();
}

// 3) Call create-totp Netlify function
async function generateTotpSecret() {
  try {
    const res = await fetch('/.netlify/functions/create-totp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { secret, qr_code_url } = await res.json();

    // Inject into UI
    const img = document.getElementById('qrcode');
    img.src = qr_code_url;
    img.style.display = 'block';
    document.getElementById('secret').textContent = secret;
  } catch (e) {
    showError('Error generating TOTP secret: ' + e.message);
  }
}

// 4) Wire up buttons (unchanged)…
function setupEventListeners() {
  // … your copy, verify+enable, verify+disable code here …
}

// Helper
function showError(msg) {
  const el = document.getElementById('error-message');
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 5000);
}

// Kick it off
document.addEventListener('DOMContentLoaded', init2FAPage);
