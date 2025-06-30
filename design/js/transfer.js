// Supabase Client Initialization
const { createClient } = supabase;
const supabaseClient = createClient(
  'https://iwkdznjqfbsfkscnbrkc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3a2R6bmpxZmJzZmtzY25icmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2Mjk2ODgsImV4cCI6MjA2NjIwNTY4OH0.eRiXpUKP0zAMI9brPHFMxdSwZITGHxu8BPRQprkAbiU'
);

// AOS Initialization
AOS.init({ duration: 800, once: true });

// Hamburger Menu Toggle
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

// Close Nav When Clicking Outside
document.addEventListener('click', (event) => {
  const isClickInsideNav = navDrawer.contains(event.target);
  const isClickOnHamburger = hamburgerBtn.contains(event.target);
  if (!isClickInsideNav && !isClickOnHamburger && navDrawer.classList.contains('open')) {
    navDrawer.classList.remove('open');
    hamburgerBtn.classList.remove('active');
    overlay.classList.remove('nav-open');
  }
});

// Theme Toggle
const themeToggle = document.getElementById('theme-toggle');
themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('light-theme');
  const icon = themeToggle.querySelector('i');
  icon.classList.toggle('fa-moon');
  icon.classList.toggle('fa-sun');
});

// Account Menu Toggle
const accountToggle = document.getElementById('account-toggle');
const submenu = accountToggle.nextElementSibling;
accountToggle.addEventListener('click', (e) => {
  e.preventDefault();
  submenu.classList.toggle('open');
});

// Back to Top
document.getElementById('back-to-top').addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Time Updates
function updateLocalTime() {
  const now = new Date();
  document.getElementById('localTime').textContent = now.toLocaleTimeString();
  document.getElementById('localDate').textContent = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}
setInterval(updateLocalTime, 1000);
updateLocalTime();

function updateUTCTime() {
  document.getElementById('utcTime').textContent = new Date().toUTCString();
}
setInterval(updateUTCTime, 1000);
updateUTCTime();

// Logout
document.getElementById('logout-btn').addEventListener('click', async () => {
  const { error } = await supabaseClient.auth.signOut();
  if (!error) {
    window.location.href = 'login.html';
  } else {
    console.error('Logout error:', error);
    alert('Error logging out: ' + error.message);
  }
});

// Video Playback
const video = document.querySelector('.bg-video');
video.addEventListener('canplay', () => {
  video.play().catch(error => console.error('Video playback error:', error));
});

// Initialize Transfer Page
async function initTransferPage() {
  // Check Authentication
  const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
  if (sessionError || !session) {
    console.error('Session error:', sessionError);
    window.location.href = 'login.html';
    return;
  }
  const user = session.user;

  // Fetch user's profile
  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('id, email, deposit_wallet, full_name, profile_picture')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    console.error('Profile fetch error:', profileError);
    alert('Error fetching your account details. Please try again or contact support.');
    return;
  }

  const depositWallet = profile.deposit_wallet || 0;

  // Update user info
  document.querySelector('.profile-picture').src = profile.profile_picture || 'assets/images/default-profile.png';
  document.querySelector('.user-name').textContent = profile.full_name || 'User';

  // Handle Form Submission
  const transferForm = document.getElementById('transferForm');
  transferForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const recipientEmail = document.getElementById('recipientEmail').value.trim().toLowerCase();
    const amount = parseFloat(document.getElementById('transferAmount').value);
    const memo = document.getElementById('memo').value.trim();

    // Validate inputs
    if (!recipientEmail || !amount) {
      alert('Please enter both recipient email and amount.');
      return;
    }

    if (amount <= 0) {
      alert('Amount must be greater than 0.');
      return;
    }

    if (amount > depositWallet) {
      alert(`Insufficient balance. Your available balance is $${depositWallet.toFixed(2)}.`);
      return;
    }

    if (recipientEmail === profile.email.toLowerCase()) {
      alert('You cannot transfer funds to yourself.');
      return;
    }

    // Lookup recipient in profiles
    console.log('Searching for recipient email:', recipientEmail);
    const { data: recipient, error: recipientError } = await supabaseClient
      .from('profiles')
      .select('id, email')
      .ilike('email', recipientEmail)
      .single();

    if (recipientError || !recipient) {
      console.error('Recipient lookup error:', JSON.stringify(recipientError, null, 2));
      alert('Recipient not found. Please ensure the recipient has a registered account.');
      return;
    }

    // Insert transfer record
    const { error: insertError } = await supabaseClient
      .from('transfers')
      .insert({
        sender_id: user.id,
        sender_email: profile.email,
        recipient_id: recipient.id,
        recipient_email: recipient.email,
        amount: amount,
        status: 'pending',
        memo: memo || null,
        created_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('Transfer insertion error:', JSON.stringify(insertError, null, 2));
      alert('Error submitting transfer: ' + insertError.message);
      return;
    }

    alert('Transfer submitted successfully! Awaiting approval.');
    window.location.href = 'transactions.html';
  });
}

// Error Handling
window.addEventListener('error', event => {
  console.error('Global error:', event);
  alert(`Error: ${event.message}\nFile: ${event.filename}:${event.lineno}`);
});
window.addEventListener('unhandledrejection', event => {
  console.error('Unhandled promise rejection:', event.reason);
  alert(`Unhandled error: ${event.reason}`);
});

// Start the page
initTransferPage();
