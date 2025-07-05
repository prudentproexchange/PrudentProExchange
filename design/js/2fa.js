// js/2fa.js

// 1) Init Supabase client (anon key), with session persistence
const supabaseClient = supabase.createClient(
  'https://iwkdznjqfbsfkscnbrkc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3a2R6bmpxZmJzZmtzY25icmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2Mjk2ODgsImV4cCI6MjA2NjIwNTY4OH0.eRiXpUKP0zAMI9brPHFMxdSwZITGHxu8BPRQprkAbiU',
  {
    auth: { persistSession: true, detectSessionInUrl: false }
  }
);

let userId, twofaRow;

// Entry point
document.addEventListener('DOMContentLoaded', init2FAPage);

async function init2FAPage() {
  AOS.init({ duration: 800, once: true });

  // 2) Wait for session
  const { data: { session }, error: sessErr } = await supabaseClient.auth.getSession();
  if (sessErr || !session) {
    return window.location.replace('login.html');
  }
  userId = session.user.id;

  // 3) Load profile
  const { data: profile, error: profErr } = await supabaseClient
    .from('profiles')
    .select('first_name,photo_url')
    .eq('id', userId)
    .single();
  if (profErr) {
    return showError('Error loading profile: ' + profErr.message);
  }

  // 4) Load (or create) 2FA row
  const { data, error: faErr } = await supabaseClient
    .from('user_2fa')
    .select('secret,enabled,qr_code_url')
    .eq('user_id', userId)
    .maybeSingle();
  if (faErr) {
    return showError('Error loading 2FA status: ' + faErr.message);
  }
  twofaRow = data;

  // 5) Populate static UI parts
  document.getElementById('welcomeName').textContent = profile.first_name || 'User';
  if (profile.photo_url) {
    const { data: urlData } = supabaseClient.storage
      .from('profile-photos').getPublicUrl(profile.photo_url);
    document.getElementById('navProfilePhoto').src = urlData.publicUrl;
    document.getElementById('navProfilePhoto').style.display = 'block';
    document.getElementById('defaultProfileIcon').style.display = 'none';
  }

  // 6) Show enable vs. disable sections
  const enabled = !!twofaRow?.enabled;
  document.getElementById('twofa-status').textContent = enabled
    ? '2FA is currently enabled.'
    : '2FA is currently disabled.';
  document.getElementById('enable-2fa-section').style.display  = enabled ? 'none' : 'block';
  document.getElementById('disable-2fa-section').style.display = enabled ? 'block' : 'none';

  // 7) If we have a secret, show it. Otherwise, generate one.
  if (twofaRow?.secret) {
    showSecret(twofaRow.secret, twofaRow.qr_code_url);
  } else {
    await generateTotpSecret();
  }

  // 8) Wire up buttons
  setupEventListeners();
}

function showSecret(secret, qrCodeUrl) {
  const img = document.getElementById('qrcode');
  img.src = qrCodeUrl;
  img.style.display = 'block';
  document.getElementById('secret').textContent = secret;
}

async function generateTotpSecret() {
  try {
    const res = await fetch('/.netlify/functions/create-totp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { secret, qr_code_url } = await res.json();
    twofaRow = { secret, qr_code_url, enabled: false };
    showSecret(secret, qr_code_url);
  } catch (e) {
    showError('Error generating TOTP secret: ' + e.message);
  }
}

function setupEventListeners() {
  // Copy secret
  document.getElementById('copy-secret-btn').addEventListener('click', () => {
    const secret = document.getElementById('secret').textContent;
    navigator.clipboard.writeText(secret).then(() => {
      const btn = document.getElementById('copy-secret-btn');
      btn.innerHTML = '<i class="fas fa-check"></i>';
      setTimeout(() => btn.innerHTML = '<i class="fas fa-copy"></i>', 2000);
    });
  });

  // Verify & enable
  document.getElementById('verify-enable-btn').addEventListener('click', async () => {
    const token = document.getElementById('totp-code-enable').value.trim();
    if (!/^\d{6}$/.test(token)) return showError('Enter a valid 6-digit code.');
    try {
      const res = await fetch('/.netlify/functions/verify-totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, token })
      });
      const { ok } = await res.json();
      if (!ok) return showError('Invalid code');

      // update enabled flag
      const { error: updErr } = await supabaseClient
        .from('user_2fa')
        .update({ enabled: true, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
      if (updErr) throw updErr;

      twofaRow.enabled = true;
      document.getElementById('enable-2fa-section').style.display  = 'none';
      document.getElementById('disable-2fa-section').style.display = 'block';
      document.getElementById('twofa-status').textContent = '2FA is currently enabled.';
      alert('2FA enabled successfully!');
    } catch (e) {
      showError('Error verifying TOTP: ' + e.message);
    }
  });

  // Verify & disable
  document.getElementById('verify-disable-btn').addEventListener('click', async () => {
    const token = document.getElementById('totp-code-disable').value.trim();
    if (!/^\d{6}$/.test(token)) return showError('Enter a valid 6-digit code.');
    try {
      const res = await fetch('/.netlify/functions/verify-totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, token })
      });
      const { ok } = await res.json();
      if (!ok) return showError('Invalid code');

      // update enabled flag
      const { error: updErr } = await supabaseClient
        .from('user_2fa')
        .update({ enabled: false, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
      if (updErr) throw updErr;

      twofaRow.enabled = false;
      document.getElementById('enable-2fa-section').style.display  = 'block';
      document.getElementById('disable-2fa-section').style.display = 'none';
      document.getElementById('twofa-status').textContent = '2FA is currently disabled.';
      alert('2FA disabled successfully!');
    } catch (e) {
      showError('Error verifying TOTP: ' + e.message);
    }
  });
}

function showError(msg) {
  const el = document.getElementById('error-message');
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => (el.style.display = 'none'), 5000);
}
