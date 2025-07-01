// js/2fa.js

// 1. Init Supabase client (v1 or v2 both work for RPC)
const { createClient } = supabase;
const supabaseClient = createClient(
  'https://iwkdznjqfbsfkscnbrkc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3a2R6bmpxZmJzZmtzY25icmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2Mjk2ODgsImV4cCI6MjA2NjIwNTY4OH0.eRiXpUKP0zAMI9brPHFMxdSwZITGHxu8BPRQprkAbiU'
);

let userId;

// 2. Page init
async function init2FAPage() {
  console.log('▶️ init2FAPage');
  AOS.init({ duration: 800, once: true });

  // 2.1 get current user
  const { data: { user }, error: authErr } = await supabaseClient.auth.getUser();
  console.log('getUser →', user, authErr);
  if (authErr || !user) return window.location.href = 'login.html';
  userId = user.id;

  // 2.2 fetch profile
  const { data: profile, error: profileErr } = await supabaseClient
    .from('profiles')
    .select('first_name, photo_url, two_fa_enabled')
    .eq('id', userId)
    .single();
  console.log('profile →', profile, profileErr);
  if (profileErr) return showError('Error loading profile: ' + profileErr.message);

  // 2.3 update UI
  document.getElementById('welcomeName').textContent = profile.first_name || 'User';
  if (profile.photo_url) {
    const { data: urlData } = supabaseClient.storage
      .from('profile-photos')
      .getPublicUrl(profile.photo_url);
    document.getElementById('navProfilePhoto').src = urlData.publicUrl;
    document.getElementById('navProfilePhoto').style.display = 'block';
    document.getElementById('defaultProfileIcon').style.display = 'none';
  }

  const enabled = profile.two_fa_enabled;
  document.getElementById('twofa-status').textContent = enabled
    ? '2FA is currently enabled.'
    : '2FA is currently disabled.';
  document.getElementById('enable-2fa-section').style.display = enabled ? 'none' : 'block';
  document.getElementById('disable-2fa-section').style.display = enabled ? 'block' : 'none';

  // 2.4 if disabled, fetch secret via RPC
  if (!enabled) await fetchTotpSecret();

  setupEventListeners();
}

// 3. Fetch TOTP secret via your SQL function
async function fetchTotpSecret() {
  console.log('▶️ fetchTotpSecret');
  const { data, error } = await supabaseClient.rpc('create_totp_secret', {
    _user_id: userId       // match your PG signature
  });
  console.log('create_totp_secret →', data, error);
  if (error) return showError('Error fetching secret: ' + error.message);
  if (!data?.secret || !data?.qr_code_url) {
    return showError('Unexpected server response—see console.');
  }

  document.getElementById('qrcode').src = data.qr_code_url;
  document.getElementById('qrcode').style.display = 'block';
  document.getElementById('secret').textContent = data.secret;
}

// 4. Wire up buttons
function setupEventListeners() {
  // copy secret
  document.getElementById('copy-secret-btn').addEventListener('click', () => {
    const secret = document.getElementById('secret').textContent;
    navigator.clipboard.writeText(secret).then(() => {
      const btn = document.getElementById('copy-secret-btn');
      btn.innerHTML = '<i class="fas fa-check"></i>';
      setTimeout(() => btn.innerHTML = '<i class="fas fa-copy"></i>', 2000);
    });
  });

  // verify + enable
  document.getElementById('verify-enable-btn').addEventListener('click', async () => {
    const token = document.getElementById('totp-code-enable').value.trim();
    if (!/^\d{6}$/.test(token)) return showError('Enter a valid 6-digit code.');
    const { data, error } = await supabaseClient.rpc('verify_and_enable_totp', {
      user_id: userId,     // your PG signature uses “user_id” here
      token
    });
    console.log('verify_and_enable_totp →', data, error);
    if (error) return showError('Invalid code: ' + error.message);
    alert('2FA enabled!');
    window.location.reload();
  });

  // verify + disable
  document.getElementById('verify-disable-btn').addEventListener('click', async () => {
    const token = document.getElementById('totp-code-disable').value.trim();
    if (!/^\d{6}$/.test(token)) return showError('Enter a valid 6-digit code.');
    const { data, error } = await supabaseClient.rpc('disable_totp', {
      user_id: userId,
      token
    });
    console.log('disable_totp →', data, error);
    if (error) return showError('Invalid code: ' + error.message);
    alert('2FA disabled!');
    window.location.reload();
  });

  // …hamburger, theme, logout, back-to-top, time updates (copy from your old script)…
}

// show error
function showError(msg) {
  const e = document.getElementById('error-message');
  e.textContent = msg;
  e.style.display = 'block';
  setTimeout(() => e.style.display = 'none', 5000);
}

// kickoff
init2FAPage();
