// js/2fa.js

// 1. Initialize Supabase client (v2+)
const { createClient } = supabase;
const supabaseClient = createClient(
  'https://iwkdznjqfbsfkscnbrkc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3a2R6bmpxZmJzZmtzY25icmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2Mjk2ODgsImV4cCI6MjA2NjIwNTY4OH0.eRiXpUKP0zAMI9brPHFMxdSwZITGHxu8BPRQprkAbiU'
);

let userId;

// 2. Page init
async function init2FAPage() {
  AOS.init({ duration: 800, once: true });

  // get user
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
  if (authError || !user) {
    window.location.href = 'login.html';
    return;
  }
  userId = user.id;

  // get profile
  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('first_name, photo_url, two_fa_enabled')
    .eq('id', userId)
    .single();
  if (profileError) {
    console.error('Profile error:', profileError);
    showError('Error loading profile: ' + profileError.message);
    return;
  }

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

  if (!enabled) {
    await generateTotpSecret();
  }
  setupEventListeners();
}

// 3. Generate TOTP secret (no RPC, uses client API)
async function generateTotpSecret() {
  const { data, error } = await supabaseClient.auth.mfa.generateTOTP();
  console.log('generateTOTP →', { data, error });

  if (error) {
    showError('Error generating TOTP: ' + error.message);
    return;
  }
  // data: { secret: string, totp_url: string }
  document.getElementById('qrcode').src = data.totp_url;
  document.getElementById('qrcode').style.display = 'block';
  document.getElementById('secret').textContent = data.secret;
}

// 4. Setup all your buttons & menu / time logic
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
    if (!/^\d{6}$/.test(token)) {
      return showError('Please enter a valid 6-digit code.');
    }
    const { data, error } = await supabaseClient.auth.mfa.verifyTOTP({ token });
    console.log('verifyTOTP →', { data, error });

    if (error) {
      showError('Invalid code: ' + error.message);
    } else {
      alert('2FA enabled successfully!');
      window.location.reload();
    }
  });

  // verify + disable
  document.getElementById('verify-disable-btn').addEventListener('click', async () => {
    const token = document.getElementById('totp-code-disable').value.trim();
    if (!/^\d{6}$/.test(token)) {
      return showError('Please enter a valid 6-digit code.');
    }
    const { data, error } = await supabaseClient.auth.mfa.deleteTOTP({ token });
    console.log('deleteTOTP →', { data, error });

    if (error) {
      showError('Invalid code: ' + error.message);
    } else {
      alert('2FA disabled successfully!');
      window.location.reload();
    }
  });

  // hamburger, theme, account menu, back-to-top, logout, time updates...
  // — copy these handlers from your original script unchanged —

  // Time updates
  function updateTime() {
    const now = new Date();
    document.getElementById('utcTime').textContent   = now.toUTCString();
    document.getElementById('localTime').textContent = now.toLocaleTimeString();
    document.getElementById('localDate').textContent = now.toLocaleDateString('en-GB', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }
  setInterval(updateTime, 1000);
  updateTime();
}

// 5. showError helper
function showError(message) {
  const e = document.getElementById('error-message');
  e.textContent = message;
  e.style.display = 'block';
  setTimeout(() => (e.style.display = 'none'), 5000);
}

// 6. Kick things off
init2FAPage();
