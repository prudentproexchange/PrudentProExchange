// Initialize AOS
AOS.init({ duration: 800, once: true });

// Supabase Client
const { createClient } = supabase;
const supabaseClient = createClient(
  'https://iwkdznjqfbsfkscnbrkc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3a2R6bmpxZmJzZmtzY25icmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2Mjk2ODgsImV4cCI6MjA2NjIwNTY4OH0.eRiXpUKP0zAMI9brPHFMxdSwZITGHxu8BPRQprkAbiU'
);

// Hamburger Toggle
const hamburgerBtn = document.getElementById('hamburgerBtn');
const navDrawer = document.getElementById('navDrawer');
const overlay = document.querySelector('.overlay');
hamburgerBtn.addEventListener('click', () => {
  navDrawer.classList.toggle('open');
  hamburgerBtn.classList.toggle('active');
  overlay.classList.toggle('nav-open');
  if (navDrawer.classList.contains('open')) {
    navDrawer.scrollTop = 0;
  }
});

// Close Nav When Clicking Outside
document.addEventListener('click', (event) => {
  const isClickInsideNav = navDrawer.contains(event.target);
  const isClickOnHamburger = hamburgerBtn.contains(event.target);
  if (!isClickInsideNav && !isClickOnHamburger && navDrawer.classList.contains('open')) {
    navDrawer.classList.remove('open');
    hamburgerBtn.classList.remove('active');
    overlay.classList.remove('nav-open');
  }
});

// Theme Toggle
const themeToggle = document.getElementById('theme-toggle');
themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('light-theme');
  const icon = themeToggle.querySelector('i');
  icon.classList.toggle('fa-moon');
  icon.classList.toggle('fa-sun');
});

// Account Menu Toggle
const accountToggle = document.getElementById('account-toggle');
const submenu = accountToggle.nextElementSibling;
accountToggle.addEventListener('click', (e) => {
  e.preventDefault();
  submenu.classList.toggle('open');
});

// Back to Top
document.getElementById('back-to-top').addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Time Updates
function updateLocalTime() {
  const now = new Date();
  document.getElementById('localTime').textContent = now.toLocaleTimeString();
  document.getElementById('localDate').textContent = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}
setInterval(updateLocalTime, 1000);
updateLocalTime();

function updateUTCTime() {
  document.getElementById('utcTime').textContent = new Date().toUTCString();
}
setInterval(updateUTCTime, 1000);
updateUTCTime();

// Initialize Settings Page
async function initSettingsPage() {
  // Check Authentication
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
  if (!user || authError) {
    window.location.href = 'login.html';
    return;
  }

  // Load Profile
  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  if (profileError) {
    console.error('Error loading profile:', profileError);
    alert('Error loading profile.');
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

  // Load User Settings
  const { data: settings, error: settingsError } = await supabaseClient
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .single();
  if (settingsError && settingsError.code !== 'PGRST116') { // PGRST116: No rows found
    console.error('Error loading settings:', settingsError);
    alert('Error loading settings.');
    return;
  }

  if (settings) {
    document.getElementById('displayName').value = settings.display_name || '';
    document.getElementById('timezone').value = settings.timezone || 'UTC';
    document.getElementById('locale').value = settings.locale || 'en-US';
    document.getElementById('themeMode').value = settings.theme_mode || 'light';
    document.getElementById('accentColor').value = settings.accent_color || '#ffd700';
    document.getElementById('fontSize').value = settings.font_size || 'medium';
    document.getElementById('notifyEmail').checked = settings.notify_email || false;
    document.getElementById('notifySMS').checked = settings.notify_sms || false;
    document.getElementById('notifyPush').checked = settings.notify_push || false;
    document.getElementById('digestFrequency').value = settings.digest_frequency || 'instant';
    document.getElementById('twoFactorEnabled').checked = settings.two_factor_enabled || false;
  }

  // Populate Timezone Options
  const timezoneSelect = document.getElementById('timezone');
  const timezones = Intl.supportedValuesOf('timeZone');
  timezones.forEach(tz => {
    const option = document.createElement('option');
    option.value = tz;
    option.textContent = tz;
    timezoneSelect.appendChild(option);
  });

  // Handle Form Submission
  document.getElementById('settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const settingsData = {
      user_id: user.id,
      display_name: formData.get('displayName'),
      timezone: formData.get('timezone'),
      locale: formData.get('locale'),
      theme_mode: formData.get('themeMode'),
      accent_color: formData.get('accentColor'),
      font_size: formData.get('fontSize'),
      notify_email: formData.get('notifyEmail') === 'on',
      notify_sms: formData.get('notifySMS') === 'on',
      notify_push: formData.get('notifyPush') === 'on',
      digest_frequency: formData.get('digestFrequency'),
      two_factor_enabled: formData.get('twoFactorEnabled') === 'on',
      updated_at: new Date().toISOString()
    };

    // Handle Avatar Upload
    const avatarFile = formData.get('avatarUpload');
    if (avatarFile && avatarFile.size > 0) {
      const fileName = `${user.id}_${Date.now()}_${avatarFile.name}`;
      const { error: uploadError } = await supabaseClient.storage
        .from('profile-photos')
        .upload(fileName, avatarFile, { upsert: true });
      if (uploadError) {
        console.error('Error uploading avatar:', uploadError);
        alert('Error uploading avatar.');
        return;
      }
      settingsData.avatar_url = fileName;
      // Update profile photo_url in profiles table
      const { error: profileUpdateError } = await supabaseClient
        .from('profiles')
        .update({ photo_url: fileName })
        .eq('id', user.id);
      if (profileUpdateError) {
        console.error('Error updating profile photo:', profileUpdateError);
        alert('Error updating profile photo.');
        return;
      }
    }

    // Save Settings
    const { error: saveError } = await supabaseClient
      .from('user_settings')
      .upsert(settingsData, { onConflict: 'user_id' });
    if (saveError) {
      console.error('Error saving settings:', saveError);
      alert('Error saving settings.');
    } else {
      alert('Settings saved successfully!');
      // Update UI
      if (settingsData.display_name) {
        document.getElementById('welcomeName').textContent = settingsData.display_name;
      }
      if (settingsData.avatar_url) {
        const { data: urlData } = supabaseClient.storage
          .from('profile-photos')
          .getPublicUrl(settingsData.avatar_url);
        document.getElementById('navProfilePhoto').src = urlData.publicUrl;
        document.getElementById('navProfilePhoto').style.display = 'block';
        document.getElementById('defaultProfileIcon').style.display = 'none';
      }
    }
  });
}

// Logout
document.getElementById('logout-btn').addEventListener('click', async () => {
  const { error } = await supabaseClient.auth.signOut();
  if (!error) window.location.href = 'login.html';
  else alert('Error logging out: ' + error.message);
});

// Ensure Video Playback
const video = document.querySelector('.bg-video');
video.addEventListener('canplay', () => {
  video.play().catch(error => {
    console.error('Error playing video:', error);
  });
});

initSettingsPage();
