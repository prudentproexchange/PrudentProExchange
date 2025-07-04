// profile-settings.js

;(async () => {
  // 0) Instantiate Supabase client and hydrate magic links
  const { createClient } = supabase;
  const supabaseClient = createClient(
    'https://iwkdznjqfbsfkscnbrkc.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3a2R6bmpxZmJzZmtzY25icmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2Mjk2ODgsImV4cCI6MjA2NjIwNTY4OH0.eRiXpUKP0zAMI9brPHFMxdSwZITGHxu8BPRQprkAbiU'
  );

  // hydrate session if magic-link/OAuth
  await supabaseClient.auth.getSessionFromUrl({ storeSession: true }).catch(console.error);

  // wait for DOM
  document.addEventListener('DOMContentLoaded', () => {
    initCommonUI(supabaseClient);
    initSettingsPage(supabaseClient);
  });
})();

// shared UI behaviors (hamburger, theme toggle, logout, time updates)
function initCommonUI(supabaseClient) {
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const navDrawer    = document.getElementById('navDrawer');
  const overlay      = document.querySelector('.overlay');
  const themeToggle  = document.getElementById('theme-toggle');
  const accountToggle= document.getElementById('account-toggle');
  const submenu      = accountToggle.nextElementSibling;
  const logoutBtn    = document.getElementById('logout-btn');
  const backToTop    = document.getElementById('back-to-top');

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
      hamburgerBtn.setAttribute('aria-expanded', 'false');
    }
  });
  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const icon = themeToggle.querySelector('i');
    icon.classList.toggle('fa-moon');
    icon.classList.toggle('fa-sun');
  });
  accountToggle.addEventListener('click', e => {
    e.preventDefault();
    const open = submenu.classList.toggle('open');
    accountToggle.setAttribute('aria-expanded', open);
  });
  logoutBtn.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
  });
  backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  // time widgets
  function updateTimes() {
    const now = new Date();
    document.getElementById('utcTime').textContent   = now.toUTCString();
    document.getElementById('localTime').textContent = now.toLocaleTimeString();
    document.getElementById('localDate').textContent = now.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }
  setInterval(updateTimes, 1000);
  updateTimes();
}

// main settings logic
async function initSettingsPage(supabaseClient) {
  // 1) require auth
  const { data: { user }, error: authErr } = await supabaseClient.auth.getUser();
  if (authErr || !user) {
    window.location.href = 'login.html';
    return;
  }

  // 2) fetch profile row
  const { data: profile, error: profErr } = await supabaseClient
    .from('profiles')
    .select('first_name, last_name, email, photo_url')
    .eq('id', user.id)
    .single();
  if (profErr) {
    console.error(profErr);
    alert('Failed to load profile.');
    return;
  }

  // 3) render profile info
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

  // 4) fetch or set defaults for settings
  const { data: settings, error: setErr } = await supabaseClient
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .single();
  if (setErr && setErr.code !== 'PGRST116') {
    console.error(setErr);
    alert('Failed to load settings.');
    return;
  }

  // 5) populate form
  if (settings) {
    document.getElementById('displayName').value = settings.display_name || '';
    document.getElementById('timezone').value    = settings.timezone     || 'UTC';
    document.getElementById('locale').value      = settings.locale       || 'en-US';
    document.getElementById('themeMode').value   = settings.theme_mode   || 'light';
    document.getElementById('accentColor').value = settings.accent_color || '#ffd700';
    document.getElementById('fontSize').value    = settings.font_size    || 'medium';
    document.getElementById('notifyEmail').checked = settings.notify_email;
    document.getElementById('notifySMS').checked   = settings.notify_sms;
    document.getElementById('notifyPush').checked  = settings.notify_push;
    document.getElementById('digestFrequency').value  = settings.digest_frequency || 'instant';
    document.getElementById('twoFactorEnabled').checked = settings.two_factor_enabled;
  }

  // 6) populate timezone dropdown
  const tzSelect = document.getElementById('timezone');
  Intl.supportedValuesOf('timeZone').forEach(tz => {
    const opt = document.createElement('option');
    opt.value = tz; opt.textContent = tz;
    tzSelect.appendChild(opt);
  });

  // 7) handle form submit
  document.getElementById('settingsForm').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    // build payload
    const payload = {
      user_id: user.id,
      display_name: fd.get('displayName'),
      timezone:     fd.get('timezone'),
      locale:       fd.get('locale'),
      theme_mode:   fd.get('themeMode'),
      accent_color: fd.get('accentColor'),
      font_size:    fd.get('fontSize'),
      notify_email: fd.has('notifyEmail'),
      notify_sms:   fd.has('notifySMS'),
      notify_push:  fd.has('notifyPush'),
      digest_frequency: fd.get('digestFrequency'),
      two_factor_enabled: fd.has('twoFactorEnabled'),
      updated_at: new Date().toISOString()
    };

    // 8) optional avatar upload
    const file = fd.get('avatarUpload');
    if (file && file.size > 0) {
      const name = `${user.id}_${Date.now()}_${file.name}`;
      const { error: upErr } = await supabaseClient.storage
        .from('profile-photos')
        .upload(name, file, { upsert: true });
      if (upErr) {
        console.error(upErr);
        return alert('Failed uploading avatar');
      }
      // save URL in both tables
      payload.avatar_url = name;
      await supabaseClient
        .from('profiles')
        .update({ photo_url: name })
        .eq('id', user.id);
    }

    // 9) upsert settings row
    const { error: saveErr } = await supabaseClient
      .from('user_settings')
      .upsert(payload, { onConflict: 'user_id' });
    if (saveErr) {
      console.error(saveErr);
      return alert('Failed to save settings');
    }
    alert('Settings saved!');
    // update display name immediately
    if (payload.display_name) {
      document.getElementById('welcomeName').textContent = payload.display_name;
    }
  });
}
