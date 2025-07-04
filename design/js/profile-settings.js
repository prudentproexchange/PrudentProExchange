// profile-settings.js

// 1. Init AOS
document.addEventListener('DOMContentLoaded', () => {
  AOS.init({ duration: 800, once: true });
  initCommonUI();
  initSettingsPage();
});

// 2. Supabase Client
const { createClient } = supabase;
const supabaseClient = createClient(
  'https://iwkdznjqfbsfkscnbrkc.supabase.co',
  'YOUR_ANON_KEY_HERE'
);

// 3. Common UI (hamburger, theme, logout, clocks)
function initCommonUI(){
  const hamburgerBtn = document.getElementById('hamburgerBtn'),
        navDrawer     = document.getElementById('navDrawer'),
        overlay       = document.querySelector('.nav-overlay'),
        themeToggle   = document.getElementById('theme-toggle'),
        accountToggle = document.getElementById('account-toggle'),
        submenu       = accountToggle?.nextElementSibling,
        logoutBtn     = document.getElementById('logout-btn'),
        backToTop     = document.getElementById('back-to-top');

  if (hamburgerBtn) {
    hamburgerBtn.addEventListener('click', () => {
      const open = navDrawer.classList.toggle('open');
      hamburgerBtn.classList.toggle('active');
      overlay.classList.toggle('nav-open');
      hamburgerBtn.setAttribute('aria-expanded', open);
    });
    document.addEventListener('click', e => {
      if (!navDrawer.contains(e.target) && !hamburgerBtn.contains(e.target) && navDrawer.classList.contains('open')) {
        navDrawer.classList.remove('open');
        hamburgerBtn.classList.remove('active');
        overlay.classList.remove('nav-open');
      }
    });
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const icon = themeToggle.querySelector('i');
      document.body.classList.toggle('light-theme');
      icon.classList.toggle('fa-moon');
      icon.classList.toggle('fa-sun');
    });
  }

  if (accountToggle && submenu) {
    accountToggle.addEventListener('click', e => {
      e.preventDefault();
      submenu.classList.toggle('open');
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await supabaseClient.auth.signOut();
      window.location.href = 'login.html';
    });
  }

  if (backToTop) {
    backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  // Clocks
  function updateTimes(){
    const now = new Date();
    document.getElementById('utcTime').textContent   = now.toUTCString();
    document.getElementById('localTime').textContent = now.toLocaleTimeString();
    document.getElementById('localDate').textContent = now.toLocaleDateString('en-US',{
      weekday:'long',year:'numeric',month:'long',day:'numeric'
    });
  }
  setInterval(updateTimes, 1000);
  updateTimes();
}

// 4. Settings page logic
async function initSettingsPage(){
  // Auth check
  const { data:{ user }, error: authErr } = await supabaseClient.auth.getUser();
  if (authErr || !user) {
    return void(window.location.href='login.html');
  }

  // Load profile
  const { data: profile, error: profErr } = await supabaseClient
    .from('profiles')
    .select('first_name, photo_url')
    .eq('id', user.id)
    .single();
  if (profErr) {
    return console.error('Profile load error:', profErr);
  }

  document.getElementById('welcomeName').textContent = profile.first_name || 'User';
  if (profile.photo_url) {
    const { data: urlData } = supabaseClient.storage
      .from('profile-photos')
      .getPublicUrl(profile.photo_url);
    const img = document.getElementById('navProfilePhoto');
    img.src = urlData.publicUrl;
    img.style.display = 'block';
    document.getElementById('defaultProfileIcon').style.display = 'none';
  }

  // Load or create settings
  const { data: settings, error: setErr } = await supabaseClient
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .single();
  if (setErr && setErr.code !== 'PGRST116') {
    return console.error('Settings load error:', setErr);
  }

  // Populate form
  if (settings) {
    document.getElementById('displayName').value     = settings.display_name || '';
    document.getElementById('timezone').value        = settings.timezone || 'UTC';
    document.getElementById('locale').value          = settings.locale || 'en-US';
    document.getElementById('themeMode').value       = settings.theme_mode   || 'light';
    document.getElementById('accentColor').value     = settings.accent_color || '#ffd700';
    document.getElementById('fontSize').value        = settings.font_size    || 'medium';
    document.getElementById('notifyEmail').checked   = settings.notify_email;
    document.getElementById('notifySMS').checked     = settings.notify_sms;
    document.getElementById('notifyPush').checked    = settings.notify_push;
    document.getElementById('digestFrequency').value = settings.digest_frequency || 'instant';
    document.getElementById('twoFactorEnabled').checked = settings.two_factor_enabled;
  }

  // Timezone select
  const tzSelect = document.getElementById('timezone');
  for (let tz of Intl.supportedValuesOf('timeZone')) {
    const o = document.createElement('option');
    o.value = o.textContent = tz;
    tzSelect.appendChild(o);
  }

  // Form submit
  document.getElementById('settingsForm').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const up = {
      user_id: user.id,
      display_name: fd.get('displayName'),
      timezone:     fd.get('timezone'),
      locale:       fd.get('locale'),
      theme_mode:   fd.get('themeMode'),
      accent_color: fd.get('accentColor'),
      font_size:    fd.get('fontSize'),
      notify_email: fd.get('notifyEmail') === 'on',
      notify_sms:   fd.get('notifySMS') === 'on',
      notify_push:  fd.get('notifyPush') === 'on',
      digest_frequency: fd.get('digestFrequency'),
      two_factor_enabled: fd.get('twoFactorEnabled') === 'on',
      updated_at:   new Date().toISOString()
    };

    // Handle avatar upload
    const file = fd.get('avatarUpload');
    if (file && file.size > 0) {
      const path = `${user.id}_${Date.now()}_${file.name}`;
      const { error: upErr } = await supabaseClient.storage
        .from('profile-photos').upload(path, file, { upsert: true });
      if (upErr) return alert('Avatar upload failed: ' + upErr.message);
      up.avatar_url = path;
      await supabaseClient.from('profiles')
        .update({ photo_url: path }).eq('id', user.id);
    }

    // Upsert settings
    const { error: saveErr } = await supabaseClient
      .from('user_settings')
      .upsert(up, { onConflict: 'user_id' });
    if (saveErr) {
      return alert('Save failed: ' + saveErr.message);
    }
    alert('Settings saved!');
  });
}
