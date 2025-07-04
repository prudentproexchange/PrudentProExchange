// profile-settings.js

AOS.init({ duration: 800, once: true });

const { createClient } = supabase;
const supabaseClient = createClient(
  'https://iwkdznjqfbsfkscnbrkc.supabase.co',
  'YOUR_ANON_KEY_HERE'
);

// Common UI: header, nav, theme, logout, back-to-top
function initCommonUI() {
  document.getElementById('hamburgerBtn').onclick = () =>
    document.getElementById('navDrawer').classList.toggle('open');

  document.getElementById('theme-toggle').onclick = () => {
    document.body.classList.toggle('light-theme');
    document.querySelector('#theme-toggle i').classList.toggle('fa-sun');
  };

  document.getElementById('logout-btn').onclick = async () => {
    await supabaseClient.auth.signOut();
    location.href = 'login.html';
  };

  document.getElementById('back-to-top').onclick = () =>
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Load & populate the form
async function initProfileSettings() {
  // 1) Check session
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return location.href = 'login.html';
  const userId = session.user.id;

  // 2) Fetch profile
  const { data: profile, error: pErr } = await supabaseClient
    .from('profiles').select('first_name,photo_url').eq('id', userId).single();
  if (pErr) return alert('Error loading profile');

  document.getElementById('welcomeName').textContent = profile.first_name;
  if (profile.photo_url) {
    const url = supabaseClient.storage
      .from('profile-photos').getPublicUrl(profile.photo_url).data.publicUrl;
    const img = document.getElementById('navProfilePhoto');
    img.src = url; img.hidden = false;
    document.getElementById('defaultProfileIcon').hidden = true;
  }

  // 3) Fetch settings
  const { data: settings } = await supabaseClient
    .from('user_settings').select('*').eq('user_id', userId).single();

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

  // 5) Timezones
  for (let tz of Intl.supportedValuesOf('timeZone')) {
    f.timezone.append(new Option(tz, tz));
  }
  f.timezone.value = s.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  // 6) Avatar preview
  f.avatarUpload.onchange = () => {
    let file = f.avatarUpload.files[0];
    if (!file) return;
    let reader = new FileReader();
    reader.onload = e => {
      let img = document.getElementById('navProfilePhoto');
      img.src = e.target.result; img.hidden = false;
      document.getElementById('defaultProfileIcon').hidden = true;
    };
    reader.readAsDataURL(file);
  };

  // 7) Save handler
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

    // upload avatar if changed
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
