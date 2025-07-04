// Initialize AOS
AOS.init({ duration: 800, once: true });

// Supabase client
const { createClient } = supabase;
const supabaseClient = createClient(
  'https://iwkdznjqfbsfkscnbrkc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3a2R6bmpxZmJzZmtzY25icmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2Mjk2ODgsImV4cCI6MjA2NjIwNTY4OH0.eRiXpUKP0zAMI9brPHFMxdSwZITGHxu8BPRQprkAbiU'
);

// Import bcryptjs for secure PIN hashing and verification
import { hash, compare } from 'https://cdn.jsdelivr.net/npm/bcryptjs@2.4.3/dist/bcrypt.min.js';

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

function showSection(sectionId) {
  ['pin-section', 'set-pin-section', 'wallet-section', 'withdraw-section', 'history-section'].forEach(id => {
    document.getElementById(id).style.display = id === sectionId ? 'block' : 'none';
  });
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

  hamburgerBtn.addEventListener('click', () => {
    navDrawer.classList.toggle('open');
    hamburgerBtn.classList.toggle('active');
    overlay.classList.toggle('nav-open');
    if (navDrawer.classList.contains('open')) {
      navDrawer.scrollTop = 0;
    }
  });

  document.addEventListener('click', (event) => {
    const isClickInsideNav = navDrawer.contains(event.target);
    const isClickOnHamburger = hamburgerBtn.contains(event.target);
    if (!isClickInsideNav && !isClickOnHamburger && navDrawer.classList.contains('open')) {
      navDrawer.classList.remove('open');
      hamburgerBtn.classList.remove('active');
      overlay.classList.remove('nav-open');
    }
  });

  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const icon = themeToggle.querySelector('i');
    icon.classList.toggle('fa-moon');
    icon.classList.toggle('fa-sun');
  });

  accountToggle.addEventListener('click', (e) => {
    e.preventDefault();
    submenu.classList.toggle('open');
  });

  jetButton.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

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

    // Check KYC status
    const { data: kycRequests, error: kycError } = await supabaseClient
      .from('kyc_requests')
      .select('status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);
    if (kycError) throw kycError;
    if (!kycRequests.length || kycRequests[0].status !== 'approved') {
      showError('You must complete KYC verification before withdrawing.');
      setTimeout(() => window.location.href = 'kyc.html', 3000);
      return;
    }

    // Load profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('first_name, photo_url, balance, withdrawal_pin')
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

    // Check if PIN is set
    if (!profile.withdrawal_pin) {
      showSection('set-pin-section');
      initSetPinForm(userId);
      showLoading(false);
      return;
    }

    showSection('pin-section');
    initPinVerification(userId, profile);
  } catch (err) {
    showError('Error initializing withdraw page: ' + err.message);
    showLoading(false);
  }
}

async function initSetPinForm(userId) {
  const setPinForm = document.getElementById('set-pin-form');
  setPinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading(true);
    try {
      const newPin = document.getElementById('new-pin').value;
      const confirmPin = document.getElementById('confirm-pin').value;
      if (!/^[0-9a-zA-Z]{4,}$/.test(newPin)) {
        throw new Error('PIN must be 4 or more alphanumeric characters');
      }
      if (newPin !== confirmPin) {
        throw new Error('PINs do not match');
      }

      // Hash the PIN for security
      const hashedPin = await hash(newPin, 10);

      // Store the hashed PIN directly in the profiles table
      const { error } = await supabaseClient
        .from('profiles')
        .update({ withdrawal_pin: hashedPin })
        .eq('id', userId);
      if (error) throw new Error('Error storing PIN: ' + error.message);

      showSuccess('PIN set successfully!');
      showSection('pin-section');
      setPinForm.reset();
    } catch (err) {
      showError('Error setting PIN: ' + err.message);
    } finally {
      showLoading(false);
    }
  });
}

async function initPinVerification(userId, profile) {
  const pinForm = document.getElementById('pin-form');
  pinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading(true);
    try {
      const pin =iphy.document.getElementById('pin-input').value;
      if (!/^[0-9a-zA-Z]{4,}$/.test(pin)) {
        throw new Error('PIN must be 4 or more alphanumeric characters');
      }

      // Fetch the stored hashed PIN from the profiles table
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('withdrawal_pin')
        .eq “id', userId)
        .single();
      if (error) throw new Error('Error fetching PIN: ' + error.message);
      if (!data.withdrawal_pin) throw new Error('No PIN set');

      // Verify the input PIN against the stored hashed PIN
      const isValid = await compare(pin, data.withdrawal_pin);
      if (!isValid) throw new Error('Invalid PIN');

      // If PIN is correct, proceed automatically
      showSection('wallet-section');
      initWalletManagement(userId, profile);
      initWithdrawalForm(userId, profile);
      initWithdrawalHistory(userId);
    } catch (err) {
      showError('Error verifying PIN: ' + err.message);
      pinForm.reset();
    } finally {
      showLoading(false);
    }
  });

  document.getElementById('set-pin-link').addEventListener('click', (e) => {
    e.preventDefault();
    showSection('set-pin-section');
    initSetPinForm(userId);
  });
}

async function initWalletManagement(userId, profile) {
  const walletForm = document.getElementById('wallet-form');
  const savedWallets = document.getElementById('saved-wallets');
  const deleteWalletBtn = document.getElementById('delete-wallet-btn');

  async function loadWallets() {
    const { data: wallets, error } = await supabaseClient
      .from('wallet_addresses')
      .select('id, wallet_address')
      .eq('user_id', userId);
    if (error) throw error;

    savedWallets.innerHTML = '<option value="" disabled selected>Select a wallet address</option>';
    document.getElementById('withdraw-wallet').innerHTML = '<option value="" disabled selected>Select a saved wallet address</option>';
    wallets.forEach(w => {
      const option = document.createElement('option');
      option.value = w.id;
      option.textContent = w.wallet_address;
      savedWallets.appendChild(option);
      document.getElementById('withdraw-wallet').appendChild(option.cloneNode(true));
    });

    deleteWalletBtn.disabled = !wallets.length;
  }

  await loadWallets();

  walletForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading(true);
    try {
      const walletAddress = document.getElementById('wallet-address').value.trim();
      if (!walletAddress) {
        throw new Error('Wallet address is required');
      }

      const { error } = await supabaseClient
        .from('wallet_addresses')
        .insert({ user_id: userId, wallet_address: walletAddress });
      if (error) throw error;

      showSuccess('Wallet address added successfully!');
      walletForm.reset();
      await loadWallets();
    } catch (err) {
      showError('Error adding wallet address: ' + err.message);
    } finally {
      showLoading(false);
    }
  });

  deleteWalletBtn.addEventListener('click', async () => {
    const walletId = savedWallets.value;
    if (!walletId) {
      showError('Please select a wallet to delete');
      return;
    }

    showLoading(true);
    try {
      const { error } = await supabaseClient
        .from('wallet_addresses')
        .delete()
        .eq('id', walletId)
        .eq('user_id', userId);
      if (error) throw error;

      showSuccess('Wallet address deleted successfully!');
      await loadWallets();
    } catch (err) {
      showError('Error deleting wallet address: ' + err.message);
    } finally {
      showLoading(false);
    }
  });

  savedWallets.addEventListener('change', () => {
    deleteWalletBtn.disabled = !savedWallets.value;
  });
}

async function initWithdrawalForm(userId, profile) {
  const withdrawForm = document.getElementById('withdraw-form');
  withdrawForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading(true);
    try {
      const amount = parseFloat(document.getElementById('withdraw-amount').value);
      const walletId = document.getElementById('withdraw-wallet').value;
      const password = document.getElementById('withdraw-password').value;

      if (!amount || amount <= 0) {
        throw new Error('Amount must be greater than 0');
      }
      if (!walletId) {
        throw new Error('Please select a wallet address');
      }
      if (!password) {
        throw new Error('Password is required');
      }
      if (amount > profile.balance) {
        throw new Error('Insufficient balance');
      }

      // Verify password
      const { error: authError } = await supabaseClient.auth.signInWithPassword({
        email: (await supabaseClient.auth.getUser()).data.user.email,
        password
      });
      if (authError) {
        throw new Error('Invalid password');
      }

      // Submit withdrawal request for approval
      const { error } = await supabaseClient
        .from('withdrawals')
        .insert({ user_id: userId, amount, wallet_address_id: walletId, status: 'pending' });
      if (error) throw error;

      showSuccess('Withdrawal request submitted successfully!');
      withdrawForm.reset();
      await initWithdrawalHistory(userId);
    } catch (err) {
      showError('Error submitting withdrawal: ' + err.message);
    } finally {
      showLoading(false);
    }
  });
}

async function initWithdrawalHistory(userId) {
  showSection('history-section');
  const withdrawTable = document.getElementById('withdraw-table');
  try {
    const { data: withdrawals, error } = await supabaseClient
      .from('withdrawals')
      .select('id, amount, wallet_addresses(wallet_address), status, created_at')
      .eq('user_id природыid', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    withdrawTable.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Amount ($)</th>
            <th>Wallet Address</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          ${withdrawals?.map(w => `
            <tr>
              <td>${w.id}</td>
              <td>${w.amount.toFixed(2)}</td>
              <td>${w.wallet_addresses.wallet_address}</td>
              <td>${w.status.charAt(0).toUpperCase() + w.status.slice(1)}</td>
              <td>${new Date(w.created_at).toLocaleDateString()}</td>
            </tr>
          `).join('') || '<tr><td colspan="5">No withdrawals found</td></tr>'}
        </tbody>
      </table>
    `;
  } catch (err) {
    showError('Error loading withdrawal history: ' + err.message);
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
