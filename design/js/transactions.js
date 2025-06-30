// Initialize AOS
AOS.init({ duration: 800, once: true });

// Supabase client (exact URL + anon key)
const { createClient } = supabase;
const supabaseClient = createClient(
  'https://iwkdznjqfbsfkscnbrkc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3a2R6bmpxZmJzZmtzY25icmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2Mjk2ODgsImV4cCI6MjA2NjIwNTY4OH0.eRiXpUKP0zAMI9brPHFMxdSwZITGHxu8BPRQprkAbiU'
);

// Common UI: hamburger, theme, nav‐close, clock, back‐to‐top
function initCommonUI() {
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const navDrawer = document.getElementById('navDrawer');
  const overlay   = document.querySelector('.nav-overlay');
  hamburgerBtn.addEventListener('click', () => {
    navDrawer.classList.toggle('open');
    hamburgerBtn.classList.toggle('active');
    overlay.classList.toggle('nav-open');
  });
  document.addEventListener('click', e => {
    if (!navDrawer.contains(e.target) && !hamburgerBtn.contains(e.target) && navDrawer.classList.contains('open')) {
      navDrawer.classList.remove('open');
      hamburgerBtn.classList.remove('active');
      overlay.classList.remove('nav-open');
    }
  });

  document.getElementById('theme-toggle').addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const icon = document.querySelector('#theme-toggle i');
    icon.classList.toggle('fa-moon');
    icon.classList.toggle('fa-sun');
  });

  const accountToggle = document.getElementById('account-toggle');
  accountToggle.addEventListener('click', e => {
    e.preventDefault();
    accountToggle.nextElementSibling.classList.toggle('open');
  });

  document.getElementById('back-to-top').addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Live clock
  function updateLocalTime() {
    const now = new Date();
    document.getElementById('localTime').textContent = now.toLocaleTimeString();
    document.getElementById('localDate').textContent = now.toLocaleDateString('en-US', {
      weekday:'long', year:'numeric', month:'long', day:'numeric'
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

// Render all transfers for current user
async function renderTransactions() {
  const { data:{ session } } = await supabaseClient.auth.getSession();
  if (!session) return window.location.href = 'login.html';
  const userId = session.user.id;

  const { data: transfers, error } = await supabaseClient
    .from('transfers')
    .select(`id, sender_id, sender_email, recipient_id, recipient_email, amount, status, memo, created_at`)
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading transactions:', error);
    return alert('Could not load transactions: ' + error.message);
  }

  const tbody = document.querySelector('#transactionsTable tbody');
  tbody.innerHTML = '';

  const icons = {
    pending:  '<i class="fas fa-clock"></i>',
    approved: '<i class="fas fa-check-circle"></i>',
    failed:   '<i class="fas fa-times-circle"></i>'
  };

  transfers.forEach(tx => {
    const isSender = tx.sender_id === userId;
    const counter = isSender ? tx.recipient_email : tx.sender_email;
    const dirIcon = isSender ? '<i class="fas fa-arrow-up"></i>' : '<i class="fas fa-arrow-down"></i>';
    const dateStr = new Date(tx.created_at).toLocaleString('en-US', {
      year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'
    });

    const memoCell = tx.status === 'approved'
      ? `<em>Your transfer was approved</em>`
      : (tx.memo || '');

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${dateStr}</td>
      <td>${dirIcon} ${counter}</td>
      <td>$${tx.amount.toFixed(2)}</td>
      <td>
        <span class="badge ${tx.status}">
          ${icons[tx.status]} ${tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
        </span>
      </td>
      <td>${memoCell}</td>
    `;
    tbody.appendChild(tr);
  });

  // Reapply filter
  const sel = document.getElementById('statusFilter').value;
  document.querySelectorAll('#transactionsTable tbody tr').forEach(tr => {
    const st = tr.querySelector('.badge').textContent.split(' ').pop().toLowerCase();
    tr.style.display = (sel==='all'||st===sel)?'':'none';
  });
}

// Real-time subscription
async function subscribeUpdates() {
  const { data:{ session } } = await supabaseClient.auth.getSession();
  if (!session) return;
  const uid = session.user.id;

  supabaseClient
    .channel(`public:transfers`)
    .on('postgres_changes', { event:'UPDATE', schema:'public', table:'transfers' }, () => renderTransactions())
    .subscribe();
}

// Filter dropdown
document.getElementById('statusFilter').addEventListener('change', () => {
  document.querySelectorAll('#transactionsTable tbody tr').forEach(tr => {
    const st = tr.querySelector('.badge').textContent.split(' ').pop().toLowerCase();
    const val = document.getElementById('statusFilter').value;
    tr.style.display = (val==='all'||st===val)?'':'none';
  });
});

// Initial load
(async () => {
  document.getElementById('statusFilter').value = 'all';
  await renderTransactions();
  await subscribeUpdates();
})();
