// js/2fa.js

// 1. Init Supabase client (v2)
const { createClient } = supabase;
const supabaseClient = createClient(
  'https://iwkdznjqfbsfkscnbrkc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3a2R6bmpxZmJzZmtzY25icmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2Mjk2ODgsImV4cCI6MjA2NjIwNTY4OH0.eRiXpUKP0zAMI9brPHFMxdSwZITGHxu8BPRQprkAbiU'
);

let userId;

// 2. Page initialization
async function init2FAPage() {
  AOS.init({ duration: 800, once: true });

  // 2.1 fetch user
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
  if (authError || !user) return window.location.href = 'login.html';
  userId = user.id;

  // 2.2 fetch profile
  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('first_name, photo_url, two_fa_enabled')
    .eq('id', userId)
    .single();
  if (profileError) return showError('Error loading profile: ' + profileError.message);

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

  if (!enabled) await generateTotpSecret();
  setupEventListeners();
}

// 3. Generate TOTP secret (v2 MFA)
async function generateTotpSecret() {
  const { data, error } = await supabaseClient.auth.mfa.generateTOTP();
  if (error) return showError('Error generating TOTP: ' + error.message);

  // data = { secret, totp_url }
  document.getElementById('qrcode').src = data.totp_url;
  document.getElementById('qrcode').style.display = 'block';
  document.getElementById('secret').textContent = data.secret;
}

// 4. Event listeners
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
    const { data, error } = await supabaseClient.auth.mfa.verifyTOTP({ token });
    if (error) return showError('Invalid code: ' + error.message);
    alert('2FA enabled successfully!');
    window.location.reload();
  });

  // verify + disable
  document.getElementById('verify-disable-btn').addEventListener('click', async () => {
    const token = document.getElementById('totp-code-disable').value.trim();
    if (!/^\d{6}$/.test(token)) return showError('Enter a valid 6-digit code.');
    const { data, error } = await supabaseClient.auth.mfa.deleteTOTP({ token });
    if (error) return showError('Invalid code: ' + error.message);
    alert('2FA disabled successfully!');
    window.location.reload();
  });

  // … your hamburger, theme toggle, logout, time updates, etc. …
}

// 5. showError helper
function showError(msg) {
  const e = document.getElementById('error-message');
  e.textContent = msg;
  e.style.display = 'block';
  setTimeout(() => e.style.display = 'none', 5000);
}

// 6. Kick things off
init2FAPage();
