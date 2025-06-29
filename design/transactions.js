// transactions.js

document.addEventListener('DOMContentLoaded', () => {
  // Supabase Client
  const supabaseClient = supabase.createClient(
    'https://iwkdznjqfbsfkscnbrkc.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3a2R6bmpxZmJzZmtzY25icmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2Mjk2ODgsImV4cCI6MjA2NjIwNTY4OH0.eRiXpUKP0zAMI9brPHFMxdSwZITGHxu8BPRQprkAbiU'
  );

  let transactions = [];
  let currentPage = 1;
  const perPage = 10;

  // Initialize Page
  async function initTransactionsPage() {
    AOS.init({ duration: 800, once: true });

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
      window.location.href = 'login.html';
      return;
    }
    const user = session.user;

    // Fetch user profile for name
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', user.id)
      .single();

    // Fetch transfers
    await fetchTransactions(user.id);

    // Real-time subscription
    supabaseClient
      .channel('transfers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transfers' }, () => fetchTransactions(user.id))
      .subscribe();

    // Event Listeners
    document.getElementById('searchInput').addEventListener('input', filterTransactions);
    document.getElementById('statusFilter').addEventListener('change', filterTransactions);
    document.getElementById('sortSelect').addEventListener('change', sortTransactions);
    document.getElementById('exportBtn').addEventListener('click', exportToCSV);
    document.getElementById('prevPage').addEventListener('click', () => changePage(-1));
    document.getElementById('nextPage').addEventListener('click', () => changePage(1));
    document.getElementById('logout-btn').addEventListener('click', async () => {
      await supabaseClient.auth.signOut();
      window.location.href = 'login.html';
    });
  }

  async function fetchTransactions(userId) {
    const { data, error } = await supabaseClient
      .from('transfers')
      .select('id, created_at, amount, recipient_email, sender_email, status, memo')
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) {
      alert('Error fetching transactions: ' + error.message);
      return;
    }

    // Fetch sender and recipient names
    transactions = await Promise.all(data.map(async (t) => {
      const [senderProfile, recipientProfile] = await Promise.all([
        supabaseClient.from('profiles').select('first_name, last_name').eq('email', t.sender_email).single(),
        supabaseClient.from('profiles').select('first_name, last_name').eq('email', t.recipient_email).single()
      ]);
      return {
        ...t,
        sender_name: `${senderProfile.data?.first_name || ''} ${senderProfile.data?.last_name || ''}`.trim(),
        recipient_name: `${recipientProfile.data?.first_name || ''} ${recipientProfile.data?.last_name || ''}`.trim()
      };
    }));

    renderTransactions();
  }

  function renderTransactions(filtered = transactions) {
    const transactionList = document.querySelector('.transaction-list');
    transactionList.innerHTML = '';

    const start = (currentPage - 1) * perPage;
    const end = start + perPage;
    const paginated = filtered.slice(start, end);

    paginated.forEach(t => {
      const card = document.createElement('div');
      card.className = 'transaction-card';
      card.innerHTML = `
        <div class="transaction-header">
          <span class="transaction-id">${t.id}</span>
          <span class="transaction-date">${new Date(t.created_at).toLocaleString()}</span>
        </div>
        <div class="transaction-body">
          <div class="transaction-amount">$${t.amount.toFixed(2)}</div>
          <div class="transaction-sender">From: ${t.sender_name} (${t.sender_email})</div>
          <div class="transaction-recipient">To: ${t.recipient_name} (${t.recipient_email})</div>
        </div>
        <div class="transaction-footer">
          <span class="status ${t.status.toLowerCase()}">${t.status}</span>
        </div>
      `;
      card.addEventListener('click', () => showTransactionDetails(t));
      transactionList.appendChild(card);
    });

    updatePagination(filtered.length);
  }

  function filterTransactions() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const status = document.getElementById('statusFilter').value;

    const filtered = transactions.filter(t => {
      const matchesSearch = (
        t.recipient_email.toLowerCase().includes(search) ||
        t.sender_email.toLowerCase().includes(search) ||
        t.id.toString().includes(search) ||
        (t.memo && t.memo.toLowerCase().includes(search))
      );
      const matchesStatus = !status || t.status.toLowerCase() === status;
      return matchesSearch && matchesStatus;
    });

    currentPage = 1;
    renderTransactions(filtered);
  }

  function sortTransactions() {
    const sort = document.getElementById('sortSelect').value;
    transactions.sort((a, b) => {
      if (sort === 'date-desc') return new Date(b.created_at) - new Date(a.created_at);
      if (sort === 'date-asc') return new Date(a.created_at) - new Date(b.created_at);
      if (sort === 'amount-desc') return b.amount - a.amount;
      if (sort === 'amount-asc') return a.amount - b.amount;
    });
    renderTransactions();
  }

  function updatePagination(total) {
    const totalPages = Math.ceil(total / perPage);
    document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages}`;
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages;
  }

  function changePage(delta) {
    currentPage += delta;
    renderTransactions();
  }

  function showTransactionDetails(t) {
    const modal = document.getElementById('transactionModal');
    const details = document.getElementById('modalDetails');
    details.innerHTML = `
      <p><strong>ID:</strong> ${t.id}</p>
      <p><strong>Date:</strong> ${new Date(t.created_at).toLocaleString()}</p>
      <p><strong>Amount:</strong> $${t.amount.toFixed(2)}</p>
      <p><strong>From:</strong> ${t.sender_name} (${t.sender_email})</p>
      <p><strong>To:</strong> ${t.recipient_name} (${t.recipient_email})</p>
      <p><strong>Status:</strong> ${t.status}</p>
      <p><strong>Memo:</strong> ${t.memo || 'None'}</p>
    `;
    modal.style.display = 'block';
    document.querySelector('.close-modal').onclick = () => modal.style.display = 'none';
  }

  function exportToCSV() {
    const csv = transactions.map(t => [
      t.id,
      new Date(t.created_at).toLocaleString(),
      t.amount,
      `"${t.sender_name} (${t.sender_email})"`,
      `"${t.recipient_name} (${t.recipient_email})"`,
      t.status,
      `"${t.memo || ''}"`
    ].join(',')).join('\n');
    const header = 'ID,Date,Amount,Sender,Recipient,Status,Memo\n';
    const blob = new Blob([header + csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transactions.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  initTransactionsPage();
});
