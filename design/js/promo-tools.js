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
  const errorDiv = document.getElementById('promo-error');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  setTimeout(() => errorDiv.style.display = 'none', 5000);
}

function showLoading(show) {
  document.getElementById('promo-loading').style.display = show ? 'block' : 'none';
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

async function initPromoTools() {
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
      .select('first_name, photo_url, referral_code')
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

    // Referral link
    const referralLinkInput = document.getElementById('referralLink');
    const referralLink = `https://prudentproexchange.com/signup?ref=${profile.referral_code || ''}`;
    referralLinkInput.value = referralLink;

    // Copy link button
    document.getElementById('copyLinkBtn').addEventListener('click', () => {
      navigator.clipboard.writeText(referralLink).then(() => {
        alert('Referral link copied to clipboard!');
      }).catch(err => {
        showError('Error copying link: ' + err.message);
      });
    });

    // Promotional banners (placeholders, replace with actual paths)
    const banners = [
      { id: 'banner1', path: 'banners/banner1.jpg' },
      { id: 'banner2', path: 'banners/banner2.jpg' }
    ];
    banners.forEach(banner => {
      const img = document.getElementById(banner.id);
      const { data: urlData } = supabaseClient.storage
        .from('promotional-banners')
        .getPublicUrl(banner.path);
      img.src = urlData.publicUrl;
      const downloadBtn = document.querySelector(`.download-btn[data-banner="${banner.path}"]`);
      downloadBtn.href = urlData.publicUrl;
      downloadBtn.setAttribute('download', banner.path.split('/').pop());
    });

    // Social sharing
    const shareText = encodeURIComponent('Join PrudentProExchange and start investing today! ' + referralLink);
    document.getElementById('shareTwitter').href = `https://x.com/intent/tweet?text=${shareText}`;
    document.getElementById('shareLinkedIn').href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralLink)}`;

    // Referral stats
    const { data: referralData, error: referralError } = await supabaseClient
      .from('referrals')
      .select('action_type')
      .eq('referrer_id', userId);
    if (referralError) throw referralError;

    const clicks = referralData.filter(r => r.action_type === 'click').length;
    const signups = referralData.filter(r => r.action_type === 'signup').length;
    document.getElementById('referralClicks').textContent = clicks;
    document.getElementById('referralSignups').textContent = signups;
  } catch (err) {
    showError('Error loading promotional tools: ' + err.message);
  } finally {
    showLoading(false);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  initCommonUI();
  initPromoTools();
});

// Video background
const video = document.querySelector('.bg-video');
video.addEventListener('canplay', () => {
  video.play().catch(error => console.error('Error playing video:', error));
});
