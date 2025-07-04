// profile-settings.js

// 1) Initialize AOS
AOS.init({ duration: 800, once: true });

// 2) Create Supabase client
const { createClient } = supabase;
const supabaseClient = createClient(
  'https://iwkdznjqfbsfkscnbrkc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3a2R6bmpxZmJzZmtzY25icmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2Mjk2ODgsImV4cCI6MjA2NjIwNTY4OH0.eRiXpUKP0zAMI9brPHFMxdSwZITGHxu8BPRQprkAbiU'
);

// 3) DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  setupUIInteractions();
  initSettingsPage();
});

function setupUIInteractions() {
  // Hamburger
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const navDrawer     = document.getElementById('navDrawer');
  const overlay       = document.querySelector('.overlay');
  if (hamburgerBtn && navDrawer && overlay) {
    hamburgerBtn.addEventListener('click', () => {
      navDrawer .classList.toggle('open');
      hamburgerBtn.classList.toggle('active');
      overlay   .classList.toggle('nav-open');
    });
    document.addEventListener('click', (e) => {
      if (!navDrawer.contains(e.target) && !hamburgerBtn.contains(e.target) && navDrawer.classList.contains('open')) {
        navDrawer .classList.remove('open');
        hamburgerBtn.classList.remove('active');
        overlay   .classList.remove('nav-open');
      }
    });
  }

  // Theme toggle
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('light-theme');
      const icon = themeToggle.querySelector('i');
      if (icon) icon.classList.toggle('fa-moon') && icon.classList.toggle('fa-sun');
    });
  }

  // Account submenu
  const accountToggle = document.getElementById('account-toggle');
  if (accountToggle) {
    const submenu = accountToggle.nextElementSibling;
    accountToggle.addEventListener('click', (e) => {
      e.preventDefault();
      submenu?.classList.toggle('open');
    });
  }

  // Back to top
  document.getElementById('back-to-top')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Video autoplay
  const video = document.querySelector('.bg-video');
  video?.addEventListener('canplay', () => {
    video.play().catch(console.error);
  });
}

// 4) Utility: update clocks
function updateLocalTime() {
  const now = new Date();
  document.getElementById('localTime')?.textContent = now.toLocaleTimeString();
  document.getElementById('localDate')?.textContent = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}
function updateUTCTime() {
  document.getElementById('utcTime')?.textContent = new Date().toUTCString();
}
setInterval(updateLocalTime, 1000);
setInterval(updateUTCTime, 1000);
updateLocalTime(); updateUTCTime();

// 5) Main: load & save settings
async function initSettingsPage() {
  try {
    // Auth check
    const { data: { user }, error: authErr } = await supabaseClient.auth.getUser();
    if (authErr || !user) {
      window.location.href = 'login.html';
      return;
    }

    // Load profile
    const { data: profile, error: profileErr } = await supabaseClient
      .from('profiles')
      .select('first_name, photo_url')
      .eq('id', user.id)
      .single();
    if (profileErr) throw profileErr;

    document.getElementById('welcomeName')?.textContent = profile.first_name || 'User';
    if (profile.photo_url) {
      const { data: urlData } = supabaseClient.storage
        .from('profile-photos')
        .getPublicUrl(profile.photo_url);
      const img = document.getElementById('navProfilePhoto');
      if (img) {
        img.src = urlData.publicUrl;
        img.style.display = 'block';
        document.getElementById('defaultProfileIcon').style.display = 'none';
      }
    }

    // Load or initialize settings
    let settings = null;
    const { data, error: settingsErr } = await supabaseClient
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();
    if (settingsErr && settingsErr.code !== 'PGRST116') throw settingsErr;
    settings = data;

    // Fill form
    if (settings) {
      document.getElementById('displayName') .value = settings.display_name || '';
      document.getElementById('timezone')    .value = settings.timezone    || 'UTC';
      document.getElementById('locale')      .value = settings.locale      || 'en-US';
      document.getElementById('themeMode')   .value = settings.theme_mode   || 'light';
      document.getElementById('accentColor') .value = settings.accent_color|| '#ffd700';
      document.getElementById('fontSize')    .value = settings.font_size    || 'medium';
      document.getElementById('notifyEmail') .checked = settings.notify_email   || false;
      document.getElementById('notifySMS')   .checked = settings.notify_sms     || false;
      document.getElementById('notifyPush')  .checked = settings.notify_push    || false;
      document.getElementById('digestFrequency').value = settings.digest_frequency || 'instant';
      document.getElementById('twoFactorEnabled').checked = settings.two_factor_enabled || false;
    }

    // Populate timezone dropdown
    const tzSelect = document.getElementById('timezone');
    if (tzSelect && Intl.supportedValuesOf) {
      Intl.supportedValuesOf('timeZone').forEach(tz => {
        const opt = document.createElement('option');
        opt.value = tz; opt.textContent = tz;
        tzSelect.appendChild(opt);
      });
    }

    // Form handler
    document.getElementById('settingsForm')?.addEventListener('submit', async e => {
      e.preventDefault();
      const form = e.target;
      const fd = new FormData(form);
      const payload = {
        user_id: user.id,
        display_name:    fd.get('displayName'),
        timezone:        fd.get('timezone'),
        locale:          fd.get('locale'),
        theme_mode:      fd.get('themeMode'),
        accent_color:    fd.get('accentColor'),
        font_size:       fd.get('fontSize'),
        notify_email:    fd.get('notifyEmail')==='on',
        notify_sms:      fd.get('notifySMS')==='on',
        notify_push:     fd.get('notifyPush')==='on',
        digest_frequency:fd.get('digestFrequency'),
        two_factor_enabled: fd.get('twoFactorEnabled')==='on',
        updated_at:      new Date().toISOString()
      };

      // Optional avatar upload
      const avatar = fd.get('avatarUpload');
      if (avatar && avatar.size > 0) {
        const fileName = `${user.id}_${Date.now()}_${avatar.name}`;
        const { error: upErr } = await supabaseClient.storage
          .from('profile-photos')
          .upload(fileName, avatar, { upsert: true });
        if (upErr) throw upErr;
        payload.avatar_url = fileName;
        await supabaseClient
          .from('profiles')
          .update({ photo_url: fileName })
          .eq('id', user.id);
      }

      // Upsert settings row
      const { error: saveErr } = await supabaseClient
        .from('user_settings')
        .upsert(payload, { onConflict: 'user_id' });
      if (saveErr) throw saveErr;

      alert('Settings saved!');
      // Update name/avatar in UI
      document.getElementById('welcomeName')?.textContent = payload.display_name || profile.first_name;
      if (payload.avatar_url) {
        const { data: urlData } = supabaseClient.storage
          .from('profile-photos')
          .getPublicUrl(payload.avatar_url);
        const img = document.getElementById('navProfilePhoto');
        if (img) {
          img.src = urlData.publicUrl;
          img.style.display = 'block';
          document.getElementById('defaultProfileIcon').style.display = 'none';
        }
      }
    });

    // Logout
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
      const { error } = await supabaseClient.auth.signOut();
      if (!error) window.location.href = 'login.html';
      else alert('Logout error: ' + error.message);
    });

  } catch (err) {
    console.error('Settings page error:', err);
    alert('An unexpected error occurred: ' + err.message);
  }
}
