// Initialize AOS
AOS.init({ duration: 800, once: true });

// Supabase client
const { createClient } = supabase;
const supabaseClient = createClient(
  'https://iwkdznjqfbsfkscnbrkc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3a2R6bmpxZmJzZmtzY25icmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2Mjk2ODgsImV4cCI6MjA2NjIwNTY4OH0.eRiXpUKP0zAMI9brPHFMxdSwZITGHxu8BPRQprkAbiU'
);

// Utility functions
function formatCurrency(amount) {
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function showError(elementId, message) {
  const errorDiv = document.getElementById(elementId);
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  setTimeout(() => errorDiv.style.display = 'none', 5000);
}

function showSuccess(elementId, message) {
  const successDiv = document.getElementById(elementId);
  successDiv.textContent = message;
  successDiv.style.display = 'block';
  setTimeout(() => successDiv.style.display = 'none', 5000);
}

function showLoading(elementId, show) {
  document.getElementById(elementId).style.display = show ? 'block' : 'none';
}

function formatTimeLeft(ms) {
  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / (24 * 3600));
  const hours = Math.floor((seconds % (24 * 3600)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${days}d ${hours}h ${minutes}m ${secs}s`;
}

// Investment plans (for frontend validation)
const plans = [
  { name: 'The Dawn Star (Basic)', min: 200, max: 4999, weeklyRoi: 5 },
  { name: 'The Nebula Glow (Standard)', min: 5000, max: 14999, weeklyRoi: 6.5 },
  { name: 'The Lunar Crest (Silver)', min: 15000, max: 49999, weeklyRoi: 7.5 },
  { name: 'The Solar Flare (Gold)', min: 50000, max: 99999, weeklyRoi: 8.5 },
  { name: 'The Galactic Crown (Diamond)', min: 100000, max: Infinity, weeklyRoi: 10 }
];

let investmentIntervals = [];

// Initialize page
async function initAccountBalance() {
  showLoading('invest-loading', true);
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
      .select('first_name, photo_url, deposit_wallet, interest_wallet')
      .eq('id', userId)
      .single();
    if (profileError) throw profileError;

    // Calculate total account balance
    const totalBalance = (profile.deposit_wallet || 0) + (profile.interest_wallet || 0);

    // Update UI
    document.getElementById('welcomeName').textContent = profile.first_name || 'User';
    document.getElementById('depositWallet').textContent = formatCurrency(profile.deposit_wallet || 0);
    document.getElementById('interestWallet').textContent = formatCurrency(profile.interest_wallet || 0);
    document.getElementById('accountBalance').textContent = formatCurrency(totalBalance);

    // Load profile photo
    if (profile.photo_url) {
      const { data: urlData } = supabaseClient.storage
        .from('profile-photos')
        .getPublicUrl(profile.photo_url);
      document.getElementById('navProfilePhoto').src = urlData.publicUrl;
      document.getElementById('navProfilePhoto').style.display = 'block';
      document.getElementById('defaultProfileIcon').style.display = 'none';
    }

    // Initialize investment form
    initInvestmentForm(totalBalance, userId, profile.deposit_wallet || 0);

    // Load active investments
    await loadActiveInvestments(userId);

    // Setup real-time subscriptions
    setupRealtimeSubscriptions(userId);
  } catch (err) {
    showError('invest-error', 'Error initializing page: ' + err.message);
    console.error('Init error:', err);
  } finally {
    showLoading('invest-loading', false);
  }
}

function initInvestmentForm(totalBalance, userId, depositWallet) {
  const investForm = document.getElementById('invest-form');
  const investAmount = document.getElementById('invest-amount');
  const investBtn = document.getElementById('invest-btn');
  const validationMessage = document.getElementById('invest-validation');
  const investmentDetails = document.getElementById('investment-details');
  const selectedPlan = document.getElementById('selected-plan');
  const weeklyRoi = document.getElementById('weekly-roi');
  const weeklyProfit = document.getElementById('weekly-profit');

  investAmount.addEventListener('input', () => {
    const amount = parseFloat(investAmount.value);
    validationMessage.textContent = '';
    investmentDetails.style.display = 'none';
    investBtn.disabled = true;

    if (isNaN(amount) || amount < 200) {
      validationMessage.textContent = 'Amount must be at least $200';
      return;
    }
    if (amount > totalBalance) {
      validationMessage.textContent = 'Amount exceeds your total account balance';
      return;
    }
    if (amount > depositWallet) {
      validationMessage.textContent = 'Amount exceeds your deposit wallet balance';
      return;
    }

    const plan = plans.find(p => amount >= p.min && amount <= p.max);
    if (!plan) {
      validationMessage.textContent = 'Invalid amount for any investment plan';
      return;
    }

    selectedPlan.textContent = plan.name;
    weeklyRoi.textContent = `${plan.weeklyRoi}%`;
    weeklyProfit.textContent = formatCurrency((amount * plan.weeklyRoi) / 100);
    investmentDetails.style.display = 'block';
    investBtn.disabled = false;
  });

  investForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading('invest-loading', true);
    try {
      const amount = parseFloat(investAmount.value);
      if (isNaN(amount) || amount < 200 || amount > totalBalance || amount > depositWallet) {
        throw new Error('Invalid investment amount');
      }

      const plan = plans.find(p => amount >= p.min && amount <= p.max);
      if (!plan) throw new Error('No matching investment plan');

      // Fetch plan UUID from Supabase
      const { data: planData, error: planError } = await supabaseClient
        .from('plans')
        .select('id')
        .eq('name', plan.name)
        .single();
      if (planError || !planData) throw new Error('Plan not found in database');

      // Calculate investment details
      const totalProfit = (amount * plan.weeklyRoi * 16) / 100; // 16 weeks = 4 months
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 16 * 7 * 24 * 60 * 60 * 1000); // 16 weeks

      // Insert investment
      const { error: investError } = await supabaseClient
        .from('investments')
        .insert({
          user_id: userId,
          plan_id: planData.id,
          principal: amount,
          total_profit: totalProfit,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          status: 'active'
        });
      if (investError) throw investError;

      // Update deposit wallet
      const newDepositWallet = depositWallet - amount;
      const { error: profileError } = await supabaseClient
        .from('profiles')
        .update({ deposit_wallet: newDepositWallet })
        .eq('id', userId);
      if (profileError) throw profileError;

      // Update UI
      document.getElementById('depositWallet').textContent = formatCurrency(newDepositWallet);
      document.getElementById('accountBalance').textContent = formatCurrency(newDepositWallet + (document.getElementById('interestWallet').textContent.replace(/[^0-9.-]+/g, '') || 0));
      showSuccess('invest-success', 'Investment started successfully!');
      investForm.reset();
      investmentDetails.style.display = 'none';
      await loadActiveInvestments(userId);
    } catch (err) {
      showError('invest-error', 'Error starting investment: ' + err.message);
      console.error('Investment error:', err);
    } finally {
      showLoading('invest-loading', false);
    }
  });
}

async function loadActiveInvestments(userId) {
  showLoading('investments-loading', true);
  try {
    const { data: investments, error } = await supabaseClient
      .from('investments')
      .select(`
        id, plan_id, principal, total_profit, start_time, end_time, status,
        plan:plans (name)
      `)
      .eq('user_id', userId)
      .in('status', ['active', 'profit_ready', 'profit_transferred'])
      .order('start_time', { ascending: false });
    if (error) throw error;

    const container = document.getElementById('investments-container');
    const noInvestmentsDiv = document.getElementById('no-investments');
    container.innerHTML = '';
    noInvestmentsDiv.style.display = investments.length ? 'none' : 'block';

    if (investments.length) {
      const fragment = document.createDocumentFragment();
      investments.forEach(investment => {
        const investmentDiv = document.createElement('div');
        investmentDiv.className = 'investment-item';
        investmentDiv.dataset.id = investment.id;
        const now = new Date();
        const start = new Date(investment.start_time);
        const end = new Date(investment.end_time);
        const msSinceStart = now - start;
        const daysSinceStart = msSinceStart / (1000 * 60 * 60 * 24);
        const canWithdraw = daysSinceStart >= 14 && investment.status === 'profit_transferred';
        const canReinvest = daysSinceStart >= 7 && daysSinceStart <= 120 && investment.status === 'active';
        investmentDiv.innerHTML = `
          <p>Plan: <span>${investment.plan?.name ?? 'Unknown'}</span></p>
          <p>Invested Amount: <span>${formatCurrency(investment.principal)}</span></p>
          <p>Current Profit: <span class="current-profit">${formatCurrency(0)}</span></p>
          <p>Time Remaining: <span class="time-left"></span></p>
          <p class="status-message"></p>
          <button class="withdraw-btn" ${canWithdraw ? '' : 'disabled'}>Withdraw Capital</button>
          <button class="reinvest-btn" ${canReinvest ? '' : 'disabled'}>Reinvest</button>
        `;
        fragment.appendChild(investmentDiv);
        startInvestmentCalculator(investment, investmentDiv);

        // Withdraw button handler
        const withdrawBtn = investmentDiv.querySelector('.withdraw-btn');
        withdrawBtn.addEventListener('click', async () => {
          if (!canWithdraw) return;
          if (!confirm('Are you sure you want to withdraw your capital?')) return;
          try {
            const { data: profile, error: profileError } = await supabaseClient
              .from('profiles')
              .select('interest_wallet')
              .eq('id', userId)
              .single();
            if (profileError) throw profileError;
            const currentInterest = profile.interest_wallet || 0;
            const newInterest = currentInterest + investment.principal;
            await supabaseClient
              .from('profiles')
              .update({ interest_wallet: newInterest })
              .eq('id', userId);
            await supabaseClient
              .from('transactions')
              .insert({
                user_id: userId,
                type: 'capital',
                amount: investment.principal,
                status: 'completed',
                created_at: new Date().toISOString()
              });
            await supabaseClient
              .from('investments')
              .update({ status: 'withdrawn' })
              .eq('id', investment.id);
            investmentDiv.innerHTML += '<p>Capital withdrawn.</p>';
            withdrawBtn.disabled = true;
            showSuccess('invest-success', 'Capital withdrawn successfully!');
          } catch (err) {
            showError('investments-error', 'Error withdrawing capital: ' + err.message);
          }
        });

        // Reinvest button handler
        const reinvestBtn = investmentDiv.querySelector('.reinvest-btn');
        reinvestBtn.addEventListener('click', async () => {
          if (!canReinvest) return;
          if (!confirm('Do you want to reinvest your capital and profits?')) return;
          try {
            const { data, error } = await supabaseClient.rpc('reinvest_investment', {
              user_uuid: userId,
              old_investment_id: investment.id,
              reinvest_amount: investment.principal + investment.total_profit
            });
            if (error) throw error;
            await supabaseClient
              .from('transactions')
              .insert({
                user_id: userId,
                type: 'investment',
                amount: investment.principal + investment.total_profit,
                status: 'completed',
                created_at: new Date().toISOString()
              });
            showSuccess('invest-success', 'Reinvestment successful!');
            await loadActiveInvestments(userId);
          } catch (err) {
            showError('investments-error', 'Error during reinvestment: ' + err.message);
          }
        });
      });
      container.appendChild(fragment);
    }
  } catch (err) {
    showError('investments-error', 'Error loading investments: ' + err.message);
    console.error('Load investments error:', err);
  } finally {
    showLoading('investments-loading', false);
  }
}

function startInvestmentCalculator(investment, investmentDiv) {
  const { start_time, end_time, principal, total_profit, status } = investment;
  const startTime = new Date(start_time);
  const endTime = new Date(end_time);
  const totalSeconds = (endTime - startTime) / 1000;
  const profitPerSecond = total_profit / totalSeconds;
  const currentProfitSpan = investmentDiv.querySelector('.current-profit');
  const timeLeftSpan = investmentDiv.querySelector('.time-left');
  const statusMessage = investmentDiv.querySelector('.status-message');

  const updateInvestment = () => {
    const now = new Date();
    const daysSinceEnd = (now - endTime) / (1000 * 60 * 60 * 24);
    if (status === 'active') {
      const elapsedSeconds = (now - startTime) / 1000;
      const currentProfit = Math.min(elapsedSeconds * profitPerSecond, total_profit);
      currentProfitSpan.textContent = formatCurrency(currentProfit);
      const timeLeftMs = endTime - now;
      timeLeftSpan.textContent = formatTimeLeft(timeLeftMs);
      statusMessage.textContent = 'Investment in progress';
    } else if (status === 'profit_ready') {
      currentProfitSpan.textContent = formatCurrency(total_profit);
      timeLeftSpan.textContent = 'Investment ended';
      const profitDate = new Date(endTime.getTime() + 7 * 24 * 60 * 60 * 1000);
      statusMessage.textContent = now < profitDate 
        ? `Profits transfer in ${Math.ceil((profitDate - now) / (1000 * 60 * 60 * 24))} days`
        : 'Profits transferring soon';
    } else if (status === 'profit_transferred') {
      currentProfitSpan.textContent = formatCurrency(total_profit);
      timeLeftSpan.textContent = 'Profits transferred';
      const capitalDate = new Date(endTime.getTime() + 14 * 24 * 60 * 60 * 1000);
      statusMessage.textContent = now < capitalDate 
        ? `Capital transfer in ${Math.ceil((capitalDate - now) / (1000 * 60 * 60 * 24))} days`
        : 'Capital transferring soon';
    }
  };

  const interval = setInterval(updateInvestment, 500);
  investmentIntervals.push(interval);
  updateInvestment();
}

function clearAllInvestmentIntervals() {
  investmentIntervals.forEach(id => clearInterval(id));
  investmentIntervals = [];
}

function setupRealtimeSubscriptions(userId) {
  const profileSubscription = supabaseClient
    .channel(`profiles:id=eq.${userId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` }, async (payload) => {
      const { deposit_wallet, interest_wallet } = payload.new;
      const totalBalance = (deposit_wallet || 0) + (interest_wallet || 0);
      document.getElementById('depositWallet').textContent = formatCurrency(deposit_wallet || 0);
      document.getElementById('interestWallet').textContent = formatCurrency(interest_wallet || 0);
      document.getElementById('accountBalance').textContent = formatCurrency(totalBalance);
      initInvestmentForm(totalBalance, userId, deposit_wallet || 0);
    })
    .subscribe();

  const investmentSubscription = supabaseClient
    .channel(`investments:user_id=eq.${userId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'investments', filter: `user_id=eq.${userId}` }, () => {
      loadActiveInvestments(userId);
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'investments', filter: `user_id=eq.${userId}` }, (payload) => {
      refreshSingleInvestment(payload.new);
    })
    .subscribe();

  window.addEventListener('beforeunload', () => {
    supabaseClient.removeChannel(profileSubscription);
    supabaseClient.removeChannel(investmentSubscription);
  });
}

function refreshSingleInvestment(investment) {
  const investmentDiv = document.querySelector(`.investment-item[data-id="${investment.id}"]`);
  if (investmentDiv) {
    const currentProfitSpan = investmentDiv.querySelector('.current-profit');
    const timeLeftSpan = investmentDiv.querySelector('.time-left');
    const statusMessage = investmentDiv.querySelector('.status-message');
    const now = new Date();
    const endTime = new Date(investment.end_time);
    currentProfitSpan.textContent = formatCurrency(investment.total_profit || 0);
    if (investment.status === 'active') {
      timeLeftSpan.textContent = formatTimeLeft(endTime - now);
      statusMessage.textContent = 'Investment in progress';
    } else if (investment.status === 'profit_ready') {
      timeLeftSpan.textContent = 'Investment ended';
      const profitDate = new Date(endTime.getTime() + 7 * 24 * 60 * 60 * 1000);
      statusMessage.textContent = now < profitDate 
        ? `Profits transfer in ${Math.ceil((profitDate - now) / (1000 * 60 * 60 * 24))} days`
        : 'Profits transferring soon';
    } else if (investment.status === 'profit_transferred') {
      timeLeftSpan.textContent = 'Profits transferred';
      const capitalDate = new Date(endTime.getTime() + 14 * 24 * 60 * 60 * 1000);
      statusMessage.textContent = now < capitalDate 
        ? `Capital transfer in ${Math.ceil((capitalDate - now) / (1000 * 60 * 60 * 24))} days`
        : 'Capital transferring soon';
    }
  }
}

// UI Interactions
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

document.addEventListener('click', (event) => {
  const isClickInsideNav = navDrawer.contains(event.target);
  const isClickOnHamburger = hamburgerBtn.contains(event.target);
  if (!isClickInsideNav && !isClickOnHamburger && navDrawer.classList.contains('open')) {
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
accountToggle.addEventListener('click', (e) => {
  e.preventDefault();
  submenu.classList.toggle('open');
});

document.getElementById('back-to-top').addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
    window.location.href = 'login.html';
  } catch (err) {
    showError('invest-error', 'Error logging out: ' + err.message);
  }
});

function updateTimes() {
  const now = new Date();
  document.getElementById('localTime').textContent = now.toLocaleTimeString();
  document.getElementById('localDate').textContent = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  document.getElementById('utcTime').textContent = now.toUTCString();
}
setInterval(updateTimes, 1000);
updateTimes();

const video = document.querySelector('.bg-video');
if (video) {
  let retryCount = 0;
  const maxRetries = 3;
  const retryDelay = 1000;
  const playVideo = () => {
    video.play()
      .then(() => retryCount = 0)
      .catch(error => {
        console.error(`Video play failed (attempt ${retryCount + 1}):`, error);
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(playVideo, retryDelay);
        }
      });
  };
  playVideo();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && video.paused) {
      playVideo();
    } else {
      video.pause();
    }
  });
}

// Initialize page
initAccountBalance();
