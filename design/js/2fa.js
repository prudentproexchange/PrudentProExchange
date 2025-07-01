// js/2fa.js

// 1) Init Supabase client (anon key)
const supabaseClient = supabase.createClient(
  'https://iwkdznjqfbsfkscnbrkc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3a2R6bmpxZmJzZmtzY25icmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2Mjk2ODgsImV4cCI6MjA2NjIwNTY4OH0.eRiXpUKP0zAMI9brPHFMxdSwZITGHxu8BPRQprkAbiU'
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

  // 2.2 Fetch profile
  const { data: profile, error: profErr } = await supabaseClient
    .from('profiles')
    .select('first_name,photo_url,two_fa_enabled')
    .eq('id', userId)
    .single();
  if (profErr) {
    return showError('Error loading profile: ' + profErr.message);
  }

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

  const enabled = profile.two_fa_enabled;
  document.getElementById('twofa-status').textContent = enabled
    ? '2FA is currently enabled.'
    : '2FA is currently disabled.';
  document.getElementById('enable-2fa-section').style.display = enabled ? 'none' : 'block';
  document.getElementById('disable-2fa-section').style.display = enabled ? 'block' : 'none';

  // 2.4 If disabled, generate+store the secret via Netlify function
  if (!enabled) {
    await generateTotpSecret();
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

// 4) Wire up all buttons
function setupEventListeners() {
  // Copy secret
  document.getElementById('copy-secret-btn').addEventListener('click', () => {
    const secret = document.getElementById('secret').textContent;
    navigator.clipboard.writeText(secret).then(() => {
      const btn = document.getElementById('copy-secret-btn');
      btn.innerHTML = '<i class="fas fa-check"></i>';
      setTimeout(() => btn.innerHTML = '<i class="fas fa-copy"></i>', 2000);
    });
  });

  // Verify + enable
  document.getElementById('verify-enable-btn').addEventListener('click', async () => {
    const token = document.getElementById('totp-code-enable').value.trim();
    if (!/^\d{6}$/.test(token)) return showError('Enter a valid 6-digit code.');
    try {
      const res = await fetch('/.netlify/functions/verify-totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, token })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { ok } = await res.json();
      if (!ok) return showError('Invalid code');
      // Flip the flag in your profiles table
      const { error: updErr } = await supabaseClient
        .from('profiles')
        .update({ two_fa_enabled: true })
        .eq('id', userId);
      if (updErr) throw updErr;
      alert('2FA enabled successfully!');
      window.location.reload();
    } catch (e) {
      showError('Error verifying TOTP: ' + e.message);
    }
  });

  // Verify + disable
  document.getElementById('verify-disable-btn').addEventListener('click', async () => {
    const token = document.getElementById('totp-code-disable').value.trim();
    if (!/^\d{6}$/.test(token)) return showError('Enter a valid 6-digit code.');
    try {
      const res = await fetch('/.netlify/functions/verify-totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, token })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { ok } = await res.json();
      if (!ok) return showError('Invalid code');
      const { error: updErr } = await supabaseClient
        .from('profiles')
        .update({ two_fa_enabled: false })
        .eq('id', userId);
      if (updErr) throw updErr;
      alert('2FA disabled successfully!');
      window.location.reload();
    } catch (e) {
      showError('Error verifying TOTP: ' + e.message);
    }
  });

  // … copy over your hamburger / theme-toggle / nav / logout / time code here …
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
