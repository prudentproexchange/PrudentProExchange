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

// 3. Generate TOTP secret using Netlify function
async function generateTotpSecret() {
  console.log('▶️ generateTotpSecret');
  try {
    const response = await fetch('/.netlify/functions/create-totp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId })
    });
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const data = await response.json();
    if (data.error) {
      throw new Error(data.error);
    }
    document.getElementById('qrcode').src = data.qr_code_url;
    document.getElementById('qrcode').style.display = 'block';
    document.getElementById('secret').textContent = data.secret;
  } catch (error) {
    console.error('Error generating TOTP secret:', error);
    showError('Error generating TOTP secret: ' + error.message);
  }
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
    try {
      const response = await fetch('/.netlify/functions/verify-totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, token })
      });
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      if (data.ok) {
        const { error } = await supabaseClient
          .from('profiles')
          .update({ two_fa_enabled: true })
          .eq('id', userId);
        if (error) throw error;
        alert('2FA enabled successfully!');
        window.location.reload();
      } else {
        showError('Invalid code');
      }
    } catch (error) {
      console.error('Error verifying TOTP:', error);
      showError('Error verifying TOTP: ' + error.message);
    }
  });

  document.getElementById('verify-disable-btn').addEventListener('click', async () => {
    console.log('verify-disable-btn clicked');
    const token = document.getElementById('totp-code-disable').value.trim();
    if (!/^\d{6}$/.test(token)) {
      return showError('Please enter a valid 6-digit code.');
    }
    try {
      const response = await fetch('/.netlify/functions/verify-totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, token })
      });
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      if (data.ok) {
        const { error } = await supabaseClient
          .from('profiles')
          .update({ two_fa_enabled: false })
          .eq('id', userId);
        if (error) throw error;
        alert('2FA disabled successfully!');
        window.location.reload();
      } else {
        showError('Invalid code');
      }
    } catch (error) {
      console.error('Error verifying TOTP:', error);
      showError('Error verifying TOTP: ' + error.message);
    }
  });

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
