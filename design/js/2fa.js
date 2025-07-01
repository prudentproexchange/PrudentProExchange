// js/2fa.js

// 1. Init Supabase client
const { createClient } = supabase;
const supabaseClient = createClient(
  'https://iwkdznjqfbsfkscnbrkc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3a2R6bmpxZmJzZmtzY25icmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2Mjk2ODgsImV4cCI6MjA2NjIwNTY4OH0.eRiXpUKP0zAMI9brPHFMxdSwZITGHxu8BPRQprkAbiU'
);

let userId;

// 2. Page init
async function init2FAPage() {
  AOS.init({ duration: 800, once: true });

  // 2.1 Get user
  const { data: authData, error: authError } = await supabaseClient.auth.getUser();
  if (authError || !authData.user) {
    return void (window.location.href = 'login.html');
  }
  userId = authData.user.id;

  // 2.2 Get profile
  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('first_name, photo_url, two_fa_enabled')
    .eq('id', userId)
    .single();
  if (profileError) {
    return showError('Error loading profile: ' + profileError.message);
  }

  // 2.3 Update UI with profile
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

  // 2.4 If disabled, generate secret via Netlify function
  if (!enabled) {
    await generateTotpSecret();
  }

  setupEventListeners();
}

// 3. Generate TOTP secret via Netlify function
async function generateTotpSecret() {
  try {
    const resp = await fetch('/.netlify/functions/create-totp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId })
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const { secret, qr_code_url } = await resp.json();

    document.getElementById('qrcode').src = qr_code_url;
    document.getElementById('qrcode').style.display = 'block';
    document.getElementById('secret').textContent = secret;
  } catch (err) {
    showError('Error generating TOTP secret: ' + err.message);
  }
}

// 4. Event listeners
function setupEventListeners() {
  // Copy secret
  document.getElementById('copy-secret-btn').addEventListener('click', () => {
    const secret = document.getElementById('secret').textContent;
    navigator.clipboard.writeText(secret).then(() => {
      const btn = document.getElementById('copy-secret-btn');
      btn.innerHTML = '<i class="fas fa-check"></i>';
      setTimeout(() => (btn.innerHTML = '<i class="fas fa-copy"></i>'), 2000);
    });
  });

  // Verify & enable 2FA
  document.getElementById('verify-enable-btn').addEventListener('click', async () => {
    const token = document.getElementById('totp-code-enable').value.trim();
    if (!/^\d{6}$/.test(token)) return showError('Enter a valid 6-digit code.');

    try {
      const resp = await fetch('/.netlify/functions/verify-totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, token })
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const { ok } = await resp.json();
      if (!ok) return showError('Invalid code');

      // finally, flip the flag in your DB
      const { error } = await supabaseClient
        .from('profiles')
        .update({ two_fa_enabled: true })
        .eq('id', userId);
      if (error) throw error;

      alert('2FA enabled successfully!');
      window.location.reload();
    } catch (err) {
      showError('Error verifying TOTP: ' + err.message);
    }
  });

  // Verify & disable 2FA
  document.getElementById('verify-disable-btn').addEventListener('click', async () => {
    const token = document.getElementById('totp-code-disable').value.trim();
    if (!/^\d{6}$/.test(token)) return showError('Enter a valid 6-digit code.');

    try {
      const resp = await fetch('/.netlify/functions/verify-totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, token })
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const { ok } = await resp.json();
      if (!ok) return showError('Invalid code');

      const { error } = await supabaseClient
        .from('profiles')
        .update({ two_fa_enabled: false })
        .eq('id', userId);
      if (error) throw error;

      alert('2FA disabled successfully!');
      window.location.reload();
    } catch (err) {
      showError('Error verifying TOTP: ' + err.message);
    }
  });

  // … your hamburger, theme toggle, account menu, back-to-top, logout, time updates …
}

// 5. Error helper
function showError(msg) {
  const e = document.getElementById('error-message');
  e.textContent = msg;
  e.style.display = 'block';
  setTimeout(() => (e.style.display = 'none'), 5000);
}

// 6. Kick it off
init2FAPage();
