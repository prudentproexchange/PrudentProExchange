// Initialize AOS animations
AOS.init({ duration: 800, once: true });

// Supabase client
const { createClient } = supabase;
const supabaseClient = createClient(
  'https://iwkdznjqfbsfkscnbrkc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3a2R6bmpxZmJzZmtzY25icmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2Mjk2ODgsImV4cCI6MjA2NjIwNTY4OH0.eRiXpUKP0zAMI9brPHFMxdSwZITGHxu8BPRQprkAbiU'
);

// Common UI handlers (hamburger, theme, nav-close, back-to-top, clock)
function initCommonUI() {
  // Hamburger Toggle
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
  accountToggle.addEventListener('click', e => {
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
  // Ensure user is authenticated
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    return window.location.href = 'login.html';
  }
  const userId = session.user.id;

  // Query sent & received transfers
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
      status_reason,
      created_at
    `)
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching transactions:', error);
    // Insert a visible error banner so you can read the real message
    const banner = document.createElement('div');
    banner.className = 'error-banner';
    banner.textContent = `Error loading transactions: ${error.message}`;
    document.querySelector('.transactions-section').prepend(banner);
    return;
  }

  const tbody = document.querySelector('#transactionsTable tbody');
  tbody.innerHTML = ''; // clear

  transfers.forEach(tx => {
    const isSender = tx.sender_id === userId;
    const counterEmail = isSender ? tx.recipient_email : tx.sender_email;
    const directionIcon = isSender
      ? '<i class="fas fa-arrow-up"></i>'
      : '<i class="fas fa-arrow-down"></i>';

    const dt = new Date(tx.created_at);
    const dateStr = dt.toLocaleDateString('en-US', {
      year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'
    });

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${dateStr}</td>
      <td>${directionIcon} ${counterEmail}</td>
      <td>$${tx.amount.toFixed(2)}</td>
      <td><span class="badge ${tx.status}">${tx.status}</span></td>
      <td>${tx.memo || ''}</td>
      <td>${tx.status === 'failed' ? (tx.status_reason || '—') : '—'}</td>
    `;
    tbody.appendChild(tr);
  });
}
loadTransactions();

// Status filter
document.getElementById('statusFilter').addEventListener('change', e => {
  const val = e.target.value;
  document.querySelectorAll('#transactionsTable tbody tr').forEach(tr => {
    const status = tr.querySelector('.badge').textContent;
    tr.style.display = (val === 'all' || status === val) ? '' : 'none';
  });
});

// Column sorting (date, counterparty, amount, status)
document.querySelectorAll('#transactionsTable th[data-sort]').forEach(th => {
  th.addEventListener('click', () => {
    const table = th.closest('table');
    const tbody = table.querySelector('tbody');
    const idx = Array.from(th.parentNode.children).indexOf(th);
    const asc = !th.classList.contains('asc');

    Array.from(tbody.rows)
      .sort((a, b) => {
        let aText = a.cells[idx].textContent.trim();
        let bText = b.cells[idx].textContent.trim();

        // strip $ & commas for numeric
        if (!isNaN(aText.replace(/[$,]/g, '')) && !isNaN(bText.replace(/[$,]/g, ''))) {
          return asc
            ? parseFloat(aText.replace(/[$,]/g, '')) - parseFloat(bText.replace(/[$,]/g, ''))
            : parseFloat(bText.replace(/[$,]/g, '')) - parseFloat(aText.replace(/[$,]/g, ''));
        }
        // parse Date
        if (Date.parse(aText) && Date.parse(bText)) {
          return asc
            ? new Date(aText) - new Date(bText)
            : new Date(bText) - new Date(aText);
        }
        // fallback to string compare
        return asc
          ? aText.localeCompare(bText)
          : bText.localeCompare(aText);
      })
      .forEach(row => tbody.appendChild(row));

    table.querySelectorAll('th').forEach(h => h.classList.remove('asc', 'desc'));
    th.classList.add(asc ? 'asc' : 'desc');
  });
});
