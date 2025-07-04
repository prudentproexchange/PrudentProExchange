// profile-settings.js

AOS.init({ duration: 800, once: true });

const { createClient } = supabase;
const supabaseClient = createClient(
  'https://iwkdznjqfbsfkscnbrkc.supabase.co',
  'YOUR_ANON_KEY_HERE'
);

// Common UI
function initCommonUI() {
  const hamburger = document.getElementById('hamburgerBtn'),
        nav = document.getElementById('navDrawer'),
        themeToggle = document.getElementById('theme-toggle'),
        logoutBtn = document.getElementById('logout-btn'),
        backToTop = document.getElementById('back-to-top');

  hamburger.onclick = () => nav.classList.toggle('open');
  themeToggle.onclick = () => {
    document.body.classList.toggle('light-theme');
    themeToggle.querySelector('i').classList.toggle('fa-sun');
  };
  logoutBtn.onclick = async () => {
    await supabaseClient.auth.signOut();
    location.href = 'login.html';
  };
  backToTop.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function initProfileSettings() {
  // 1) Auth guard
  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData.session) return location.href = 'login.html';

  const userId = sessionData.session.user.id;

  // 2) Load profile
  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('first_name, photo_url')
    .eq('id', userId)
    .single();

  document.getElementById('welcomeName').textContent = profile.first_name;
  if (profile.photo_url) {
    document.getElementById('navProfilePhoto').src =
      supabaseClient.storage.from('profile-photos').getPublicUrl(profile.photo_url).data.publicUrl;
    document.getElementById('navProfilePhoto').style.display = 'block';
    document.getElementById('defaultProfileIcon').style.display = 'none';
  }

  // 3) Load settings
  const { data: settings } = await supabaseClient
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single();

  // 4) Populate form
  const f = document.getElementById('settingsForm');
  const s = settings || {};
  f.displayName.value   = s.display_name    || '';
  f.locale.value        = s.locale          || 'en-US';
  f.themeMode.value     = s.theme_mode      || 'light';
  f.accentColor.value   = s.accent_color    || '#ffd700';
  f.fontSize.value      = s.font_size       || 'medium';
  f.digestFrequency.value = s.digest_frequency || 'instant';
  f.notifyEmail.checked = !!s.notify_email;
  f.notifySMS.checked   = !!s.notify_sms;
  f.notifyPush.checked  = !!s.notify_push;
  f.twoFactorEnabled.checked = !!s.two_factor_enabled;

  // 5) Timezone dropdown
  const tzSelect = f.timezone;
  Intl.supportedValuesOf('timeZone').forEach(tz => {
    let o = new Option(tz, tz);
    tzSelect.add(o);
  });
  tzSelect.value = s.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  // 6) Upload avatar preview
  f.avatarUpload.onchange = () => {
    if (f.avatarUpload.files[0]) {
      let reader = new FileReader();
      reader.onload = e => {
        document.getElementById('navProfilePhoto').src = e.target.result;
        document.getElementById('navProfilePhoto').style.display = 'block';
        document.getElementById('defaultProfileIcon').style.display = 'none';
      };
      reader.readAsDataURL(f.avatarUpload.files[0]);
    }
  };

  // 7) Submit handler
  f.onsubmit = async e => {
    e.preventDefault();
    let upd = {
      user_id: userId,
      display_name: f.displayName.value,
      timezone: f.timezone.value,
      locale: f.locale.value,
      theme_mode: f.themeMode.value,
      accent_color: f.accentColor.value,
      font_size: f.fontSize.value,
      notify_email: f.notifyEmail.checked,
      notify_sms:   f.notifySMS.checked,
      notify_push:  f.notifyPush.checked,
      digest_frequency: f.digestFrequency.value,
      two_factor_enabled: f.twoFactorEnabled.checked,
      updated_at: new Date().toISOString()
    };

    // avatar upload
    if (f.avatarUpload.files[0]) {
      const file = f.avatarUpload.files[0];
      const path = `${userId}/${Date.now()}_${file.name}`;
      await supabaseClient.storage.from('profile-photos').upload(path, file, { upsert: true });
      upd.avatar_url = path;
      await supabaseClient.from('profiles').update({ photo_url: path }).eq('id', userId);
    }

    await supabaseClient.from('user_settings').upsert(upd, { onConflict: 'user_id' });
    alert('Settings saved!');
  };
}

window.addEventListener('DOMContentLoaded', () => {
  initCommonUI();
  initProfileSettings();
});
