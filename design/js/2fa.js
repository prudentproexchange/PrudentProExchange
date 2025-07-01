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

  const { data: { user }, error } = await supabaseClient.auth.getUser();
  if (error || !user) {
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

// Fetch TOTP secret and QR code
async function fetchTotpSecret() {
  const { data, error } = await supabaseClient.rpc('create_totp_secret', { user_id: userId });
  if (error) {
    showError('Error fetching TOTP secret: ' + error.message);
    return;
  }
  const { secret, qr_code_url } = data;
  document.getElementById('qrcode').src = qr_code_url;
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
    if (!token || token.length !== 6) {
      showError('Please enter a valid 6-digit code.');
      return;
    }
    const { error } = await supabaseClient.rpc('verify_and_enable_totp', { user_id: userId, token });
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
    if (!token || token.length !== 6) {
      showError('Please enter a valid 6-digit code.');
      return;
    }
    const { error } = await supabaseClient.rpc('disable_totp', { user_id: userId, token });
    if (error) {
      showError('Invalid code: ' + error.message);
    } else {
      alert('2FA disabled successfully!');
      window.location.reload();
    }
  });

  // Hamburger menu toggle
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const navDrawer = document.getElementById('navDrawer');
  const overlay = document.querySelector('.overlay');
  hamburgerBtn.addEventListener('click', () => {
    navDrawer.classList.toggle('open');
    hamburgerBtn.classList.toggle('active');
    overlay.classList.toggle('nav-open');
  });

  // Close nav when clicking outside
  document.addEventListener('click', (event) => {
    const isClickInsideNav = navDrawer.contains(event.target);
    const isClickOnHamburger = hamburgerBtn.contains(event.target);
    if (!isClickInsideNav && !isClickOnHamburger && navDrawer.classList.contains('open')) {
      navDrawer.classList.remove('open');
      hamburgerBtn.classList.remove('active');
      overlay.classList.remove('nav-open');
    }
  });

  // Theme toggle
  document.getElementById('theme-toggle').addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const icon = document.getElementById('theme-toggle').querySelector('i');
    icon.classList.toggle('fa-moon');
    icon.classList.toggle('fa-sun');
  });

  // Account menu toggle
  const accountToggle = document.getElementById('account-toggle');
  const submenu = accountToggle.nextElementSibling;
  accountToggle.addEventListener('click', (e) => {
    e.preventDefault();
    submenu.classList.toggle('open');
  });

  // Back to top
  document.getElementById('back-to-top').addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Logout
  document.getElementById('logout-btn').addEventListener('click', async () => {
    const { error } = await supabaseClient.auth.signOut() ;
    if (!error) window.location.href = 'login.html';
    else showError('Error logging out: ' + error.message);
  });

  // Time updates
  function updateTime() {
    const now = new Date();
    document.getElementById('utcTime').textContent = now.toUTCString();
    document.getElementById('localTime').textContent = now.toLocaleTimeString();
    document.getElementById('localDate').textContent = now.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }
  setInterval(updateTime, 1000);
  updateTime();
}

// Show error message
function showError(message) {
  const errorDiv = document.getElementById('error-message');
  errorDiv.textContent = message 
  errorDiv.style.display = 'block';
  setTimeout(() => errorDiv.style.display = 'none', 5000);
}

// Start the page
init2FAPage();
