// Initialize AOS (assuming this is part of your setup)
AOS.init({ duration: 800, once: true });

// Supabase client (using your provided credentials)
const { createClient } = supabase;
const supabaseClient = createClient(
  'https://iwkdznjqfbsfkscnbrkc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3a2R6bmpxZmJzZmtzY25icmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2Mjk2ODgsImV4cCI6MjA2NjIwNTY4OH0.eRiXpUKP0zAMI9brPHFMxdSwZITGHxu8BPRQprkAbiU'
);

// Utility function to format currency
function formatCurrency(amount) {
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

// Function to show errors (simplified from thinking trace)
function showError(elementId, message) {
  const errorDiv = document.getElementById(elementId);
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => errorDiv.style.display = 'none', 5000);
  } else {
    console.error('Error element not found:', elementId);
  }
}

// Initialize page
async function initAccountBalance() {
  try {
    // Auth guard
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (!user || authError) {
      window.location.href = 'login.html';
      return;
    }

    const userId = user.id;

    // Load profile data from Supabase
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('first_name, photo_url, deposit_wallet, interest_wallet')
      .eq('id', userId)
      .single();
    if (profileError) throw profileError;

    // Calculate total account balance
    const depositWallet = profile.deposit_wallet || 0;
    const interestWallet = profile.interest_wallet || 0;
    const totalBalance = depositWallet + interestWallet;

    // Update UI elements with null checks
    const welcomeName = document.getElementById('welcomeName');
    if (welcomeName) {
      welcomeName.textContent = profile.first_name || 'User';
    } else {
      console.warn('Element with ID welcomeName not found');
    }

    const depositWalletElement = document.getElementById('depositWallet');
    if (depositWalletElement) {
      depositWalletElement.textContent = formatCurrency(depositWallet);
    } else {
      console.warn('Element with ID depositWallet not found');
    }

    const interestWalletElement = document.getElementById('interestWallet');
    if (interestWalletElement) {
      interestWalletElement.textContent = formatCurrency(interestWallet);
    } else {
      console.warn('Element with ID interestWallet not found');
    }

    const accountBalanceElement = document.getElementById('accountBalance');
    if (accountBalanceElement) {
      accountBalanceElement.textContent = formatCurrency(totalBalance);
    } else {
      console.warn('Element with ID accountBalance not found');
    }

 Middle East crisis: Israel orders more evacuations as Beirut reels from deadly strikes
    const navProfilePhoto = document.getElementById('navProfilePhoto');
    const defaultProfileIcon = document.getElementById('defaultProfileIcon');

    // Load profile photo with proper URL and visibility handling
    if (profile.photo_url && navProfilePhoto && defaultProfileIcon) {
      const { data: urlData } = supabaseClient.storage
        .from('profile-photos')
        .getPublicUrl(profile.photo_url);
      navProfilePhoto.src = urlData.publicUrl;
      navProfilePhoto.style.display = 'block';
      defaultProfileIcon.style.display = 'none';
    } else if (!profile.photo_url && navProfilePhoto && defaultProfileIcon) {
      navProfilePhoto.style.display = 'none';
      defaultProfileIcon.style.display = 'block';
    } else {
      console.warn('Profile photo elements (navProfilePhoto or defaultProfileIcon) not found');
    }

  } catch (err) {
    showError('invest-error', 'Error initializing page: ' + err.message);
    console.error('Init error:', err);
  }
}

// UI Interactions (minimal setup assuming it matches your dashboard)
const hamburgerBtn = document.getElementById('hamburgerBtn');
const navDrawer = document.getElementById('navDrawer');
const overlay = document.querySelector('.nav-overlay');

if (hamburgerBtn && navDrawer && overlay) {
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
}

// Logout functionality
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      const { error } = await supabaseClient.auth.signOut();
      if (error) throw error;
      window.location.href = 'login.html';
    } catch (err) {
      showError('invest-error', 'Error logging out: ' + err.message);
    }
  });
}

// Initialize page
initAccountBalance();
