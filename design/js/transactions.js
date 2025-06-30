// js/transactions.js

// 1) Initialize AOS and Supabase client
AOS.init({ duration: 800, once: true });
const { createClient } = supabase;
const supabaseClient = createClient(
  'https://iwkdznjqfbsfkscnbrkc.supabase.co',
  '<YOUR_ANON_KEY>'
);

// 2) Common UI (hamburger, theme, clock, back-to-top)
function initCommonUI() {
  /* …copy your existing initCommonUI code here… */
}
initCommonUI();

// 3) Render function
async function renderTransactions() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return window.location.href = 'login.html';
  const userId = session.user.id;

  // Fetch all transfers where you are sender OR recipient
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
    return alert('Could not load transactions: ' + error.message);
  }

  const tbody = document.querySelector('#transactionsTable tbody');
  tbody.innerHTML = ''; // clear existing

  const statusIcon = {
    pending:  '<i class="fas fa-clock"></i>',
    approved: '<i class="fas fa-check-circle"></i>',
    failed:   '<i class="fas fa-times-circle"></i>'
  };

  transfers.forEach(tx => {
    const isSender = tx.sender_id === userId;
    const counterparty = isSender ? tx.recipient_email : tx.sender_email;
    const directionIcon = isSender ? '<i class="fas fa-arrow-up"></i>' : '<i class="fas fa-arrow-down"></i>';
    const dateStr = new Date(tx.created_at)
      .toLocaleString('en-US', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });

    // If approved, we can optionally surface a note in the "Memo" column
    const memoCell = tx.status === 'approved'
      ? `<em>Your transfer was approved</em>`
      : (tx.memo || '');

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${dateStr}</td>
      <td>${directionIcon} ${counterparty}</td>
      <td>$${tx.amount.toFixed(2)}</td>
      <td>
        <span class="badge ${tx.status}">
          ${statusIcon[tx.status]} ${tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
        </span>
      </td>
      <td>${memoCell}</td>
    `;
    tbody.appendChild(tr);
  });

  // Re-apply filter immediately after (in case the user has selected one)
  const filterVal = document.getElementById('statusFilter').value;
  document.querySelectorAll('#transactionsTable tbody tr').forEach(tr => {
    const st = tr.querySelector('.badge').textContent.split(' ').pop().toLowerCase();
    tr.style.display = (filterVal === 'all' || st === filterVal) ? '' : 'none';
  });
}

// 4) Set up real-time refresh so approved transfers show up immediately
async function subscribeToChanges() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return;
  const userId = session.user.id;

  supabaseClient
    .from(`transfers:sender_id=eq.${userId}`)
    .on('UPDATE',  payload => renderTransactions())
    .subscribe();

  supabaseClient
    .from(`transfers:recipient_id=eq.${userId}`)
    .on('UPDATE',  payload => renderTransactions())
    .subscribe();
}

// 5) Wire up filter dropdown
document.getElementById('statusFilter').addEventListener('change', () => {
  document.querySelectorAll('#transactionsTable tbody tr').forEach(tr => {
    const st = tr.querySelector('.badge').textContent.split(' ').pop().toLowerCase();
    const val = document.getElementById('statusFilter').value;
    tr.style.display = (val === 'all' || st === val) ? '' : 'none';
  });
});

// Initial load + subscription
(async () => {
  // Make sure the filter defaults to "All"
  document.getElementById('statusFilter').value = 'all';
  await renderTransactions();
  await subscribeToChanges();
})();
