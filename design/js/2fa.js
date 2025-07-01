// js/2fa.js
document.addEventListener('DOMContentLoaded', () => {
  (async () => {
    try {
      // Initialize AOS (animations)
      if (window.AOS) AOS.init({ duration: 800, once: true });
      
      // 1) Init Supabase client (v1)
      const { createClient } = supabase;
      const supabaseClient = createClient(
        'https://iwkdznjqfbsfkscnbrkc.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3a2R6bmpxZmJzZmtzY25icmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2Mjk2ODgsImV4cCI6MjA2NjIwNTY4OH0.eRiXpUKP0zAMI9brPHFMxdSwZITGHxu8BPRQprkAbiU'
      );

      // 2) Check session (v1)
      const session = supabaseClient.auth.session();
      console.log('auth.session →', session);
      if (!session?.user) {
        return void (window.location.href = 'login.html');
      }
      const userId = session.user.id;

      // 3) Fetch user profile
      let profile;
      try {
        const { data, error } = await supabaseClient
          .from('profiles')
          .select('first_name, photo_url, two_fa_enabled')
          .eq('id', userId)
          .single();
        if (error) throw error;
        profile = data;
      } catch (err) {
        console.error('Profile load error', err);
        return showError('Error loading profile: ' + err.message);
      }

      // 4) Populate UI with profile
      document.getElementById('welcomeName').textContent = profile.first_name || 'User';
      if (profile.photo_url) {
        try {
          const { data: urlData } = supabaseClient.storage
            .from('profile-photos')
            .getPublicUrl(profile.photo_url);
          document.getElementById('navProfilePhoto').src = urlData.publicUrl;
          document.getElementById('navProfilePhoto').style.display = 'block';
          document.getElementById('defaultProfileIcon').style.display = 'none';
        } catch (e) {
          console.warn('Profile photo fetch failed', e);
        }
      }
      const enabled = profile.two_fa_enabled;
      document.getElementById('twofa-status').textContent = enabled
        ? '2FA is currently enabled.'
        : '2FA is currently disabled.';
      document.getElementById('enable-2fa-section').style.display = enabled ? 'none' : 'block';
      document.getElementById('disable-2fa-section').style.display = enabled ? 'block' : 'none';

      // 5) If 2FA disabled, fetch secret
      if (!enabled) {
        try {
          let resp = await supabaseClient.rpc('create_totp_secret', { _user_id: userId });
          console.log('rpc create_totp_secret(_user_id) →', resp);
          if ((!resp.data || !resp.data.secret) && !resp.error) {
            resp = await supabaseClient.rpc('create_totp_secret', { user_id: userId });
            console.log('rpc create_totp_secret(user_id) →', resp);
          }
          if (resp.error) throw resp.error;
          const { secret, qr_code_url } = resp.data || {};
          if (!secret || !qr_code_url) {
            console.error('Unexpected RPC shape', resp.data);
            throw new Error('Invalid RPC response');
          }
          document.getElementById('qrcode').src = qr_code_url;
          document.getElementById('qrcode').style.display = 'block';
          document.getElementById('secret').textContent = secret;
        } catch (err) {
          console.error('Fetch TOTP secret error', err);
          showError('Could not generate 2FA secret.');
        }
      }

      // 6) Wire up buttons
      document.getElementById('copy-secret-btn').addEventListener('click', () => {
        const secret = document.getElementById('secret').textContent;
        navigator.clipboard.writeText(secret);
      });
      document.getElementById('verify-enable-btn').addEventListener('click', async () => {
        const token = document.getElementById('totp-code-enable').value.trim();
        if (!/^\d{6}$/.test(token)) return showError('Enter valid 6-digit code');
        try {
          const { error } = await supabaseClient.rpc('verify_and_enable_totp', { user_id: userId, token });
          if (error) throw error;
          alert('2FA enabled!');
          window.location.reload();
        } catch (e) {
          console.error('Enable 2FA error', e);
          showError('Invalid code.');
        }
      });
      document.getElementById('verify-disable-btn').addEventListener('click', async () => {
        const token = document.getElementById('totp-code-disable').value.trim();
        if (!/^\d{6}$/.test(token)) return showError('Enter valid 6-digit code');
        try {
          const { error } = await supabaseClient.rpc('disable_totp', { user_id: userId, token });
          if (error) throw error;
          alert('2FA disabled!');
          window.location.reload();
        } catch (e) {
          console.error('Disable 2FA error', e);
          showError('Invalid code.');
        }
      });

      // 7) Copy your existing menu, theme-toggle, logout, back-to-top, time logic here...
      // wrap each in try/catch if needed to avoid breaking the page

    } catch (outerErr) {
      console.error('Unexpected init error', outerErr);
      // Don’t block UI—user can still see page, even if 2FA logic failed
    }
  })();
});

// Error helper function (outside the async block so it’s always available)
function showError(msg) {
  const e = document.getElementById('error-message');
  if (!e) return;
  e.textContent = msg;
  e.style.display = 'block';
  setTimeout(() => (e.style.display = 'none'), 5000);
}
