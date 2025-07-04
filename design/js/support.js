// Initialize AOS
AOS.init({ duration: 800, once: true });

// Supabase client
const { createClient } = supabase;
const supabaseClient = createClient(
  'https://iwkdznjqfbsfkscnbrkc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3a2R6bmpxZmJzZmtzY25icmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2Mjk2ODgsImV4cCI6MjA2NjIwNTY4OH0.eRiXpUKP0zAMI9brPHFMxdSwZITGHxu8BPRQprkAbiU'
);

// Utility functions
function showError(message) {
  const errorDiv = document.getElementById('support-error');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  setTimeout(() => errorDiv.style.display = 'none', 5000);
}

function showSuccess(message) {
  const successDiv = document.getElementById('support-success');
  successDiv.textContent = message;
  successDiv.style.display = 'block';
  setTimeout(() => successDiv.style.display = 'none', 5000);
}

function showLoading(show) {
  document.getElementById('support-loading').style.display = show ? 'block' : 'none';
}

// Common UI
function initCommonUI() {
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const navDrawer = document.getElementById('navDrawer');
  const overlay = document.querySelector('.nav-overlay');
  const themeToggle = document.getElementById('theme-toggle');
  const accountToggle = document.getElementById('account-toggle');
  const submenu = accountToggle.nextElementSibling;
  const logoutBtn = document.getElementById('logout-btn');
  const jetButton = document.getElementById('jet-button');

  // Hamburger toggle
  hamburgerBtn.addEventListener('click', () => {
    navDrawer.classList.toggle('open');
    hamburgerBtn.classList.toggle('active');
    overlay.classList.toggle('nav-open');
    if (navDrawer.classList.contains('open')) {
      navDrawer.scrollTop = 0;
    }
  });

  // Close nav when clicking outside
  document.addEventListener('click', (event) => {
    const isClickInsideNav = navDrawer.contains(event.target);
    const isClickOnHamburger = hamburgerBtn.contains(event.target);
    if (!isClickInsideNav && !isClickOnHamburger && navDrawer.classList.contains('open')) {
      navDrawer.classList.remove('open');
      hamburgerBtn.classList.remove('active');
      overlay.classList.remove('nav-open');
    }
  });

  // Theme toggle
  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const icon = themeToggle.querySelector('i');
    icon.classList.toggle('fa-moon');
    icon.classList.toggle('fa-sun');
  });

  // Account menu toggle
  accountToggle.addEventListener('click', (e) => {
    e.preventDefault();
    submenu.classList.toggle('open');
  });

  // Jet button
  jetButton.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Time updates
  function updateTime() {
    const now = new Date();
    document.getElementById('localTime').textContent = now.toLocaleTimeString();
    document.getElementById('localDate').textContent = now.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    document.getElementById('utcTime').textContent = now.toUTCString();
  }
  setInterval(updateTime, 1000);
  updateTime();

  logoutBtn.addEventListener('click', async () => {
    try {
      const { error } = await supabaseClient.auth.signOut();
      if (error) throw error;
      window.location.href = 'login.html';
    } catch (err) {
      showError('Error logging out: ' + err.message);
    }
  });
}

async function initSupport() {
  showLoading(true);
  try {
    // Auth guard
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (!user || authError) {
      window.location.href = 'login.html';
      return;
    }

    const userId = user.id;

    // Load profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('first_name, photo_url')
      .eq('id', userId)
      .single();
    if (profileError) throw profileError;

    document.getElementById('welcomeName').textContent = profile.first_name || 'User';
    if (profile.photo_url) {
      const { data: urlData } = supabaseClient.storage
        .from('profile-photos')
        .getPublicUrl(profile.photo_url);
      document.getElementById('navProfilePhoto').src = urlData.publicUrl;
      document.getElementById('navProfilePhoto').style.display = 'block';
      document.getElementById('defaultProfileIcon').style.display = 'none';
    }

    // Load tickets
    const { data: tickets, error: ticketError } = await supabaseClient
      .from('support_tickets')
      .select('id, subject, message, status, response')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (ticketError) throw ticketError;

    const ticketTable = document.getElementById('ticket-table');
    ticketTable.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Subject</th>
            <th>Message</th>
            <th>Status</th>
            <th>Response</th>
          </tr>
        </thead>
        <tbody>
          ${tickets?.map(t => `
            <tr>
              <td>${t.id}</td>
              <td>${t.subject}</td>
              <td>${t.message}</td>
              <td>${t.status}</td>
              <td>${t.response || 'No response yet'}</td>
            </tr>
          `).join('') || '<tr><td colspan="5">No tickets found</td></tr>'}
        </tbody>
      </table>
    `;

    // Handle form submission
    const ticketForm = document.getElementById('ticket-form');
    ticketForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      showLoading(true);
      try {
        const subject = document.getElementById('ticket-subject').value.trim();
        const message = document.getElementById('ticket-message').value.trim();
        if (!subject || !message) {
          throw new Error('Subject and message are required');
        }

        const { error } = await supabaseClient
          .from('support_tickets')
          .insert({ user_id: userId, subject, message, status: 'open' });
        if (error) throw error;

        showSuccess('Ticket submitted successfully!');
        ticketForm.reset();
        // Reload tickets
        const { data: newTickets, error: newTicketError } = await supabaseClient
          .from('support_tickets')
          .select('id, subject, message, status, response')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        if (newTicketError) throw newTicketError;

        ticketTable.innerHTML = `
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Subject</th>
                <th>Message</th>
                <th>Status</th>
                <th>Response</th>
              </tr>
            </thead>
            <tbody>
              ${newTickets?.map(t => `
                <tr>
                  <td>${t.id}</td>
                  <td>${t.subject}</td>
                  <td>${t.message}</td>
                  <td>${t.status}</td>
                  <td>${t.response || 'No response yet'}</td>
                </tr>
              `).join('') || '<tr><td colspan="5">No tickets found</td></tr>'}
            </tbody>
          </table>
        `;
      } catch (err) {
        showError('Error submitting ticket: ' + err.message);
      } finally {
        showLoading(false);
      }
    });
  } catch (err) {
    showError('Error loading support page: ' + err.message);
  } finally {
    showLoading(false);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  initCommonUI();
  initSupport();
});

// Video background
const video = document.querySelector('.bg-video');
video.addEventListener('canplay', () => {
  video.play().catch(error => console.error('Error playing video:', error));
});
