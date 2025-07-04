// profile-settings.js

document.addEventListener('DOMContentLoaded', initSettingsPage);

async function initSettingsPage() {
  // Initialize AOS animations
  if (typeof AOS !== 'undefined') AOS.init({ duration: 800, once: true });

  // Initialize Supabase client
  const { createClient } = supabase;
  const supabaseClient = createClient(
    'https://iwkdznjqfbsfkscnbrkc.supabase.co',
    'YOUR_ANON_KEY_HERE'
  );

  // COMMON UI wiring (hamburger, theme, nav, logout, back-to-top, clocks)
  initCommonUI(supabaseClient);

  // AUTH: get user
  const { data: { user }, error: authErr } = await supabaseClient.auth.getUser();
  if (authErr || !user) {
    return window.location.href = 'login.html';
  }

  // Load and display profile (first_name + photo_url)
  const { data: profile, error: profErr } = await supabaseClient
    .from('profiles')
    .select('first_name,photo_url')
    .eq('id', user.id)
    .single();
  if (profErr) {
    return alert('Error loading your profile.');
  }
  document.getElementById('welcomeName').textContent = profile.first_name || 'User';
  if (profile.photo_url) {
    const { data: urlData } = supabaseClient.storage
      .from('profile-photos')
      .getPublicUrl(profile.photo_url);
    const img = document.getElementById('navProfilePhoto');
    img.src = urlData.publicUrl;
    img.style.display = 'block';
    document.getElementById('defaultProfileIcon').style.display = 'none';
  }

  // Load or initialize user_settings
  const { data: settings, error: setErr } = await supabaseClient
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (setErr && setErr.code !== 'PGRST116') {
    return alert('Error loading your settings.');
  }

  // Populate form fields if settings exist
  if (settings) {
    document.getElementById('displayName').value     = settings.display_name || '';
    document.getElementById('timezone').value        = settings.timezone || 'UTC';
    document.getElementById('locale').value          = settings.locale || 'en-US';
    document.getElementById('themeMode').value       = settings.theme_mode || 'light';
    document.getElementById('accentColor').value     = settings.accent_color || '#ffd700';
    document.getElementById('fontSize').value        = settings.font_size || 'medium';
    document.getElementById('notifyEmail').checked   = settings.notify_email;
    document.getElementById('notifySMS').checked     = settings.notify_sms;
    document.getElementById('notifyPush').checked    = settings.notify_push;
    document.getElementById('digestFrequency').value = settings.digest_frequency || 'instant';
    document.getElementById('twoFactorEnabled').checked = settings.two_factor_enabled;
  }

  // Populate timezone dropdown
  const tzSelect = document.getElementById('timezone');
  Intl.supportedValuesOf('timeZone').forEach(tz => {
    const o = document.createElement('option');
    o.value = o.textContent = tz;
    tzSelect.append(o);
  });

  // Handle form submission
  document.getElementById('settingsForm').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);

    // Build upsert payload
    const payload = {
      user_id: user.id,
      display_name:   fd.get('displayName'),
      timezone:       fd.get('timezone'),
      locale:         fd.get('locale'),
      theme_mode:     fd.get('themeMode'),
      accent_color:   fd.get('accentColor'),
      font_size:      fd.get('fontSize'),
      notify_email:   fd.get('notifyEmail') === 'on',
      notify_sms:     fd.get('notifySMS') === 'on',
      notify_push:    fd.get('notifyPush') === 'on',
      digest_frequency: fd.get('digestFrequency'),
      two_factor_enabled: fd.get('twoFactorEnabled') === 'on',
      updated_at:     new Date().toISOString()
    };

    // Handle avatar upload if file selected
    const file = fd.get('avatarUpload');
    if (file && file.size > 0) {
      const filename = `${user.id}_${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabaseClient.storage
        .from('profile-photos')
        .upload(filename, file, { upsert: true });
      if (uploadErr) {
        return alert('Avatar upload failed: ' + uploadErr.message);
      }
      // add to payload and update profiles table
      payload.avatar_url = filename;
      await supabaseClient
        .from('profiles')
        .update({ photo_url: filename })
        .eq('id', user.id);
    }

    // Upsert into user_settings
    const { error: saveErr } = await supabaseClient
      .from('user_settings')
      .upsert(payload, { onConflict: 'user_id' });
    if (saveErr) {
      return alert('Failed to save settings: ' + saveErr.message);
    }
    alert('Settings saved successfully!');
  });
}

// Reusable common UI initializer
function initCommonUI(supabaseClient) {
  // ... copy your hamburger, themeToggle, account menu, logout, backToTop & clock code here ...
  // For brevity, assume you paste the same block you already have.
}
