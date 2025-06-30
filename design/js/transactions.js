// Initialize AOS animations
AOS.init({ duration: 800, once: true });

// Supabase client
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
  hamburgerBtn.addEventListener('click', () => {
    navDrawer.classList.toggle('open');
    hamburgerBtn.classList.toggle('active');
    overlay.classList.toggle('nav-open');
    if (navDrawer.classList.contains('open')) navDrawer.scrollTop = 0;
  });
  document.addEventListener('click', event => {
    if (!navDrawer.contains(event.target) && !hamburgerBtn.contains(event.target) && navDrawer.classList.contains('open')) {
      navDrawer.classList.remove('open');
      hamburgerBtn.classList.remove('active');
      overlay.classList.remove('nav-open');
    }
  });

  const themeToggle = document.getElementById('theme-toggle');
  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const icon = themeToggle.querySelector('i');
    icon.classList.toggle('fa-moon');
    icon.classList.toggle('fa-sun');
  });

  const accountToggle = document.getElementById('account-toggle');
  const submenu = accountToggle.nextElementSibling;
  accountToggle.addEventListener('click', e => {
    e.preventDefault();
    submenu.classList.toggle('open');
  });

  document.getElementById('back-to-top').addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  function updateLocalTime() {
    const now = new Date();
    document.getElementById('localTime').textContent = now.toLocaleTimeString();
    document.getElementById('localDate').textContent = now.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }
  function updateUTCTime() {
    document.getElementById('utcTime').textContent = new Date().toUTCString();
  }
  setInterval(updateLocalTime, 1000);
  setInterval(updateUTCTime, 1000);
  updateLocalTime();
  updateUTCTime();
}
initCommonUI();

// Fetch and render transactions
async function loadTransactions() {
  // Auth check
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return window.location.href = 'login.html';
  const userId = session.user.id;

  // (Optional) load profile for welcome name, etc.
  // …your existing profile logic…

  // Fetch transfers—note: no `reason` column
  const { data: transfers, error } = await supabaseClient
    .from('transfers')
    .select(`
      id,
      sender_id,
      sender_email,
      recipient_id,
      recipient_email,
      amount,
      status,
      memo,
      created_at
    `)
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching transactions:', error);
    const banner = document.createElement('div');
    banner.className = 'error-banner';
    banner.textContent = `Error loading transactions: ${error.message}`;
    document.querySelector('.transactions-section').prepend(banner);
    return;
  }

  const tbody = document.querySelector('#transactionsTable tbody');
  tbody.innerHTML = ''; // clear out old rows

  const statusIcon = {
    pending: '<i class="fas fa-clock"></i>',
    approved: '<i class="fas fa-check"></i>',
    failed: '<i class="fas fa-times"></i>'
  };

  transfers.forEach(tx => {
    const isSender = tx.sender_id === userId;
    const counterEmail = isSender ? tx.recipient_email : tx.sender_email;
    const directionIcon = isSender
      ? '<i class="fas fa-arrow-up"></i>'
      : '<i class="fas fa-arrow-down"></i>';
    const dt = new Date(tx.created_at);
    const dateStr = dt.toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
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
}
loadTransactions();

// Status filter
document.getElementById('statusFilter').addEventListener('change', e => {
  const val = e.target.value;
  document.querySelectorAll('#transactionsTable tbody tr').forEach(tr => {
    const status = tr.querySelector('.badge').textContent.split(' ').pop();
    tr.style.display = (val === 'all' || status === val) ? '' : 'none';
  });
});

// Column sorting
document.querySelectorAll('#transactionsTable th[data-sort]').forEach(th => {
  th.addEventListener('click', () => {
    const table = th.closest('table');
    const tbody = table.querySelector('tbody');
    const idx = Array.from(th.parentNode.children).indexOf(th);
    const asc = !th.classList.contains('asc');
    Array.from(tbody.rows)
      .sort((a, b) => {
        let A = a.cells[idx].textContent.trim();
        let B = b.cells[idx].textContent.trim();
        // Numeric?
        if (!isNaN(A.replace(/[$,]/g, '')) && !isNaN(B.replace(/[$,]/g, ''))) {
          return asc
            ? parseFloat(A.replace(/[$,]/g, '')) - parseFloat(B.replace(/[$,]/g, ''))
            : parseFloat(B.replace(/[$,]/g, '')) - parseFloat(A.replace(/[$,]/g, ''));
        }
        // Date?
        if (Date.parse(A) && Date.parse(B)) {
          return asc
            ? new Date(A) - new Date(B)
            : new Date(B) - new Date(A);
        }
        // Fallback string compare
        return asc
          ? A.localeCompare(B)
          : B.localeCompare(A);
      })
      .forEach(row => tbody.appendChild(row));
    table.querySelectorAll('th').forEach(h => h.classList.remove('asc','desc'));
    th.classList.add(asc ? 'asc' : 'desc');
  });
});
