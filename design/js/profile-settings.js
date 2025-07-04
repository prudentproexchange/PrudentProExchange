// Initialize AOS
AOS.init({ duration: 800, once: true });

// Supabase client
const { createClient } = supabase;
const supabaseClient = createClient(
  'https://iwkdznjqfbsfkscnbrkc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3a2R6bmpxZmJzZmtzY25icmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2Mjk2ODgsImV4cCI6MjA2NjIwNTY4OH0.eRiXpUKP0zAMI9brPHFMxdSwZITGHxu8BPRQprkAbiU'
);

// Utility functions
function showError(message) {
  const errorDiv = document.getElementById('settings-error');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  setTimeout(() => errorDiv.style.display = 'none', 5000);
}

function showLoading(show) {
  document.getElementById('settings-loading').style.display = show ? 'block' : 'none';
}

// Common UI
function initCommonUI() {
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const navDrawer = document.getElementById('navDrawer');
  const overlay = document.querySelector('.nav-overlay');
  const themeToggle = document.getElementById('theme-toggle');
  const accountToggle = document.getElementById('account-toggle');
  const submenu = accountToggle.nextElementSibling;
  const logoutBtn = document.getElementById('logout-btn');
  const jetButton = document.getElementById('jet-button');

  // Hamburger toggle
  hamburgerBtn.addEventListener('click', () => {
    navDrawer.classList.toggle('open');
    hamburgerBtn.classList.toggle('active');
    overlay.classList.toggle('nav-open');
    if (navDrawer.classList.contains('open')) {
      navDrawer.scrollTop = 0;
    }
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
  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const icon = themeToggle.querySelector('i');
    icon.classList.toggle('fa-moon');
    icon.classList.toggle('fa-sun');
  });

  // Account menu toggle
  accountToggle.addEventListener('click', (e) => {
    e.preventDefault();
    submenu.classList.toggle('open');
  });

  // Jet button
  jetButton.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Time updates
  function updateTime() {
    const now = new Date();
    document.getElementById('localTime').textContent = now.toLocaleTimeString();
    document.getElementById('localDate').textContent = now.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    document.getElementById('utcTime').textContent = now.toUTCString();
  }
  setInterval(updateTime, 1000);
  updateTime();

  logoutBtn.addEventListener('click', async () => {
    try {
      const { error } = await supabaseClient.auth.signOut();
      if (error) throw error;
      window.location.href = 'login.html';
    } catch (err) {
      showError('Error logging out: ' + err.message);
    }
  });
}

async function initProfileSettings() {
  showLoading(true);
  try {
    // Auth guard
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (!user || authError) {
      window.location.href = 'login.html';
      return;
    }

    const userId = user.id;

    // Load profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('first_name, photo_url')
      .eq('id', userId)
      .single();
    if (profileError) throw profileError;

    document.getElementById('welcomeName').textContent = profile.first_name || 'User';
    if (profile.photo_url) {
      const { data: urlData } = supabaseClient.storage
        .from('profile-photos')
        .getPublicUrl(profile.photo_url);
      document.getElementById('navProfilePhoto').src = urlData.publicUrl;
      document.getElementById('navProfilePhoto').style.display = 'block';
      document.getElementById('defaultProfileIcon').style.display = 'none';
    }

    // Load settings
    const { data: settings, error: settingsError } = await supabaseClient
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (settingsError && settingsError.code !== 'PGRST116') throw settingsError;

    // Populate form
    const form = document.getElementById('settingsForm');
    const settingsData = settings || {};
    form.displayName.value = settingsData.display_name || profile.first_name || '';
    form.timezone.value = settingsData.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    form.locale.value = settingsData.locale || 'en-US';
    form.themeMode.value = settingsData.theme_mode || 'light';
    form.accentColor.value = settingsData.accent_color || '#ffd700';
    form.fontSize.value = settingsData.font_size || 'medium';
    form.digestFrequency.value = settingsData.digest_frequency || 'instant';
    form.notifyEmail.checked = !!settingsData.notify_email;
    form.notifySMS.checked = !!settingsData.notify_sms;
    form.notifyPush.checked = !!settingsData.notify_push;

    // Timezone dropdown
    const tzSelect = form.timezone;
    tzSelect.innerHTML = '';
    Intl.supportedValuesOf('timeZone').forEach(tz => {
      const option = new Option(tz, tz);
      tzSelect.add(option);
    });
    tzSelect.value = settingsData.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Avatar upload preview
    form.avatarUpload.addEventListener('change', () => {
      if (form.avatarUpload.files[0]) {
        const reader = new FileReader();
        reader.onload = e => {
          document.getElementById('navProfilePhoto').src = e.target.result;
          document.getElementById('navProfilePhoto').style.display = 'block';
          document.getElementById('defaultProfileIcon').style.display = 'none';
        };
        reader.readAsDataURL(form.avatarUpload.files[0]);
      }
    });

    // Form submission
    form.addEventListener('submit', async e => {
      e.preventDefault();
      showLoading(true);
      try {
        const updates = {
          user_id: userId,
          display_name: form.displayName.value,
          timezone: form.timezone.value,
          locale: form.locale.value,
          theme_mode: form.themeMode.value,
          accent_color: form.accentColor.value,
          font_size: form.fontSize.value,
          notify_email: form.notifyEmail.checked,
          notify_sms: form.notifySMS.checked,
          notify_push: form.notifyPush.checked,
          digest_frequency: form.digestFrequency.value,
          updated_at: new Date().toISOString()
        };

        // Avatar upload
        if (form.avatarUpload.files[0]) {
          const file = form.avatarUpload.files[0];
          const path = `${userId}/${Date.now()}_${file.name}`;
          const { error: uploadError } = await supabaseClient.storage
            .from('profile-photos')
            .upload(path, file, { upsert: true });
          if (uploadError) throw uploadError;
          updates.avatar_url = path;
          const { error: profileError } = await supabaseClient
            .from('profiles')
            .update({ photo_url: path })
            .eq('id', userId);
          if (profileError) throw profileError;
        }

        const { error } = await supabaseClient
          .from('user_settings')
          .upsert(updates, { onConflict: 'user_id' });
        if (error) throw error;
        alert('Settings saved successfully!');
      } catch (err) {
        showError('Error saving settings: ' + err.message);
      } finally {
        showLoading(false);
      }
    });
  } catch (err) {
    showError('Error loading profile: ' + err.message);
  } finally {
    showLoading(false);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  initCommonUI();
  initProfileSettings();
});

// Video background
const video = document.querySelector('.bg-video');
video.addEventListener('canplay', () => {
  video.play().catch(error => console.error('Error playing video:', error));
});
