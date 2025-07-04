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
  const errorDiv = document.getElementById('withdraw-error');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  setTimeout(() => errorDiv.style.display = 'none', 5000);
}

function showSuccess(message) {
  const successDiv = document.getElementById('withdraw-success');
  successDiv.textContent = message;
  successDiv.style.display = 'block';
  setTimeout(() => successDiv.style.display = 'none', 5000);
}

function showLoading(show) {
  document.getElementById('withdraw-loading').style.display = show ? 'block' : 'none';
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
      weekday: 'long', year: 'numeric', month: 'numeric', day: 'numeric'
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

async function initWithdraw() {
  showLoading(true);
  try {
    // Auth guard
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (!user || authError) {
      window.location.href = 'login.html';
      return;
    }

    const userId = user.id;

    // Load profile and balance
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('first_name, photo_url, balance')
      .eq('id', userId)
      .single();
    if (profileError) throw profileError;

    document.getElementById('welcomeName').textContent = profile.first_name || 'User';
    document.getElementById('user-balance').textContent = profile.balance ? profile.balance.toFixed(2) : '0.00';
    if (profile.photo_url) {
      const { data: urlData } = supabaseClient.storage
        .from('profile-photos')
        .getPublicUrl(profile.photo_url);
      document.getElementById('navProfilePhoto').src = urlData.publicUrl;
      document.getElementById('navProfilePhoto').style.display = 'block';
      document.getElementById('defaultProfileIcon').style.display = 'none';
    }

    // Load withdrawal history
    const { data: withdrawals, error: withdrawError } = await supabaseClient
      .from('withdrawals')
      .select('id, amount, method, status, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (withdrawError) throw withdrawError;

    const withdrawTable = document.getElementById('withdraw-table');
    withdrawTable.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Amount ($)</th>
            <th>Method</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          ${withdrawals?.map(w => `
            <tr>
              <td>${w.id}</td>
              <td>${w.amount.toFixed(2)}</td>
              <td>${w.method.charAt(0).toUpperCase() + w.method.slice(1)}</td>
              <td>${w.status.charAt(0).toUpperCase() + w.status.slice(1)}</td>
              <td>${new Date(w.created_at).toLocaleDateString()}</td>
            </tr>
          `).join('') || '<tr><td colspan="5">No withdrawals found</td></tr>'}
        </tbody>
      </table>
    `;

    // Handle form submission
    const withdrawForm = document.getElementById('withdraw-form');
    withdrawForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      showLoading(true);
      try {
        const amount = parseFloat(document.getElementById('withdraw-amount').value);
        const method = document.getElementById('withdraw-method').value;

        if (!amount || amount <= 0) {
          throw new Error('Amount must be greater than 0');
        }
        if (!method) {
          throw new Error('Please select a payment method');
        }
        if (amount > profile.balance) {
          throw new Error('Insufficient balance');
        }

        const { error } = await supabaseClient
          .from('withdrawals')
          .insert({ user_id: userId, amount, method, status: 'pending' });
        if (error) throw error;

        // Update balance (optimistic update, actual balance update should be handled server-side)
        const newBalance = profile.balance - amount;
        const { error: balanceError } = await supabaseClient
          .from('profiles')
          .update({ balance: newBalance })
          .eq('id', userId);
        if (balanceError) throw balanceError;

        showSuccess('Withdrawal request submitted successfully!');
        withdrawForm.reset();
        document.getElementById('user-balance').textContent = newBalance.toFixed(2);

        // Reload withdrawal history
        const { data: newWithdrawals, error: newWithdrawError } = await supabaseClient
          .from('withdrawals')
          .select('id, amount, method, status, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        if (newWithdrawError) throw newWithdrawError;

        withdrawTable.innerHTML = `
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Amount ($)</th>
                <th>Method</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${newWithdrawals?.map(w => `
                <tr>
                  <td>${w.id}</td>
                  <td>${w.amount.toFixed(2)}</td>
                  <td>${w.method.charAt(0).toUpperCase() + w.method.slice(1)}</td>
                  <td>${w.status.charAt(0).toUpperCase() + w.status.slice(1)}</td>
                  <td>${new Date(w.created_at).toLocaleDateString()}</td>
                </tr>
              `).join('') || '<tr><td colspan="5">No withdrawals found</td></tr>'}
            </tbody>
          </table>
        `;
      } catch (err) {
        showError('Error submitting withdrawal: ' + err.message);
      } finally {
        showLoading(false);
      }
    });
  } catch (err) {
    showError('Error loading withdraw page: ' + err.message);
  } finally {
    showLoading(false);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  initCommonUI();
  initWithdraw();
});

// Video background
const video = document.querySelector('.bg-video');
video.addEventListener('canplay', () => {
  video.play().catch(error => console.error('Error playing video:', error));
});
