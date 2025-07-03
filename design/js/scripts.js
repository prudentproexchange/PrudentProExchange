// scripts.js

// 1) Initialize AOS and Supabase
window.addEventListener('DOMContentLoaded', () => {
  AOS.init({ duration: 800, once: true });
});

const SUPABASE_URL = 'https://iwkdznjqfbsfkscnbrkc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3a2R6bmpxZmJzZmtzY25icmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2Mjk2ODgsImV4cCI6MjA2NjIwNTY4OH0.eRiXpUKP0zAMI9brPHFMxdSwZITGHxu8BPRQprkAbiU';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Utility: update clocks
function updateTimes() {
  const now = new Date();
  document.getElementById('localTime').textContent = now.toLocaleTimeString('en-US', { hour12: true });
  document.getElementById('localDate').textContent = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  document.getElementById('utcTime').textContent = now.toUTCString();
}

// 2) Main initializer
document.addEventListener('DOMContentLoaded', async () => {
  updateTimes();
  setInterval(updateTimes, 1000);

  // --- Header & Nav toggles ---
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const navDrawer    = document.getElementById('navDrawer');
  const overlay      = document.querySelector('.nav-overlay');

  hamburgerBtn.addEventListener('click', () => {
    const open = navDrawer.classList.toggle('open');
    hamburgerBtn.classList.toggle('active');
    hamburgerBtn.setAttribute('aria-expanded', open);
    overlay.classList.toggle('nav-open', open);
  });

  overlay.addEventListener('click', () => {
    navDrawer.classList.remove('open');
    hamburgerBtn.classList.remove('active');
    hamburgerBtn.setAttribute('aria-expanded', 'false');
    overlay.classList.remove('nav-open');
  });

  document.addEventListener('click', (e) => {
    if (!navDrawer.contains(e.target) && !hamburgerBtn.contains(e.target) && navDrawer.classList.contains('open')) {
      navDrawer.classList.remove('open');
      hamburgerBtn.classList.remove('active');
      hamburgerBtn.setAttribute('aria-expanded', 'false');
      overlay.classList.remove('nav-open');
    }
  });

  // Account submenu
  const accountToggle = document.getElementById('account-toggle');
  const submenu       = accountToggle.nextElementSibling;
  accountToggle.addEventListener('click', (e) => {
    e.preventDefault();
    const isOpen = submenu.classList.toggle('open');
    accountToggle.setAttribute('aria-expanded', isOpen);
  });

  // Theme toggle
  document.getElementById('theme-toggle').addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const icon = document.querySelector('#theme-toggle i');
    icon.classList.toggle('fa-moon');
    icon.classList.toggle('fa-sun');
  });

  // Back to top
  document.getElementById('back-to-top').addEventListener('click', () =>
    window.scrollTo({ top: 0, behavior: 'smooth' })
  );

  // --- Authentication & Data Loading ---
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    document.querySelector('.welcome-message').textContent = 'Please log in.';
    return;
  }

  // 3) Load Profile for Header
  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('first_name, photo_url')
    .eq('id', user.id)
    .single();

  const welcomeEl      = document.querySelector('.welcome-message');
  const navPhotoEl     = document.getElementById('navProfilePhoto');
  const defaultIconEl  = document.getElementById('defaultProfileIcon');

  if (profErr) {
    console.error('Profile load error:', profErr);
    welcomeEl.textContent = `Welcome back!`;
  } else {
    welcomeEl.textContent = `Hello, ${profile.first_name || 'User'}!`;
    if (profile.photo_url) {
      const { data: urlData } = supabase
        .storage.from('profile-photos')
        .getPublicUrl(profile.photo_url);
      navPhotoEl.src = urlData.publicUrl;
      navPhotoEl.style.display = 'block';
      defaultIconEl.style.display = 'none';
    }
  }

  // 4) Load & Populate Settings Form
  const settingsRes = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .single();

  let settings = settingsRes.data;
  if (settingsRes.error && settingsRes.error.code === 'PGRST116') {
    // create defaults
    const insertRes = await supabase
      .from('user_settings')
      .insert({ user_id: user.id })
      .select().single();
    settings = insertRes.data;
  }

  // Populate your form fields here...
  // e.g. document.getElementById('display-name').value = settings.display_name || '';

  // 5) Avatar preview logic in Settings (if you have it)
  const avatarInput  = document.getElementById('avatar');
  const avatarPreview= document.getElementById('avatar-preview');
  if (avatarInput && avatarPreview) {
    avatarInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => avatarPreview.src = reader.result;
        reader.readAsDataURL(file);
      }
    });
  }

  // 6) (Continue wiring up your Settings forms, upserts, etc.)
  //    Use the same upsertSettings() helper from before.

}); // end DOMContentLoaded
