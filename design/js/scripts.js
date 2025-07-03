// scripts.js

// 1) Initialize AOS and Supabase client
window.addEventListener('DOMContentLoaded', () => {
  AOS.init({ duration: 800, once: true });
});

// Supabase credentials
const SUPABASE_URL = 'https://iwkdznjqfbsfkscnbrkc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3a2R6bmpxZmJzZmtzY25icmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2Mjk2ODgsImV4cCI6MjA2NjIwNTY4OH0.eRiXpUKP0zAMI9brPHFMxdSwZITGHxu8BPRQprkAbiU';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 2) Utility: update clocks
function updateTimes() {
  const now = new Date();
  document.getElementById('localTime').textContent = now.toLocaleTimeString('en-US', { hour12: true });
  document.getElementById('localDate').textContent = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  document.getElementById('utcTime').textContent = now.toUTCString();
}

// 3) Main page setup
document.addEventListener('DOMContentLoaded', async () => {
  // start clocks
  updateTimes();
  setInterval(updateTimes, 1000);

  // Header / Nav
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
  document.addEventListener('click', e => {
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
  accountToggle.addEventListener('click', e => {
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

  // Tab navigation (settings page)
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabPanes   = document.querySelectorAll('.tab-pane');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });

  // Fetch user
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  const welcomeEl     = document.querySelector('.welcome-message');
  const navPhotoEl    = document.getElementById('navProfilePhoto');
  const defaultIconEl = document.getElementById('defaultProfileIcon');
  if (authErr || !user) {
    welcomeEl.textContent = 'Please log in.';
    return;
  }

  // Load profile
  const { data: profile, error: profErr } = await supabase
    .from('profiles').select('first_name, photo_url').eq('id', user.id).single();
  if (!profErr && profile) {
    welcomeEl.textContent = `Hello, ${profile.first_name || 'User'}!`;
    if (profile.photo_url) {
      const { data: urlData } = supabase.storage.from('profile-photos').getPublicUrl(profile.photo_url);
      navPhotoEl.src = urlData.publicUrl;
      navPhotoEl.style.display = 'block';
      defaultIconEl.style.display = 'none';
    }
  } else {
    console.error('Profile load error', profErr);
    welcomeEl.textContent = 'Welcome back!';
  }

  // Select form elements
  const avatarInput       = document.getElementById('avatar');
  const avatarPreview     = document.getElementById('avatar-preview');
  const profileForm       = document.querySelector('#profile form');
  const themeForm         = document.querySelector('#theme form');
  const notificationsForm = document.querySelector('#notifications form');
  const exportBtn         = document.getElementById('export-data');
  const deleteBtn         = document.getElementById('delete-account');
  const genApiKeyBtn      = document.getElementById('generate-api-key');
  const webhookForm       = document.getElementById('webhook-form');
  const apiKeysList       = document.getElementById('api-keys-list');
  const webhooksList      = document.getElementById('webhooks-list');
  const servicesList      = document.getElementById('connected-services');

  // Load or create user_settings
  let { data: settings, error: setErr } = await supabase
    .from('user_settings').select('*').eq('user_id', user.id).single();
  if (setErr && setErr.code === 'PGRST116') {
    const ins = await supabase.from('user_settings').insert({ user_id: user.id }).select().single();
    settings = ins.data;
  }
  // Populate settings fields
  document.getElementById('display-name').value       = settings.display_name || '';
  document.getElementById('timezone').value           = settings.timezone;
  document.getElementById('locale').value             = settings.locale;
  document.querySelector(`input[name="theme-mode"][value="${settings.theme_mode}"]`).checked = true;
  document.getElementById('accent-color').value       = settings.accent_color;
  document.getElementById('font-size').value          = settings.font_size;
  document.querySelector('input[name="email"]').checked = settings.notify_email;
  document.querySelector('input[name="sms"]').checked   = settings.notify_sms;
  document.querySelector('input[name="push"]').checked  = settings.notify_push;
  document.querySelector(`input[name="digest"][value="${settings.digest_frequency}"]`).checked = true;
  if (settings.avatar_url && avatarPreview) {
    avatarPreview.src = settings.avatar_url;
  }

  // Avatar preview in settings
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

  // upsert helper
  async function upsertSettings(patch) {
    const { error } = await supabase
      .from('user_settings')
      .upsert({ user_id: user.id, ...patch }, { onConflict: 'user_id' });
    if (error) console.error('Settings upsert error', error);
  }

  // Profile form submit
  profileForm.addEventListener('submit', async e => {
    e.preventDefault();
    const nameVal = document.getElementById('display-name').value;
    let patch = { display_name: nameVal };
    if (avatarInput.files.length) {
      const file = avatarInput.files[0];
      const path = `${user.id}/${file.name}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (upErr) { console.error(upErr); return; }
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      patch.avatar_url = data.publicUrl;
      avatarPreview.src = data.publicUrl;
    }
    await upsertSettings(patch);
    alert('Profile saved');
  });

  // Theme form submit
  themeForm.addEventListener('submit', async e => {
    e.preventDefault();
    await upsertSettings({
      theme_mode: document.querySelector('input[name="theme-mode"]:checked').value,
      accent_color: document.getElementById('accent-color').value,
      font_size: document.getElementById('font-size').value
    });
    alert('Appearance applied');
  });

  // Notifications form submit
  notificationsForm.addEventListener('submit', async e => {
    e.preventDefault();
    await upsertSettings({
      notify_email: document.querySelector('input[name="email"]').checked,
      notify_sms: document.querySelector('input[name="sms"]').checked,
      notify_push: document.querySelector('input[name="push"]').checked,
      digest_frequency: document.querySelector('input[name="digest"]:checked').value
    });
    alert('Notifications saved');
  });

  // Export & Delete actions
  exportBtn.addEventListener('click', () => window.open(`/api/export?user_id=${user.id}`, '_blank'));
  deleteBtn.addEventListener('click', async () => {
    if (!confirm('Delete account?')) return;
    const { error } = await supabase.auth.deleteUser();
    if (error) console.error(error); else alert('Account deleted');
  });

  // API Keys
  async function loadApiKeys() {
    const { data, error } = await supabase.from('api_keys').select('*').eq('owner_id', user.id);
    if (error) return console.error(error);
    apiKeysList.innerHTML = data.map(k =>
      `<li>${k.key} <button data-id="${k.id}" class="delete-key">🗑️</button></li>`
    ).join('');
    apiKeysList.querySelectorAll('.delete-key').forEach(btn => {
      btn.addEventListener('click', async () => {
        await supabase.from('api_keys').delete().eq('id', btn.dataset.id);
        loadApiKeys();
      });
    });
  }
  genApiKeyBtn.addEventListener('click', async () => {
    const newKey = crypto.randomUUID();
    await supabase.from('api_keys').insert({ owner_id: user.id, key: newKey });
    loadApiKeys();
  });

  // Webhooks
  webhookForm.addEventListener('submit', async e => {
    e.preventDefault();
    const url = webhookForm.querySelector('input[name="webhook-url"]').value;
    await supabase.from('webhooks').insert({ owner_id: user.id, url });
    webhookForm.reset();
    loadWebhooks();
  });
  async function loadWebhooks() {
    const { data, error } = await supabase.from('webhooks').select('*').eq('owner_id', user.id);
    if (error) return console.error(error);
    webhooksList.innerHTML = data.map(w =>
      `<li>${w.url} <button data-id="${w.id}" class="delete-webhook">🗑️</button></li>`
    ).join('');
    webhooksList.querySelectorAll('.delete-webhook').forEach(btn => {
      btn.addEventListener('click', async () => {
        await supabase.from('webhooks').delete().eq('id', btn.dataset.id);
        loadWebhooks();
      });
    });
  }

  // Connected Services
  async function loadServices() {
    const { data, error } = await supabase.from('connected_services').select('*').eq('owner_id', user.id);
    if (error) return console.error(error);
    servicesList.innerHTML = data.map(s =>
      `<li>${s.service_name} (connected at ${new Date(s.connected_at).toLocaleString()})</li>`
    ).join('');
  }

  // Initial loads
  loadApiKeys();
  loadWebhooks();
  loadServices();
});
