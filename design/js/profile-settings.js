// Initialize Supabase client
const supabaseClient = supabase.createClient(
  'https://iwkdznjqfbsfkscnbrkc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3a2R6bmpxZmJzZmtzY25icmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2Mjk2ODgsImV4cCI6MjA2NjIwNTY4OH0.eRiXpUKP0zAMI9brPHFMxdSwZITGHxu8BPRQprkAbiU'
);

let userId;

// Initialize Profile Settings Page
async function initProfileSettingsPage() {
  // Initialize AOS for animations
  AOS.init({ duration: 800, once: true });

  // Get current user
  const { data: authData, error: authErr } = await supabaseClient.auth.getUser();
  if (authErr || !authData.user) {
    return window.location.replace('login.html');
  }
  userId = authData.user.id;

  // Fetch profile data
  const { data: profile, error: profErr } = await supabaseClient
    .from('profiles')
    .select('first_name, photo_url')
    .eq('id', userId)
    .single();
  if (profErr) {
    return showError('Error loading profile: ' + profErr.message);
  }

  // Update UI with profile data
  document.getElementById('welcomeName').textContent = profile.first_name || 'User';
  if (profile.photo_url) {
    const { data: urlData } = supabaseClient.storage.from('profile-photos').getPublicUrl(profile.photo_url);
    const profilePhoto = document.getElementById('navProfilePhoto');
    profilePhoto.src = urlData.publicUrl;
    profilePhoto.style.display = 'block'; // Ensure the image is visible
    document.getElementById('defaultProfileIcon').style.display = 'none'; // Hide default icon
  }

  // Ensure settings content is visible
  const settingsContent = document.querySelector('.settings-content');
  if (settingsContent) {
    settingsContent.style.display = 'block'; // Force visibility
  }

  // Set up button event listeners
  setupEventListeners();
}

// Set up event listeners for interactive elements
function setupEventListeners() {
  // Theme toggle button
  const themeToggle = document.getElementById('theme-toggle');
  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const icon = themeToggle.querySelector('i');
    icon.classList.toggle('fa-moon');
    icon.classList.toggle('fa-sun');
  });

  // Three-dot (hamburger) navigation
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const navDrawer = document.getElementById('navDrawer');
  hamburgerBtn.addEventListener('click', () => {
    navDrawer.classList.toggle('open');
    hamburgerBtn.classList.toggle('active');
  });

  // Close navigation when clicking outside
  document.addEventListener('click', (event) => {
    const isClickInsideNav = navDrawer.contains(event.target);
    const isClickOnHamburger = hamburgerBtn.contains(event.target);
    if (!isClickInsideNav && !isClickOnHamburger && navDrawer.classList.contains('open')) {
      navDrawer.classList.remove('open');
      hamburgerBtn.classList.remove('active');
    }
  });

  // Save settings button
  const saveBtn = document.querySelector('.save-btn');
  saveBtn.addEventListener('click', () => {
    alert('Settings saved!');
    // Add your save logic here if needed
  });
}

// Helper function to display errors
function showError(msg) {
  const errorEl = document.getElementById('error-message');
  if (errorEl) {
    errorEl.textContent = msg;
    errorEl.style.display = 'block';
    setTimeout(() => errorEl.style.display = 'none', 5000);
  } else {
    alert(msg);
  }
}

// Start the page initialization
document.addEventListener('DOMContentLoaded', initProfileSettingsPage);
