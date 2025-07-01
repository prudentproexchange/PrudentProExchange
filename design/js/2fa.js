// js/2fa.js

// Initialize Supabase client
const { createClient } = supabase;
const supabaseClient = createClient(
  'https://iwkdznjqfbsfkscnbrkc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3a2R6bmpxZmZmtzY25icmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2Mjk2ODgsImV4cCI6MjA2NjIwNTY4OH0.eRiXpUKP0zAMI9brPHFMxdSwZITGHxu8BPRQprkAbiU'
);

let userId;

// Initialize the 2FA settings page
async function init2FAPage() {
  AOS.init({ duration: 800, once: true });

  // 1) get current user
  const { data: { user }, error: authErr } = await supabaseClient.auth.getUser();
  if (authErr || !user) {
    window.location.href = 'login.html';
    return;
  }
  userId = user.id;

  // 2) fetch profile
  const { data: profile, error: profileErr } = await supabaseClient
    .from('profiles')
    .select('first_name, photo_url, two_fa_enabled')
    .eq('id', userId)
    .single();
  if (profileErr) {
    console.error('Error fetching profile:', profileErr);
    showError('Error loading profile: ' + profileErr.message);
    return;
  }

  // 3) fill UI
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
  const statusMessage = document.getElementById('twofa-status');
  const enableSection = document.getElementById('enable-2fa-section');
  const disableSection = document.getElementById('disable-2fa-section');

  if (twoFaEnabled) {
    statusMessage.textContent = '2FA is currently enabled.';
    disableSection.style.display = 'block';
    enableSection.style.display = 'none';
  } else {
    statusMessage.textContent = '2FA is currently disabled.';
    enableSection.style.display = 'block';
    disableSection.style.display = 'none';
    await fetchTotpSecret();
  }

  setupEventListeners();
}

// Fetch TOTP secret and build QR code in JS
async function fetchTotpSecret() {
  const { data, error } = await supabaseClient.rpc(
    'create_totp_secret',
    { _user_id: userId }
  );
  if (error) {
    showError('Error fetching TOTP secret: ' + error.message);
    return;
  }

  // SQL now returns: { secret: text, otp_uri: text }
  const { secret, otp_uri } = data;

  // build QR code URL client-side
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(otp_uri)}&size=200x200`;

  document.getElementById('qrcode').src = qrCodeUrl;
  document.getElementById('qrcode').style.display = 'block';
  document.getElementById('secret').textContent = secret;
}

// Setup event listeners
function setupEventListeners() {
  // Copy secret to clipboard
  document.getElementById('copy-secret-btn').addEventListener('click', () => {
    const secret = document.getElementById('secret').textContent;
    navigator.clipboard.writeText(secret).then(() => {
      const btn = document.getElementById('copy-secret-btn');
      btn.innerHTML = '<i class="fas fa-check"></i>';
      setTimeout(() => btn.innerHTML = '<i class="fas fa-copy"></i>', 2000);
    });
  });

  // Verify and enable 2FA
  document.getElementById('verify-enable-btn').addEventListener('click', async () => {
    const token = document.getElementById('totp-code-enable').value.trim();
    if (!/^\d{6}$/.test(token)) {
      return showError('Please enter a valid 6-digit code.');
    }
    const { error } = await supabaseClient.rpc('verify_and_enable_totp', {
      user_id: userId,
      token,
    });
    if (error) {
      showError('Invalid code: ' + error.message);
    } else {
      alert('2FA enabled successfully!');
      window.location.reload();
    }
  });

  // Verify and disable 2FA
  document.getElementById('verify-disable-btn').addEventListener('click', async () => {
    const token = document.getElementById('totp-code-disable').value.trim();
    if (!/^\d{6}$/.test(token)) {
      return showError('Please enter a valid 6-digit code.');
    }
    const { error } = await supabaseClient.rpc('disable_totp', {
      user_id: userId,
      token,
    });
    if (error) {
      showError('Invalid code: ' + error.message);
    } else {
      alert('2FA disabled successfully!');
      window.location.reload();
    }
  });

  // ... rest of your menu/theme/logout/back-to-top code unchanged ...
}

// Show error message
function showError(message) {
  const errorDiv = document.getElementById('error-message');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  setTimeout(() => (errorDiv.style.display = 'none'), 5000);
}

// Start the page
init2FAPage();
