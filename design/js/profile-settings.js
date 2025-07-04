// profile-settings.js

// 0) Bootstrap Supabase + hydrate any magic-link tokens
;(async () => {
  const { createClient } = supabase;
  window.supabaseClient = createClient(
    'https://iwkdznjqfbsfkscnbrkc.supabase.co',
    'YOUR_PUBLIC_ANON_KEY_HERE'      // ← swap in your anon key
  );
  // Grab session from URL fragment if present
  await supabaseClient.auth.getSessionFromUrl({ storeSession: true }).catch(console.error);

  // 1) DOM ready → wire up UI + page logic
  document.addEventListener('DOMContentLoaded', () => {
    initCommonUI();
    initSettingsPage();
  });
})();

// 2) Shared navigation/theme toggles, etc.
function initCommonUI() {
  // (copy over your hamburger, theme toggle, logout, time updates)
  // … same code you had in KYC’s initCommonUI …
}

// 3) Main Settings Page
async function initSettingsPage() {
  // 3.1) Ensure authenticated
  const { data: { user }, error: authErr } = await supabaseClient.auth.getUser();
  if (authErr || !user) {
    window.location.href = 'login.html';
    return;
  }

  // 3.2) Load profile row
  const { data: profile, error: profErr } = await supabaseClient
    .from('profiles')
    .select('first_name, last_name, email, photo_url')
    .eq('id', user.id)
    .single();
  if (profErr) {
    console.error('Error loading profile:', profErr);
    alert('Error loading your profile.');
    return;
  }

  // 3.3) Populate UI
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

  // 3.4) Load user settings (if any)
  const { data: settings, error: setErr } = await supabaseClient
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .single();
  if (setErr && setErr.code !== 'PGRST116') {
    console.error('Error loading settings:', setErr);
    alert('Error loading your settings.');
    return;
  }

  if (settings) {
    document.getElementById('displayName').value = settings.display_name || '';
    document.getElementById('timezone').value    = settings.timezone     || 'UTC';
    document.getElementById('locale').value      = settings.locale       || 'en-US';
    document.getElementById('themeMode').value   = settings.theme_mode   || 'light';
    document.getElementById('accentColor').value = settings.accent_color || '#ffd700';
    document.getElementById('fontSize').value    = settings.font_size    || 'medium';
    document.getElementById('notifyEmail').checked = settings.notify_email || false;
    document.getElementById('notifySMS').checked   = settings.notify_sms   || false;
    document.getElementById('notifyPush').checked  = settings.notify_push  || false;
    document.getElementById('digestFrequency').value = settings.digest_frequency || 'instant';
    document.getElementById('twoFactorEnabled').checked = settings.two_factor_enabled || false;
  }

  // 3.5) Populate timezone dropdown
  const tzSelect = document.getElementById('timezone');
  Intl.supportedValuesOf('timeZone').forEach(tz => {
    const opt = document.createElement('option');
    opt.value = tz; opt.textContent = tz;
    tzSelect.appendChild(opt);
  });

  // 3.6) Form submit
  document.getElementById('settingsForm').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      user_id: user.id,
      display_name: fd.get('displayName'),
      timezone:     fd.get('timezone'),
      locale:       fd.get('locale'),
      theme_mode:   fd.get('themeMode'),
      accent_color: fd.get('accentColor'),
      font_size:    fd.get('fontSize'),
      notify_email: fd.has('notifyEmail'),
      notify_sms:   fd.has('notifySMS'),
      notify_push:  fd.has('notifyPush'),
      digest_frequency: fd.get('digestFrequency'),
      two_factor_enabled: fd.has('twoFactorEnabled'),
      updated_at: new Date().toISOString(),
    };

    // 3.6a) Handle avatar upload if present
    const file = fd.get('avatarUpload');
    if (file && file.size > 0) {
      const name = `${user.id}_${Date.now()}_${file.name}`;
      const { error: upErr } = await supabaseClient.storage
        .from('profile-photos')
        .upload(name, file, { upsert: true });
      if (upErr) {
        console.error('Avatar upload error:', upErr);
        alert('Failed to upload avatar.');
        return;
      }
      payload.avatar_url = name;

      // update profiles.photo_url as well
      const { error: puErr } = await supabaseClient
        .from('profiles')
        .update({ photo_url: name })
        .eq('id', user.id);
      if (puErr) {
        console.error('Failed to update photo_url:', puErr);
        alert('Failed to save avatar reference.');
        return;
      }
    }

    // 3.6b) Upsert into user_settings
    const { error: saveErr } = await supabaseClient
      .from('user_settings')
      .upsert(payload, { onConflict: 'user_id' });
    if (saveErr) {
      console.error('Settings save error:', saveErr);
      alert('Failed to save settings.');
    } else {
      alert('Settings saved!');
      // reflect display name & avatar immediately
      if (payload.display_name) {
        document.getElementById('welcomeName').textContent = payload.display_name;
      }
    }
  });

  // 3.7) Logout button
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
  });
}
