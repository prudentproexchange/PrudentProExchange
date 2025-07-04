// profile-settings.js
document.addEventListener('DOMContentLoaded', () => {
  AOS.init({ duration: 800, once: true });
  initCommonUI();
  initSettingsPage();
});


// 1) Common UI (hamburger, theme toggle, nav, logout, back-to-top, clock)
function initCommonUI(){
  const hamburgerBtn = document.getElementById('hamburgerBtn'),
        navDrawer     = document.getElementById('navDrawer'),
        overlay       = document.querySelector('.nav-overlay'),
        themeToggle   = document.getElementById('theme-toggle'),
        accountToggle = document.getElementById('account-toggle'),
        submenu       = accountToggle?.nextElementSibling,
        logoutBtn     = document.getElementById('logout-btn'),
        backToTop     = document.getElementById('back-to-top');

  // Sanity checks
  console.log({ hamburgerBtn, navDrawer, themeToggle, accountToggle, logoutBtn, backToTop });

  hamburgerBtn?.addEventListener('click', () => {
    const open = navDrawer.classList.toggle('open');
    hamburgerBtn.classList.toggle('active');
    overlay.classList.toggle('nav-open');
    hamburgerBtn.setAttribute('aria-expanded', open);
  });

  document.addEventListener('click', e => {
    if (
      navDrawer.classList.contains('open') &&
      !navDrawer.contains(e.target) &&
      !hamburgerBtn.contains(e.target)
    ) {
      navDrawer.classList.remove('open');
      hamburgerBtn.classList.remove('active');
      overlay.classList.remove('nav-open');
      hamburgerBtn.setAttribute('aria-expanded','false');
    }
  });

  themeToggle?.addEventListener('click', () => {
    const icon = themeToggle.querySelector('i');
    document.body.classList.toggle('light-theme');
    icon.classList.toggle('fa-moon');
    icon.classList.toggle('fa-sun');
  });

  accountToggle?.addEventListener('click', e => {
    e.preventDefault();
    const opened = submenu.classList.toggle('open');
    accountToggle.setAttribute('aria-expanded', opened);
  });

  logoutBtn?.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
  });

  backToTop?.addEventListener('click', () => window.scrollTo({ top:0, behavior:'smooth' }));

  // clocks
  function updateTimes(){
    const now = new Date();
    document.getElementById('utcTime').textContent   = now.toUTCString();
    document.getElementById('localTime').textContent = now.toLocaleTimeString();
    document.getElementById('localDate').textContent = now.toLocaleDateString('en-US',{
      weekday:'long',year:'numeric',month:'long',day:'numeric'
    });
  }
  setInterval(updateTimes,1000);
  updateTimes();
}


// 2) Settings page logic
async function initSettingsPage(){
  // Supabase client
  const { createClient } = supabase;
  window.supabaseClient = createClient(
    'https://iwkdznjqfbsfkscnbrkc.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…' // your anon key
  );

  // 1) auth check
  const { data:{ user }, error: authErr } = await supabaseClient.auth.getUser();
  if (authErr || !user) {
    return void(window.location.href='login.html');
  }

  // 2) load profile
  const { data: profile, error: profErr } = await supabaseClient
    .from('profiles').select('first_name,photo_url').eq('id', user.id).single();
  if (profErr) return alert('Error loading profile');
  document.getElementById('welcomeName').textContent = profile.first_name;
  if (profile.photo_url){
    const { data: urlData } = await supabaseClient.storage
      .from('profile-photos').getPublicUrl(profile.photo_url);
    const img = document.getElementById('navProfilePhoto');
    img.src = urlData.publicUrl;
    img.style.display = 'block';
    document.getElementById('defaultProfileIcon').style.display = 'none';
  }

  // 3) load user_settings (if none, PGRST116)
  const { data: settings, error: setErr } = await supabaseClient
    .from('user_settings').select('*').eq('user_id', user.id).single();
  if (setErr && setErr.code !== 'PGRST116') {
    return alert('Error loading settings');
  }

  // 4) populate form
  if (settings){
    document.getElementById('displayName').value     = settings.display_name || '';
    document.getElementById('timezone').value        = settings.timezone || 'UTC';
    document.getElementById('locale').value          = settings.locale || 'en-US';
    document.getElementById('themeMode').value       = settings.theme_mode || 'light';
    document.getElementById('accentColor').value     = settings.accent_color || '#ffd700';
    document.getElementById('fontSize').value        = settings.font_size || 'medium';
    document.getElementById('notifyEmail').checked   = settings.notify_email || false;
    document.getElementById('notifySMS').checked     = settings.notify_sms || false;
    document.getElementById('notifyPush').checked    = settings.notify_push || false;
    document.getElementById('digestFrequency').value = settings.digest_frequency || 'instant';
    document.getElementById('twoFactorEnabled').checked = settings.two_factor_enabled || false;
  }

  // 5) timezone dropdown
  const tzSelect = document.getElementById('timezone');
  for (let tz of Intl.supportedValuesOf('timeZone')){
    let o = document.createElement('option');
    o.value = o.textContent = tz;
    tzSelect.appendChild(o);
  }

  // 6) form submit
  document.getElementById('settingsForm').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    let up = {
      user_id: user.id,
      display_name: fd.get('displayName'),
      timezone: fd.get('timezone'),
      locale: fd.get('locale'),
      theme_mode: fd.get('themeMode'),
      accent_color: fd.get('accentColor'),
      font_size: fd.get('fontSize'),
      notify_email: fd.get('notifyEmail')=== 'on',
      notify_sms: fd.get('notifySMS')=== 'on',
      notify_push: fd.get('notifyPush')=== 'on',
      digest_frequency: fd.get('digestFrequency'),
      two_factor_enabled: fd.get('twoFactorEnabled')=== 'on',
      updated_at: new Date().toISOString()
    };

    // avatar upload
    const file = fd.get('avatarUpload');
    if (file && file.size) {
      const name = `${user.id}_${Date.now()}_${file.name}`;
      let { error: upErr } = await supabaseClient.storage
        .from('profile-photos').upload(name, file, { upsert: true });
      if (upErr) return alert('Avatar upload failed');
      up.photo_url = name;
      await supabaseClient.from('profiles')
        .update({ photo_url: name }).eq('id', user.id);
    }

    // upsert settings
    const { error: saveErr } = await supabaseClient
      .from('user_settings')
      .upsert(up, { onConflict: 'user_id' });
    if (saveErr) return alert('Save failed');
    alert('Settings saved!');
  });
}
