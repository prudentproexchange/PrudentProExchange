// js/transactions.js

// 1) Initialize AOS & Supabase client
AOS.init({ duration: 800, once: true });
const { createClient } = supabase;
const supabaseClient = createClient(
  'https://iwkdznjqfbsfkscnbrkc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3a2R6bmpxZmJzZmtzY25icmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2Mjk2ODgsImV4cCI6MjA2NjIwNTY4OH0.eRiXpUKP0zAMI9brPHFMxdSwZITGHxu8BPRQprkAbiU'
);

// 2) Common UI (hamburger, theme, clock, back-to-top)
function initCommonUI() {
  // …your existing initCommonUI code…
}
initCommonUI();

// 3) Render table
async function renderTransactions() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return window.location.href = 'login.html';
  const userId = session.user.id;

  const { data: transfers, error } = await supabaseClient
    .from('transfers')
    .select('id, sender_id, sender_email, recipient_id, recipient_email, amount, status, memo, created_at')
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
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
    const dir    = isSender ? '<i class="fas fa-arrow-up"></i>' : '<i class="fas fa-arrow-down"></i>';
    const date   = new Date(tx.created_at)
                     .toLocaleString('en-US',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});

    const memoCell = tx.status === 'approved'
      ? `<em>Your transfer was approved</em>`
      : (tx.memo || '');

    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td>${date}</td>
        <td>${dir} ${counter}</td>
        <td>$${tx.amount.toFixed(2)}</td>
        <td>
          <span class="badge ${tx.status}">
            ${icons[tx.status]} ${tx.status.charAt(0).toUpperCase()+tx.status.slice(1)}
          </span>
        </td>
        <td>${memoCell}</td>
      </tr>
    `);
  });

  // reapply filter
  const filter = document.getElementById('statusFilter').value;
  document.querySelectorAll('#transactionsTable tbody tr').forEach(tr => {
    const st = tr.querySelector('.badge').textContent.split(' ').pop().toLowerCase();
    tr.style.display = (filter==='all' || st===filter) ? '' : 'none';
  });
}

// 4) Real-time subscription to ALL updates on transfers for this user
async function subscribeToChanges() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return;
  const uid = session.user.id;

  supabaseClient
    .channel('user-transfers')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table:  'transfers',
      filter: `sender_id=eq.${uid}`
    }, () => renderTransactions())
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table:  'transfers',
      filter: `recipient_id=eq.${uid}`
    }, () => renderTransactions())
    .subscribe();
}

// 5) Filter by status
document.getElementById('statusFilter').addEventListener('change', () => {
  document.querySelectorAll('#transactionsTable tbody tr').forEach(tr => {
    const st  = tr.querySelector('.badge').textContent.split(' ').pop().toLowerCase();
    const val = document.getElementById('statusFilter').value;
    tr.style.display = (val==='all' || st===val) ? '' : 'none';
  });
});

// 6) Kickoff
(async () => {
  document.getElementById('statusFilter').value = 'all';
  await renderTransactions();
  await subscribeToChanges();
})();
