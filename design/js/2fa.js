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
  console.log('▶️ init2FAPage');

  AOS.init({ duration: 800, once: true });

  // 2.1 Get user
  const { data: authData, error: authError } = await supabaseClient.auth.getUser();
  console.log('getUser →', authData, authError);
  if (authError || !authData.user) {
    console.warn('Not logged in, redirecting');
    return void (window.location.href = 'login.html');
  }
  userId = authData.user.id;
  console.log('User ID:', userId);

  // 2.2 Get profile
  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('first_name, photo_url, two_fa_enabled')
    .eq('id', userId)
    .single();
  console.log('profile →', profile, profileError);
  if (profileError) {
    console.error('Error fetching profile', profileError);
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
  console.log('two_fa_enabled flag:', enabled);
  document.getElementById('twofa-status').textContent = enabled
    ? '2FA is currently enabled.'
    : '2FA is currently disabled.';
  document.getElementById('enable-2fa-section').style.display = enabled ? 'none' : 'block';
  document.getElementById('disable-2fa-section').style.display = enabled ? 'block' : 'none';

  // 2.4 If disabled, generate secret
  if (!enabled) {
    await generateTotpSecret();
  }

  setupEventListeners();
}

// 3. Generate TOTP secret
async function generateTotpSecret() {
  console.log('▶️ generateTotpSecret');
  // sanity-check auth.mfa
  if (!supabaseClient.auth.mfa || typeof supabaseClient.auth.mfa.generateTOTP !== 'function') {
    console.error('auth.mfa.generateTOTP is not available!', supabaseClient.auth.mfa);
    return showError('Your Supabase client doesn’t support auth.mfa.generateTOTP().');
  }

  const { data, error } = await supabaseClient.auth.mfa.generateTOTP();
  console.log('generateTOTP →', data, error);

  if (error) {
    return showError('Error generating TOTP: ' + error.message);
  }
  if (!data || !data.secret || !data.totp_url) {
    console.warn('generateTOTP returned no secret/url', data);
    return showError('Unexpected response from generateTOTP()—check console.');
  }

  document.getElementById('qrcode').src = data.totp_url;
  document.getElementById('qrcode').style.display = 'block';
  document.getElementById('secret').textContent = data.secret;
}

// 4. Event listeners
function setupEventListeners() {
  console.log('▶️ setupEventListeners');

  document.getElementById('copy-secret-btn').addEventListener('click', () => {
    console.log('copy-secret-btn clicked');
    const secret = document.getElementById('secret').textContent;
    navigator.clipboard.writeText(secret).then(() => {
      const btn = document.getElementById('copy-secret-btn');
      btn.innerHTML = '<i class="fas fa-check"></i>';
      setTimeout(() => (btn.innerHTML = '<i class="fas fa-copy"></i>'), 2000);
    });
  });

  document.getElementById('verify-enable-btn').addEventListener('click', async () => {
    console.log('verify-enable-btn clicked');
    const token = document.getElementById('totp-code-enable').value.trim();
    if (!/^\d{6}$/.test(token)) {
      return showError('Please enter a valid 6-digit code.');
    }
    const { data, error } = await supabaseClient.auth.mfa.verifyTOTP({ token });
    console.log('verifyTOTP →', data, error);
    if (error) {
      return showError('Invalid code: ' + error.message);
    }
    alert('2FA enabled successfully!');
    window.location.reload();
  });

  document.getElementById('verify-disable-btn').addEventListener('click', async () => {
    console.log('verify-disable-btn clicked');
    const token = document.getElementById('totp-code-disable').value.trim();
    if (!/^\d{6}$/.test(token)) {
      return showError('Please enter a valid 6-digit code.');
    }
    const { data, error } = await supabaseClient.auth.mfa.deleteTOTP({ token });
    console.log('deleteTOTP →', data, error);
    if (error) {
      return showError('Invalid code: ' + error.message);
    }
    alert('2FA disabled successfully!');
    window.location.reload();
  });

  // … copy over your hamburger, theme toggle, account menu, back-to-top, logout …

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

// 5. Error helper
function showError(message) {
  console.log('showError:', message);
  const e = document.getElementById('error-message');
  e.textContent = message;
  e.style.display = 'block';
  setTimeout(() => (e.style.display = 'none'), 5000);
}

// 6. Start
init2FAPage();
