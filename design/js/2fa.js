// js/2fa.js

// Initialize Supabase client
const { createClient } = supabase;
const supabaseClient = createClient(
  'https://iwkdznjqfbsfkscnbrkc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.…eRiXpUKP0zAMI9brPHFMxdSwZITGHxu8BPRQprkAbiU'
);

let userId;

async function init2FAPage() {
  AOS.init({ duration: 800, once: true });

  // **1) Auth check** – if this fails you get redirected; otherwise session stays alive
  const { data: { user }, error: authErr } = await supabaseClient.auth.getUser();
  if (authErr || !user) {
    return window.location.href = 'login.html';
  }
  userId = user.id;

  // **2) Load profile**
  const { data: profile, error: profileErr } = await supabaseClient
    .from('profiles')
    .select('first_name, photo_url, two_fa_enabled')
    .eq('id', userId)
    .single();
  if (profileErr) {
    console.error('Profile error', profileErr);
    return showError('Error loading profile: ' + profileErr.message);
  }

  // **3) Populate UI**
  document.getElementById('welcomeName').textContent = profile.first_name || 'User';
  if (profile.photo_url) {
    const { data: urlData } = supabaseClient.storage
      .from('profile-photos')
      .getPublicUrl(profile.photo_url);
    document.getElementById('navProfilePhoto').src = urlData.publicUrl;
    document.getElementById('navProfilePhoto').style.display = 'block';
    document.getElementById('defaultProfileIcon').style.display = 'none';
  }

  const twoFaEnabled = profile.two_fa_enabled;
  document.getElementById('twofa-status').textContent = twoFaEnabled
    ? '2FA is currently enabled.'
    : '2FA is currently disabled.';

  document.getElementById('enable-2fa-section').style.display = twoFaEnabled ? 'none' : 'block';
  document.getElementById('disable-2fa-section').style.display = twoFaEnabled ? 'block' : 'none';

  if (!twoFaEnabled) {
    await fetchTotpSecret();    // safe Netlify call, won’t log you out
  }

  setupEventListeners();
}

async function fetchTotpSecret() {
  const res = await fetch('/.netlify/functions/create-totp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId }),
  });

  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).error || msg } catch {}
    return showError('Error fetching TOTP: ' + msg);
  }

  const { secret, qr_code_url } = await res.json();
  document.getElementById('qrcode').src = qr_code_url;
  document.getElementById('qrcode').style.display = 'block';
  document.getElementById('secret').textContent = secret;
}

function setupEventListeners() {
  document.getElementById('copy-secret-btn').addEventListener('click', () => {
    const sec = document.getElementById('secret').textContent;
    navigator.clipboard.writeText(sec).then(() => {
      const btn = document.getElementById('copy-secret-btn');
      btn.innerHTML = '<i class="fas fa-check"></i>';
      setTimeout(() => btn.innerHTML = '<i class="fas fa-copy"></i>', 2000);
    });
  });

  document.getElementById('verify-enable-btn').addEventListener('click', async () => {
    const token = document.getElementById('totp-code-enable').value.trim();
    if (!/^\d{6}$/.test(token)) return showError('Enter a valid 6-digit code.');

    const { error } = await supabaseClient.rpc('verify_and_enable_totp', { user_id: userId, token });
    if (error) showError('Invalid code: ' + error.message);
    else { alert('2FA enabled!'); window.location.reload(); }
  });

  document.getElementById('verify-disable-btn').addEventListener('click', async () => {
    const token = document.getElementById('totp-code-disable').value.trim();
    if (!/^\d{6}$/.test(token)) return showError('Enter a valid 6-digit code.');

    const { error } = await supabaseClient.rpc('disable_totp', { user_id: userId, token });
    if (error) showError('Invalid code: ' + error.message);
    else { alert('2FA disabled!'); window.location.reload(); }
  });

  // ... your existing menu/theme/logout/back-to-top code unchanged ...
}

function showError(msg) {
  const e = document.getElementById('error-message');
  e.textContent = msg;
  e.style.display = 'block';
  setTimeout(() => e.style.display = 'none', 5000);
}

// kick off
init2FAPage();
