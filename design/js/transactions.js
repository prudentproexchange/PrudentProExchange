// Initialize AOS animations
AOS.init({ duration: 800, once: true });

// Supabase client initialization
const { createClient } = supabase;
const supabaseClient = createClient(
  'https://iwkdznjqfbsfkscnbrkc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3a2R6bmpxZmJzZmtzY25icmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2Mjk2ODgsImV4cCI6MjA2NjIwNTY4OH0.eRiXpUKP0zAMI9brPHFMxdSwZITGHxu8BPRQprkAbiU'
);

// Common UI initialization (hamburger, theme toggle, clock, back-to-top)
function initCommonUI() {
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const navDrawer = document.getElementById('navDrawer');
  const overlay = document.querySelector('.nav-overlay');

  if (hamburgerBtn && navDrawer && overlay) {
    hamburgerBtn.addEventListener('click', () => {
      navDrawer.classList.toggle('open');
      hamburgerBtn.classList.toggle('active');
      overlay.classList.toggle('nav-open');
      if (navDrawer.classList.contains('open')) navDrawer.scrollTop = 0;
    });

    document.addEventListener('click', (event) => {
      if (
        !navDrawer.contains(event.target) &&
        !hamburgerBtn.contains(event.target) &&
        navDrawer.classList.contains('open')
      ) {
        navDrawer.classList.remove('open');
        hamburgerBtn.classList.remove('active');
        overlay.classList.remove('nav-open');
      }
    });
  }

  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('light-theme');
      const icon = themeToggle.querySelector('i');
      if (icon) {
        icon.classList.toggle('fa-moon');
        icon.classList.toggle('fa-sun');
      }
    });
  }

  const accountToggle = document.getElementById('account-toggle');
  const submenu = accountToggle?.nextElementSibling;
  if (accountToggle && submenu) {
    accountToggle.addEventListener('click', (e) => {
      e.preventDefault();
      submenu.classList.toggle('open');
    });
  }

  const backToTop = document.getElementById('back-to-top');
  if (backToTop) {
    backToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function updateLocalTime() {
    const now = new Date();
    const localTime = document.getElementById('localTime');
    const localDate = document.getElementById('localDate');
    if (localTime) localTime.textContent = now.toLocaleTimeString();
    if (localDate) {
      localDate.textContent = now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
  }

  function updateUTCTime() {
    const utcTime = document.getElementById('utcTime');
    if (utcTime) utcTime.textContent = new Date().toUTCString();
  }

  setInterval(updateLocalTime, 1000);
  setInterval(updateUTCTime, 1000);
  updateLocalTime();
  updateUTCTime();
}
initCommonUI();

// Fetch and render transactions
async function loadTransactions() {
  try {
    // Authentication check
    const {
      data: { session },
      error: sessionError,
    } = await supabaseClient.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session) return (window.location.href = 'login.html');
    const userId = session.user.id;

    // Load user profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    const welcomeName = document.getElementById('welcomeName');
    if (profileError) {
      console.error('Error loading profile:', profileError);
      if (welcomeName) welcomeName.textContent = 'User';
    } else {
      if (welcomeName) welcomeName.textContent = profile.first_name || 'User';
      if (profile.photo_url) {
        const { data: urlData } = supabaseClient.storage
          .from('profile-photos')
          .getPublicUrl(profile.photo_url);
        const navProfilePhoto = document.getElementById('navProfilePhoto');
        const defaultProfileIcon = document.getElementById('defaultProfileIcon');
        if (navProfilePhoto) {
          navProfilePhoto.src = urlData.publicUrl;
          navProfilePhoto.style.display = 'block';
        }
        if (defaultProfileIcon) defaultProfileIcon.style.display = 'none';
      }
    }

    // Fetch transactions
    const { data: transfers, error: transfersError } = await supabaseClient
      .from('transfers')
      .select(
        `
        id,
        sender_id,
        sender_email,
        recipient_id,
        recipient_email,
        amount,
        status,
        memo,
        created_at
      `
      )
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (transfersError) throw transfersError;

    const tbody = document.querySelector('#transactionsTable tbody');
    if (!tbody) throw new Error('Transactions table body not found');
    tbody.innerHTML = ''; // Clear existing rows

    const statusIcon = {
      pending: '<i class="fas fa-clock"></i>',
      approved: '<i class="fas fa-check"></i>',
      failed: '<i class="fas fa-times"></i>',
    };

    transfers.forEach((tx) => {
      const isSender = tx.sender_id === userId;
      const counterEmail = isSender ? tx.recipient_email : tx.sender_email;
      const directionIcon = isSender
        ? '<i class="fas fa-arrow-up"></i>'
        : '<i class="fas fa-arrow-down"></i>';
      const dt = new Date(tx.created_at);
      const dateStr = dt.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${dateStr}</td>
        <td>${directionIcon} ${counterEmail}</td>
        <td>$${tx.amount.toFixed(2)}</td>
        <td><span class="badge ${tx.status}">${statusIcon[tx.status]} ${tx.status}</span></td>
        <td>${tx.memo || ''}</td>
        <td>—</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error('Error in loadTransactions:', error);
    const banner = document.createElement('div');
    banner.className = 'error-banner';
    banner.textContent = `Error loading transactions: ${error.message}`;
    const transactionsSection = document.querySelector('.transactions-section');
    if (transactionsSection) transactionsSection.prepend(banner);
  }
}
loadTransactions();

// Status filter
const statusFilter = document.getElementById('statusFilter');
if (statusFilter) {
  statusFilter.addEventListener('change', (e) => {
    const val = e.target.value;
    document.querySelectorAll('#transactionsTable tbody tr').forEach((tr) => {
      const status = tr.querySelector('.badge').textContent.split(' ').pop();
      tr.style.display = val === 'all' || status === val ? '' : 'none';
    });
  });
}

// Column sorting
document.querySelectorAll('#transactionsTable th[data-sort]').forEach((th) => {
  th.addEventListener('click', () => {
    const table = th.closest('table');
    const tbody = table.querySelector('tbody');
    const idx = Array.from(th.parentNode.children).indexOf(th);
    const asc = !th.classList.contains('asc');

    Array.from(tbody.rows)
      .sort((a, b) => {
        let A = a.cells[idx].textContent.trim();
        let B = b.cells[idx].textContent.trim();
        // Handle numeric values
        if (!isNaN(A.replace(/[$,]/g, '')) && !isNaN(B.replace(/[$,]/g, ''))) {
          return asc
            ? parseFloat(A.replace(/[$,]/g, '')) - parseFloat(B.replace(/[$,]/g, ''))
            : parseFloat(B.replace(/[$,]/g, '')) - parseFloat(A.replace(/[$,]/g, ''));
        }
        // Handle dates
        if (Date.parse(A) && Date.parse(B)) {
          return asc ? new Date(A) - new Date(B) : new Date(B) - new Date(A);
        }
        // Fallback to string comparison
        return asc ? A.localeCompare(B) : B.localeCompare(A);
      })
      .forEach((row) => tbody.appendChild(row));

    table.querySelectorAll('th').forEach((h) => h.classList.remove('asc', 'desc'));
    th.classList.add(asc ? 'asc' : 'desc');
  });
});

// Book card toggle
const bookCard = document.getElementById('bookCard');
if (bookCard) {
  bookCard.addEventListener('click', function () {
    this.classList.toggle('expanded');
  });
}
