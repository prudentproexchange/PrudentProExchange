// js/2fa.js

// 1. Init Supabase client (v2)
const SUPABASE_URL = 'https://iwkdznjqfbsfkscnbrkc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3a2R6bmpxZmJzZmtzY25icmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2Mjk2ODgsImV4cCI6MjA2NjIwNTY4OH0.eRiXpUKP0zAMI9brPHFMxdSwZITGHxu8BPRQprkAbiU';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', async () => {
  // initialize animations
  if (window.AOS) AOS.init({ duration: 800, once: true });

  // 2. check session
  const { data: { session }, error: sessionErr } = await supabaseClient.auth.getSession();
  if (sessionErr || !session) {
    return void (window.location.href = 'login.html');
  }
  const user = session.user;
  
  // 3. fetch profile
  const { data: profile, error: profileErr } = await supabaseClient
    .from('profiles')
    .select('first_name, photo_url, two_fa_enabled')
    .eq('id', user.id)
    .single();
  if (profileErr) {
    return showError('Error loading profile: ' + profileErr.message);
  }

  // 4. populate UI
  document.getElementById('welcomeName').textContent = profile.first_name || user.email;
  if (profile.photo_url) {
    const { data: urlData } = supabaseClient
      .storage
      .from('profile-photos')
      .getPublicUrl(profile.photo_url);
    document.getElementById('navProfilePhoto').src = urlData.publicUrl;
    document.getElementById('navProfilePhoto').style.display = 'block';
    document.getElementById('defaultProfileIcon').style.display = 'none';
  }

  // 5. show/hide sections
  const enabled = profile.two_fa_enabled;
  document.getElementById('twofa-status').textContent = enabled
    ? '2FA is currently enabled.'
    : '2FA is currently disabled.';
  document.getElementById('enable-2fa-section').style.display = enabled ? 'none' : 'block';
  document.getElementById('disable-2fa-section').style.display = enabled ? 'block' : 'none';

  // 6. if disabled, get totp secret
  if (!enabled) {
    try {
      const { data, error } = await supabaseClient
        .rpc('create_totp_secret', { user_id: user.id });
      if (error) throw error;
      document.getElementById('qrcode').src = data.qr_code_url;
      document.getElementById('qrcode').style.display = 'block';
      document.getElementById('secret').textContent = data.secret;
    } catch (err) {
      console.error(err);
      showError('Could not generate 2FA secret.');
    }
  }

  // 7. event listeners
  document.getElementById('copy-secret-btn').addEventListener('click', () => {
    const secret = document.getElementById('secret').textContent;
    navigator.clipboard.writeText(secret);
  });

  document.getElementById('verify-enable-btn').addEventListener('click', async () => {
    const token = document.getElementById('totp-code-enable').value.trim();
    if (!/^\d{6}$/.test(token)) return showError('Enter a valid 6-digit code.');
    try {
      const { error } = await supabaseClient
        .rpc('verify_and_enable_totp', { user_id: user.id, token });
      if (error) throw error;
      alert('2FA enabled!');
      window.location.reload();
    } catch (err) {
      showError('Invalid code.');
    }
  });

  document.getElementById('verify-disable-btn').addEventListener('click', async () => {
    const token = document.getElementById('totp-code-disable').value.trim();
    if (!/^\d{6}$/.test(token)) return showError('Enter a valid 6-digit code.');
    try {
      const { error } = await supabaseClient
        .rpc('disable_totp', { user_id: user.id, token });
      if (error) throw error;
      alert('2FA disabled!');
      window.location.reload();
    } catch (err) {
      showError('Invalid code.');
    }
  });

  // 8. logout
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
  });

  // 9. back-to-top
  document.getElementById('back-to-top').addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // 10. time updates
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

  // 11. hamburger menu
  document.getElementById('hamburgerBtn').addEventListener('click', () => {
    document.getElementById('navDrawer').classList.toggle('open');
    document.querySelector('.overlay').classList.toggle('nav-open');
  });
  document.addEventListener('click', e => {
    const drawer = document.getElementById('navDrawer');
    if (!drawer.contains(e.target) && !document.getElementById('hamburgerBtn').contains(e.target)) {
      drawer.classList.remove('open');
      document.querySelector('.overlay').classList.remove('nav-open');
    }
  });

  // 12. theme toggle
  document.getElementById('theme-toggle').addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    document.getElementById('theme-toggle').querySelector('i').classList.toggle('fa-sun');
  });
});

// helper
function showError(msg) {
  const e = document.getElementById('error-message');
  e.textContent = msg;
  e.style.display = 'block';
  setTimeout(() => e.style.display = 'none', 5000);
}
