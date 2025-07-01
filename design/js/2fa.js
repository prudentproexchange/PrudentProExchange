// js/2fa.js

const { createClient } = supabase;
const supabaseClient = createClient(
  'https://iwkdznjqfbsfkscnbrkc.supabase.co',
  'YOUR_ANON_KEY'
);

let userId;

async function init2FAPage() {
  AOS.init({ duration: 800, once: true });

  // 1) Auth
  const { data: { user }, error: authErr } = await supabaseClient.auth.getUser();
  if (authErr || !user) return window.location.href = 'login.html';
  userId = user.id;

  // 2) Profile
  const { data: profile, error: profileErr } = await supabaseClient
    .from('profiles').select('first_name, photo_url, two_fa_enabled')
    .eq('id', userId).single();
  if (profileErr) return showError('Error loading profile: ' + profileErr.message);

  document.getElementById('welcomeName').textContent = profile.first_name || 'User';
  document.getElementById('twofa-status').textContent = profile.two_fa_enabled
    ? '2FA is currently enabled.' : '2FA is currently disabled.';
  document.getElementById('enable-2fa-section').style.display = profile.two_fa_enabled ? 'none' : 'block';
  document.getElementById('disable-2fa-section').style.display = profile.two_fa_enabled ? 'block' : 'none';

  if (!profile.two_fa_enabled) await fetchTotpSecret();

  setupEventListeners();
}

async function fetchTotpSecret() {
  console.log('▶️ fetchTotpSecret – trying {_user_id}');
  let resp = await supabaseClient.rpc('create_totp_secret', { _user_id: userId });
  console.log('create_totp_secret(_user_id) →', resp);

  if ((!resp.data || !resp.data.secret) && !resp.error) {
    console.log('▶️ No data with `_user_id`, retrying with {user_id}`');
    resp = await supabaseClient.rpc('create_totp_secret', { user_id: userId });
    console.log('create_totp_secret(user_id) →', resp);
  }

  const { data, error } = resp;
  if (error) return showError('Error fetching 2FA secret: ' + error.message);
  if (!data || !data.secret || !data.qr_code_url) {
    console.error('❗️ RPC returned different shape:', data);
    return showError('Unexpected response from create_totp_secret. Check console for fields.');
  }

  document.getElementById('qrcode').src = data.qr_code_url;
  document.getElementById('qrcode').style.display = 'block';
  document.getElementById('secret').textContent = data.secret;
}

function setupEventListeners() {
  document.getElementById('copy-secret-btn').addEventListener('click', () => {
    const secret = document.getElementById('secret').textContent;
    navigator.clipboard.writeText(secret);
  });

  document.getElementById('verify-enable-btn').addEventListener('click', async () => {
    const token = document.getElementById('totp-code-enable').value.trim();
    const { data, error } = await supabaseClient.rpc('verify_and_enable_totp', {
      user_id: userId,
      token
    });
    console.log('verify_and_enable_totp →', { data, error });
    if (error) return showError('Invalid code: ' + error.message);
    alert('2FA enabled!');
    window.location.reload();
  });

  document.getElementById('verify-disable-btn').addEventListener('click', async () => {
    const token = document.getElementById('totp-code-disable').value.trim();
    const { data, error } = await supabaseClient.rpc('disable_totp', { user_id: userId, token });
    console.log('disable_totp →', { data, error });
    if (error) return showError('Invalid code: ' + error.message);
    alert('2FA disabled!');
    window.location.reload();
  });

  // ... copy your menu, theme, logout, time logic here ...
}

function showError(msg) {
  const e = document.getElementById('error-message');
  e.textContent = msg;
  e.style.display = 'block';
  setTimeout(() => e.style.display = 'none', 5000);
}

init2FAPage();
