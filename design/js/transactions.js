AOS.init({ duration: 800, once: true });

// Supabase client
const { createClient } = supabase;
const supabaseClient = createClient(
  'https://iwkdznjqfbsfkscnbrkc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3a2R6bmpxZmJzZmtzY25icmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2Mjk2ODgsImV4cCI6MjA2NjIwNTY4OH0.eRiXpUKP0zAMI9brPHFMxdSwZITGHxu8BPRQprkAbiU'
);

// Common UI handlers (hamburger, theme, time, back-to-top etc.)
function initCommonUI() {
  // ... copy your hamburger, theme toggle, nav-close, time & back-to-top logic ...
}
initCommonUI();

// Fetch and render transactions
async function loadTransactions() {
  // Auth
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return window.location.href = 'login.html';

  const userId = session.user.id;
  // Query both sent and received
  const { data: transfers, error } = await supabaseClient
    .from('transfers')
    .select(`
      id, sender_id, sender_email, recipient_id, recipient_email,
      amount, status, memo, status_reason, created_at
    `)
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching transactions:', error);
    return alert('Could not load transactions. Please try later.');
  }

  const tbody = document.querySelector('#transactionsTable tbody');
  transfers.forEach(tx => {
    // Determine counterparty
    const isSender = tx.sender_id === userId;
    const counterEmail = isSender ? tx.recipient_email : tx.sender_email;
    const directionIcon = isSender ? '<i class="fas fa-arrow-up"></i>' : '<i class="fas fa-arrow-down"></i>';
    // Format date
    const dt = new Date(tx.created_at);
    const dateStr = dt.toLocaleDateString('en-US', {
      year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'
    });
    // Build row
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

// Simple column sorting
document.querySelectorAll('#transactionsTable th[data-sort]').forEach(th => {
  th.addEventListener('click', () => {
    const table = th.closest('table');
    const tbody = table.querySelector('tbody');
    const idx = Array.from(th.parentNode.children).indexOf(th);
    const asc = !th.classList.contains('asc');
    [...tbody.rows]
      .sort((a,b) => {
        let aText = a.cells[idx].textContent.trim();
        let bText = b.cells[idx].textContent.trim();
        // numeric?
        if (!isNaN(aText) && !isNaN(bText)) {
          return asc
            ? parseFloat(aText.replace(/[$,]/g,'')) - parseFloat(bText.replace(/[$,]/g,''))
            : parseFloat(bText.replace(/[$,]/g,'')) - parseFloat(aText.replace(/[$,]/g,''));
        }
        // date?
        if (Date.parse(aText) && Date.parse(bText)) {
          return asc
            ? new Date(aText) - new Date(bText)
            : new Date(bText) - new Date(aText);
        }
        return asc
          ? aText.localeCompare(bText)
          : bText.localeCompare(aText);
      })
      .forEach(row => tbody.appendChild(row));
    table.querySelectorAll('th').forEach(h=>h.classList.remove('asc','desc'));
    th.classList.add(asc ? 'asc' : 'desc');
  });
});
