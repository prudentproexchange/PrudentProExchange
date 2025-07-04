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
  const errorDiv = document.getElementById('password-error');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  setTimeout(() => errorDiv.style.display = 'none', 5000);
}

function showLoading(show) {
  document.getElementById('password-loading').style.display = show ? 'block' : 'none';
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

async function initChangePassword() {
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

    // Form submission
    const form = document.getElementById('passwordForm');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      showLoading(true);
      try {
        const currentPassword = form.currentPassword.value;
        const newPassword = form.newPassword.value;
        const confirmPassword = form.confirmPassword.value;

        // Client-side validation
        if (newPassword.length < 6) {
          throw new Error('New password must be at least 6 characters long.');
        }
        if (newPassword !== confirmPassword) {
          throw new Error('New password and confirmation do not match.');
        }

        // Verify current password
        const { error: signInError } = await supabaseClient.auth.signInWithPassword({
          email: user.email,
          password: currentPassword
        });
        if (signInError) {
          throw new Error('Current password is incorrect.');
        }

        // Update password using RPC
        const { data, error } = await supabaseClient
          .rpc('change_user_password', {
            p_user_id: user.id,
            p_new_pass: newPassword
          });

        if (error) {
          throw new Error('Error changing password: ' + error.message);
        }

        alert('Password updated everywhere!');
        window.location.href = 'dashboard.html';
      } catch (err) {
        showError('Error changing password: ' + err.message);
      } finally {
        showLoading(false);
      }
    });
  } catch (err) {
    showError('Error loading page: ' + err.message);
  } finally {
    showLoading(false);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  initCommonUI();
  initChangePassword();
});

// Video background
const video = document.querySelector('.bg-video');
video.addEventListener('canplay', () => {
  video.play().catch(error => console.error('Error playing video:', error));
});
