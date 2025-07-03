// scripts.js

// 1) Initialize Supabase client
const SUPABASE_URL = 'https://iwkdznjqfbsfkscnbrkc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3a2R6bmpxZmJzZmtzY25icmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2Mjk2ODgsImV4cCI6MjA2NjIwNTY4OH0.eRiXpUKP0zAMI9brPHFMxdSwZITGHxu8BPRQprkAbiU';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const tabButtons    = document.querySelectorAll('.tab-button');
  const tabPanes      = document.querySelectorAll('.tab-pane');
  const avatarInput   = document.getElementById('avatar');
  const avatarPreview = document.getElementById('avatar-preview');

  // Forms
  const profileForm       = document.querySelector('#profile form');
  const themeForm         = document.querySelector('#theme form');
  const notificationsForm = document.querySelector('#notifications form');

  // Buttons
  const exportBtn    = document.getElementById('export-data');
  const deleteBtn    = document.getElementById('delete-account');
  const genApiKeyBtn = document.getElementById('generate-api-key');
  const webhookForm  = document.getElementById('webhook-form');

  // Lists
  const apiKeysList  = document.getElementById('api-keys-list');
  const webhooksList = document.getElementById('webhooks-list');
  const servicesList = document.getElementById('connected-services');

  // Tab switching
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      tabButtons.forEach(b => b.classList.toggle('active', b === btn));
      tabPanes.forEach(p => p.classList.toggle('active', p.id === tabId));
    });
  });

  // Avatar preview
  avatarInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => avatarPreview.src = reader.result;
      reader.readAsDataURL(file);
    }
  });

  // Fetch current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    alert('Not logged in');
    return;
  }

  // Load or initialize settings
  let { data: settings, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error && error.code === 'PGRST116') {
    // No settings row yet
    const { data: newSettings, error: insertErr } = await supabase
      .from('user_settings')
      .insert({ user_id: user.id })
      .select()
      .single();
    settings = newSettings;
  }

  // Populate form fields
  document.getElementById('display-name').value    = settings.display_name || '';
  document.getElementById('timezone').value        = settings.timezone;
  document.getElementById('locale').value          = settings.locale;
  document.querySelector(`input[name="theme-mode"][value="${settings.theme_mode}"]`).checked = true;
  document.getElementById('accent-color').value    = settings.accent_color;
  document.getElementById('font-size').value       = settings.font_size;
  document.querySelector(`input[name="email"]`).checked = settings.notify_email;
  document.querySelector(`input[name="sms"]`).checked   = settings.notify_sms;
  document.querySelector(`input[name="push"]`).checked  = settings.notify_push;
  document.querySelector(`input[name="digest"][value="${settings.digest_frequency}"]`).checked = true;
  if (settings.avatar_url) avatarPreview.src = settings.avatar_url;

  // Helper to upsert settings
  async function upsertSettings(patch) {
    const { error } = await supabase
      .from('user_settings')
      .upsert({ user_id: user.id, ...patch }, { onConflict: 'user_id' });
    if (error) console.error('Upsert error:', error);
  }

  // Profile form submission
  profileForm.addEventListener('submit', async e => {
    e.preventDefault();
    const nameVal = document.getElementById('display-name').value;
    let patch = { display_name: nameVal };

    if (avatarInput.files.length) {
      const file = avatarInput.files[0];
      const path = `${user.id}/${file.name}`;
      const { error: uploadErr } = await supabase
        .storage.from('avatars')
        .upload(path, file, { upsert: true });
      if (uploadErr) { console.error(uploadErr); return; }
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      patch.avatar_url = data.publicUrl;
      avatarPreview.src = data.publicUrl;
    }

    await upsertSettings(patch);
    alert('Profile saved');
  });

  // Theme form submission
  themeForm.addEventListener('submit', async e => {
    e.preventDefault();
    await upsertSettings({
      theme_mode: document.querySelector('input[name="theme-mode"]:checked').value,
      accent_color: document.getElementById('accent-color').value,
      font_size: document.getElementById('font-size').value,
    });
    alert('Appearance applied');
  });

  // Notifications form submission
  notificationsForm.addEventListener('submit', async e => {
    e.preventDefault();
    await upsertSettings({
      notify_email: document.querySelector('input[name="email"]').checked,
      notify_sms: document.querySelector('input[name="sms"]').checked,
      notify_push: document.querySelector('input[name="push"]').checked,
      digest_frequency: document.querySelector('input[name="digest"]:checked').value,
    });
    alert('Notifications saved');
  });

  // Privacy actions
  exportBtn.addEventListener('click', () => {
    window.open(`/api/export?user_id=${user.id}`, '_blank');
  });

  deleteBtn.addEventListener('click', async () => {
    if (!confirm('Really delete your account? This is irreversible.')) return;
    const { error } = await supabase.auth.deleteUser();
    if (error) console.error(error);
    else alert('Account deleted');
  });

  // API Keys
  async function loadApiKeys() {
    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('owner_id', user.id);
    if (error) return console.error(error);
    apiKeysList.innerHTML = data.map(k =>
      `<li>${k.key} <button data-id="${k.id}" class="delete-key">🗑️</button></li>`
    ).join('');
    apiKeysList.querySelectorAll('.delete-key')
      .forEach(btn => btn.addEventListener('click', async () => {
        await supabase.from('api_keys').delete().eq('id', btn.dataset.id);
        loadApiKeys();
      }));
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
    const { data, error } = await supabase
      .from('webhooks')
      .select('*')
      .eq('owner_id', user.id);
    if (error) return console.error(error);
    webhooksList.innerHTML = data.map(w =>
      `<li>${w.url} <button data-id="${w.id}" class="delete-webhook">🗑️</button></li>`
    ).join('');
    webhooksList.querySelectorAll('.delete-webhook')
      .forEach(btn => btn.addEventListener('click', async () => {
        await supabase.from('webhooks').delete().eq('id', btn.dataset.id);
        loadWebhooks();
      }));
  }

  // Connected Services
  async function loadServices() {
    const { data, error } = await supabase
      .from('connected_services')
      .select('*')
      .eq('owner_id', user.id);
    if (error) return console.error(error);
    servicesList.innerHTML = data.map(s =>
      `<li>${s.service_name} (connected at ${new Date(s.connected_at).toLocaleString()})</li>`
    ).join('');
  }

  // Initial data loads
  loadApiKeys();
  loadWebhooks();
  loadServices();
});
