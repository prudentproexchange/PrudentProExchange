// js/2fa.js

// Initialize Supabase client
const { createClient } = supabase;
const supabaseClient = createClient(
  'https://iwkdznjqfbsfkscnbrkc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3a2R6bmpxZmJzZmtzY25icmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2Mjk2ODgsImV4cCI6MjA2NjIwNTY4OH0.eRiXpUKP0zAMI9brPHFMxdSwZITGHxu8BPRQprkAbiU'
);

let userId;

// Initialize the 2FA settings page
async function init2FAPage() {
  AOS.init({ duration: 800, once: true });

  const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
  if (authError || !user) {
    window.location.href = 'login.html';
    return;
  }
  userId = user.id;

  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('first_name, photo_url, two_fa_enabled')
    .eq('id', userId)
    .single();
  if (profileError) {
    console.error('Error fetching profile:', profileError);
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

  const twoFaEnabled = profile.two_fa_enabled;
  document.getElementById('twofa-status').textContent =
    twoFaEnabled ? '2FA is currently enabled.' : '2FA is currently disabled.';

  document.getElementById('enable-2fa-section').style.display = twoFaEnabled ? 'none' : 'block';
  document.getElementById('disable-2fa-section').style.display = twoFaEnabled ? 'block' : 'none';

  if (!twoFaEnabled) {
    await fetchTotpSecret();
  }

  setupEventListeners();
}

// FIXED: Fetch TOTP secret and log response; ensure param name matches your SQL function
async function fetchTotpSecret() {
  // If your Postgres function is defined as create_totp_secret(_user_id uuid),
  // keep _user_id. If it’s create_totp_secret(user_id uuid), change below to { user_id: userId }.
  const { data, error } = await supabaseClient.rpc('create_totp_secret', {
    _user_id: userId
    // ← or: user_id: userId
  });

  // 1) Log exactly what Supabase returns:
  console.log('TOTP RPC →', { data, error });

  if (error) {
    showError('Error fetching TOTP secret: ' + error.message);
    return;
  }
  if (!data || !data.secret || !data.qr_code_url) {
    showError('Unexpected response from server. Check console for details.');
    return;
  }

  const { secret, qr_code_url } = data;
  const qrcodeEl = document.getElementById('qrcode');
  qrcodeEl.src = qr_code_url;
  qrcodeEl.style.display = 'block';

  document.getElementById('secret').textContent = secret;
}

// Setup event listeners (unchanged)
function setupEventListeners() {
  document.getElementById('copy-secret-btn').addEventListener('click', () => {
    const secret = document.getElementById('secret').textContent;
    navigator.clipboard.writeText(secret).then(() => {
      const btn = document.getElementById('copy-secret-btn');
      btn.innerHTML = '<i class="fas fa-check"></i>';
      setTimeout(() => btn.innerHTML = '<i class="fas fa-copy"></i>', 2000);
    });
  });

  document.getElementById('verify-enable-btn').addEventListener('click', async () => {
    const token = document.getElementById('totp-code-enable').value.trim();
    if (!/^\d{6}$/.test(token)) {
      showError('Please enter a valid 6-digit code.');
      return;
    }
    const { error } = await supabaseClient.rpc('verify_and_enable_totp', {
      user_id: userId,  // ensure this matches your SQL function signature too
      token,
    });
    if (error) {
      showError('Invalid code: ' + error.message);
    } else {
      alert('2FA enabled successfully!');
      window.location.reload();
    }
  });

  document.getElementById('verify-disable-btn').addEventListener('click', async () => {
    const token = document.getElementById('totp-code-disable').value.trim();
    if (!/^\d{6}$/.test(token)) {
      showError('Please enter a valid 6-digit code.');
      return;
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

  // … rest of your menu, theme toggle, logout, time updates, etc., unchanged …
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
