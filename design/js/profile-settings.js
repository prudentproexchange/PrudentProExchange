// Initialize AOS
AOS.init({ duration: 800, once: true });

// Supabase client
const { createClient } = supabase;
const supabaseClient = createClient(
  'https://iwkdznjqfbsfkscnbrkc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3a2R6bmpxZmJzZmtzY25icmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2Mjk2ODgsImV4cCI6MjA2NjIwNTY4OH0.eRiXpUKP0zAMI9brPHFMxdSwZITGHxu8BPRQprkAbiU'
);

// Utility functions
function showError(elementId, message) {
  const errorDiv = document.getElementById(elementId);
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  setTimeout(() => (errorDiv.style.display = 'none'), 5000);
}

function formatDateTime(timestamp) {
  return new Date(timestamp).toLocaleString();
}

// Hamburger menu toggle
const hamburgerBtn = document.getElementById('hamburgerBtn');
const navDrawer = document.getElementById('navDrawer');
const overlay = document.querySelector('.nav-overlay');
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
const themeToggle = document.getElementById('theme-toggle');
themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('light-theme');
  const icon = themeToggle.querySelector('i');
  icon.classList.toggle('fa-moon');
  icon.classList.toggle('fa-sun');
});

// Account menu toggle
const accountToggle = document.getElementById('account-toggle');
const submenu = accountToggle.nextElementSibling;
accountToggle.addEventListener('click', (e) => {
  e.preventDefault();
  submenu.classList.toggle('open');
});

// Back to top
document.getElementById('back-to-top').addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Time updates
function updateLocalTime() {
  const now = new Date();
  document.getElementById('localTime').textContent = now.toLocaleTimeString();
  document.getElementById('localDate').textContent = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
setInterval(updateLocalTime, 1000);
updateLocalTime();

function updateUTCTime() {
  document.getElementById('utcTime').textContent = new Date().toUTCString();
}
setInterval(updateUTCTime, 1000);
updateUTCTime();

// Populate timezone dropdown
function populateTimezones() {
  const timezoneSelect = document.getElementById('timezone');
  const timezones = Intl.supportedValuesOf('timeZone');
  timezones.forEach((tz) => {
    const option = document.createElement('option');
    option.value = tz;
    option.textContent = tz;
    timezoneSelect.appendChild(option);
  });
}

// Initialize settings page
async function initSettingsPage() {
  try {
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (!user || authError) {
      window.location.href = 'login.html';
      return;
    }

    // Load profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
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

    // Load user settings
    const { data: settings, error: settingsError } = await supabaseClient
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();
    if (settingsError && settingsError.code !== 'PGRST116') throw settingsError;

    if (settings) {
      document.getElementById('display-name').value = settings.display_name || '';
      document.getElementById('timezone').value = settings.timezone || 'UTC';
      document.getElementById('locale').value = settings.locale || 'en-US';
      document.getElementById('theme-mode').value = settings.theme_mode || 'light';
      document.getElementById('accent-color').value = settings.accent_color || '#ffd700';
      document.getElementById('font-size').value = settings.font_size || 'medium';
      document.getElementById('notify-email').checked = settings.notify_email || false;
      document.getElementById('notify-sms').checked = settings.notify_sms || false;
      document.getElementById('notify-push').checked = settings.notify_push || false;
      document.getElementById('digest-frequency').value = settings.digest_frequency || 'instant';
      document.getElementById('two-factor-enabled').checked = settings.two_factor_enabled || false;
    }

    // Load API keys
    await loadApiKeys(user.id);

    // Load webhooks
    await loadWebhooks(user.id);

    // Load connected services
    await loadConnectedServices(user.id);
  } catch (error) {
    console.error('Settings page initialization error:', error);
    showError('profile-error', 'An error occurred while loading settings.');
  }
}

// Load API keys
async function loadApiKeys(userId) {
  const apiKeysLoading = document.getElementById('api-keys-loading');
  apiKeysLoading.style.display = 'block';
  try {
    const { data: apiKeys, error } = await supabaseClient
      .from('api_keys')
      .select('*')
      .eq('owner_id', userId);
    if (error) throw error;

    const container = document.getElementById('api-keys-container');
    container.innerHTML = '';
    apiKeys.forEach((key) => {
      const keyDiv = document.createElement('div');
      keyDiv.className = 'api-key-item';
      keyDiv.dataset.id = key.id;
      keyDiv.innerHTML = `
        <p>Key: ${key.key} (Created: ${formatDateTime(key.created_at)})</p>
        <button class="delete-api-key-btn">Delete</button>
      `;
      container.appendChild(keyDiv);

      keyDiv.querySelector('.delete-api-key-btn').addEventListener('click', async () => {
        if (!confirm('Are you sure you want to delete this API key?')) return;
        try {
          const { error } = await supabaseClient.from('api_keys').delete().eq('id', key.id);
          if (error) throw error;
          keyDiv.remove();
        } catch (err) {
          showError('api-keys-error', 'Error deleting API key: ' + err.message);
        }
      });
    });
  } catch (error) {
    showError('api-keys-error', 'Error loading API keys: ' + error.message);
  } finally {
    apiKeysLoading.style.display = 'none';
  }
}

// Load webhooks
async function loadWebhooks(userId) {
  const webhooksLoading = document.getElementById('webhooks-loading');
  webhooksLoading.style.display = 'block';
  try {
    const { data: webhooks, error } = await supabaseClient
      .from('webhooks')
      .select('*')
      .eq('owner_id', userId);
    if (error) throw error;

    const container = document.getElementById('webhooks-container');
    container.innerHTML = '';
    webhooks.forEach((webhook) => {
      const webhookDiv = document.createElement('div');
      webhookDiv.className = 'webhook-item';
      webhookDiv.dataset.id = webhook.id;
      webhookDiv.innerHTML = `
        <p>URL: ${webhook.url} (Created: ${formatDateTime(webhook.created_at)})</p>
        <button class="delete-webhook-btn">Delete</button>
      `;
      container.appendChild(webhookDiv);

      webhookDiv.querySelector('.delete-webhook-btn').addEventListener('click', async () => {
        if (!confirm('Are you sure you want to delete this webhook?')) return;
        try {
          const { error } = await supabaseClient.from('webhooks').delete().eq('id', webhook.id);
          if (error) throw error;
          webhookDiv.remove();
        } catch (err) {
          showError('webhook-error', 'Error deleting webhook: ' + err.message);
        }
      });
    });
  } catch (error) {
    showError('webhook-error', 'Error loading webhooks: ' + error.message);
  } finally {
    webhooksLoading.style.display = 'none';
  }
}

// Load connected services
async function loadConnectedServices(userId) {
  const servicesLoading = document.getElementById('connected-services-loading');
  servicesLoading.style.display = 'block';
  try {
    const { data: services, error } = await supabaseClient
      .from('connected_services')
      .select('*')
      .eq('owner_id', userId);
    if (error) throw error;

    const container = document.getElementById('connected-services-container');
    container.innerHTML = '';
    services.forEach((service) => {
      const serviceDiv = document.createElement('div');
      serviceDiv.className = 'connected-service-item';
      serviceDiv.dataset.id = service.id;
      serviceDiv.innerHTML = `
        <p>Service: ${service.service_name} (Connected: ${formatDateTime(service.connected_at)})</p>
        <button class="disconnect-service-btn">Disconnect</button>
      `;
      container.appendChild(serviceDiv);

      serviceDiv.querySelector('.disconnect-service-btn').addEventListener('click', async () => {
        if (!confirm(`Are you sure you want to disconnect ${service.service_name}?`)) return;
        try {
          const { error } = await supabaseClient.from('connected_services').delete().eq('id', service.id);
          if (error) throw error;
          serviceDiv.remove();
        } catch (err) {
          showError('connected-services-error', 'Error disconnecting service: ' + err.message);
        }
      });
    });
  } catch (error) {
    showError('connected-services-error', 'Error loading connected services: ' + error.message);
  } finally {
    servicesLoading.style.display = 'none';
  }
}

// Form submissions
document.getElementById('profile-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const displayName = document.getElementById('display-name').value;
  const avatarFile = document.getElementById('avatar-upload').files[0];

  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    let avatarUrl = null;
    if (avatarFile) {
      const fileName = `${user.id}/${Date.now()}_${avatarFile.name}`;
      const { error: uploadError } = await supabaseClient.storage
        .from('profile-photos')
        .upload(fileName, avatarFile);
      if (uploadError) throw uploadError;
      avatarUrl = fileName;
    }

    const updates = {
      user_id: user.id,
      display_name: displayName,
      ...(avatarUrl && { avatar_url: avatarUrl }),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabaseClient.from('user_settings').upsert(updates);
    if (error) throw error;

    if (avatarUrl) {
      const { data: urlData } = supabaseClient.storage.from('profile-photos').getPublicUrl(avatarUrl);
      document.getElementById('navProfilePhoto').src = urlData.publicUrl;
      document.getElementById('navProfilePhoto').style.display = 'block';
      document.getElementById('defaultProfileIcon').style.display = 'none';
    }

    alert('Profile updated successfully.');
  } catch (error) {
    showError('profile-error', 'Error updating profile: ' + error.message);
  }
});

document.getElementById('appearance-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const updates = {
      user_id: user.id,
      timezone: document.getElementById('timezone').value,
      locale: document.getElementById('locale').value,
      theme_mode: document.getElementById('theme-mode').value,
      accent_color: document.getElementById('accent-color').value,
      font_size: document.getElementById('font-size').value,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabaseClient.from('user_settings').upsert(updates);
    if (error) throw error;

    // Apply theme and font size dynamically
    document.body.classList.remove('light-theme');
    if (updates.theme_mode === 'light') document.body.classList.add('light-theme');
    document.body.style.fontSize = updates.font_size === 'small' ? '14px' : updates.font_size === 'large' ? '18px' : '16px';
    document.documentElement.style.setProperty('--primary', updates.accent_color);

    alert('Appearance settings updated successfully.');
  } catch (error) {
    showError('appearance-error', 'Error updating appearance settings: ' + error.message);
  }
});

document.getElementById('notifications-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const updates = {
      user_id: user.id,
      notify_email: document.getElementById('notify-email').checked,
      notify_sms: document.getElementById('notify-sms').checked,
      notify_push: document.getElementById('notify-push').checked,
      digest_frequency: document.getElementById('digest-frequency').value,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabaseClient.from('user_settings').upsert(updates);
    if (error) throw error;

    alert('Notification preferences updated successfully.');
  } catch (error) {
    showError('notifications-error', 'Error updating notification preferences: ' + error.message);
  }
});

document.getElementById('save-two-factor-btn').addEventListener('click', async () => {
  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const updates = {
      user_id: user.id,
      two_factor_enabled: document.getElementById('two-factor-enabled').checked,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabaseClient.from('user_settings').upsert(updates);
    if (error) throw error;

    alert('2FA settings updated successfully.');
  } catch (error) {
    showError('two-factor-error', 'Error updating 2FA settings: ' + error.message);
  }
});

document.getElementById('generate-api-key-btn').addEventListener('click', async () => {
  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const newKey = crypto.randomUUID();
    const { error } = await supabaseClient.from('api_keys').insert({
      owner_id: user.id,
      key: newKey,
      created_at: new Date().toISOString(),
    });
    if (error) throw error;

    await loadApiKeys(user.id);
    alert('API key generated successfully.');
  } catch (error) {
    showError('api-keys-error', 'Error generating API key: ' + error.message);
  }
});

document.getElementById('webhook-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = document.getElementById('webhook-url').value;

  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabaseClient.from('webhooks').insert({
      owner_id: user.id,
      url,
      created_at: new Date().toISOString(),
    });
    if (error) throw error;

    document.getElementById('webhook-form').reset();
    await loadWebhooks(user.id);
    alert('Webhook added successfully.');
  } catch (error) {
    showError('webhook-error', 'Error adding webhook: ' + error.message);
  }
});

// Logout
document.getElementById('logout-btn').addEventListener('click', async () => {
  const { error } = await supabaseClient.auth.signOut();
  if (!error) window.location.href = 'login.html';
  else showError('profile-error', 'Error logging out: ' + error.message);
});

// Initialize page
(async () => {
  populateTimezones();
  await initSettingsPage();
})();
