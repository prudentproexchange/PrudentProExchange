// -------------------------------
// GLOBAL STATE & UTILITIES
// -------------------------------
let depositWalletBalance = 0;
let interestWalletBalance = 0;
let investmentIntervals = [];

// format numbers as USD
function formatCurrency(amount) {
  return amount.toLocaleString('en-US', {
    style:    'currency',
    currency: 'USD',
  });
}

// show / hide a loading spinner or message
function showLoading(elementId, show) {
  document.getElementById(elementId).style.display = show ? 'block' : 'none';
}
function showError(elementId, message) {
  const e = document.getElementById(elementId);
  e.textContent = message;
  e.style.display = 'block';
  setTimeout(() => e.style.display = 'none', 5000);
}
function showSuccess(elementId, message) {
  const e = document.getElementById(elementId);
  e.textContent = message;
  e.style.display = 'block';
  setTimeout(() => e.style.display = 'none', 5000);
}

// CENTRALIZED BALANCE REFRESH
function refreshBalances() {
  // depositWalletBalance & interestWalletBalance are globals
  const total = depositWalletBalance + interestWalletBalance;
  document.getElementById('depositWallet').textContent  = formatCurrency(depositWalletBalance);
  document.getElementById('interestWallet').textContent = formatCurrency(interestWalletBalance);
  document.getElementById('totalBalance').textContent  = formatCurrency(total);
  document.getElementById('accountBalance').textContent = formatCurrency(total);
}

// -------------------------------
// INITIALIZATION
// -------------------------------
async function initAccountBalance() {
  showLoading('invest-loading', true);
  try {
    // auth guard
    const { data: { user }, error: authErr } = await supabaseClient.auth.getUser();
    if (authErr || !user) {
      return window.location.href = 'login.html';
    }
    const userId = user.id;

    // pull profile
    const { data: profile, error: profErr } = await supabaseClient
      .from('profiles')
      .select('first_name, photo_url, deposit_wallet, interest_wallet')
      .eq('id', userId)
      .single();
    if (profErr) throw profErr;

    // set globals and welcome
    depositWalletBalance  = profile.deposit_wallet  || 0;
    interestWalletBalance = profile.interest_wallet || 0;
    document.getElementById('welcomeName').textContent = profile.first_name || 'User';

    // profile photo
    if (profile.photo_url) {
      const { data: urlData } = supabaseClient
        .storage.from('profile-photos')
        .getPublicUrl(profile.photo_url);
      document.getElementById('navProfilePhoto').src = urlData.publicUrl;
      document.getElementById('navProfilePhoto').style.display = 'block';
      document.getElementById('defaultProfileIcon').style.display = 'none';
    }

    // first balance render
    refreshBalances();

    // wire up form & load investments
    initInvestmentForm(userId);
    await loadActiveInvestments(userId);

  } catch (err) {
    console.error(err);
    showError('invest-error', 'Error initializing page: ' + err.message);
  } finally {
    showLoading('invest-loading', false);
  }
}

// -------------------------------
// INVESTMENT FORM
// -------------------------------
function initInvestmentForm(userId) {
  const form            = document.getElementById('invest-form');
  const amountInput     = document.getElementById('invest-amount');
  const investBtn       = document.getElementById('invest-btn');
  const validationMsg   = document.getElementById('invest-validation');
  const detailsPanel    = document.getElementById('investment-details');
  const planLabel       = document.getElementById('selected-plan');
  const roiLabel        = document.getElementById('weekly-roi');
  const profitLabel     = document.getElementById('weekly-profit');

  // on-the-fly validation & preview
  amountInput.addEventListener('input', () => {
    const amt = parseFloat(amountInput.value);
    validationMsg.textContent = '';
    detailsPanel.style.display = 'none';
    investBtn.disabled = true;

    if (isNaN(amt) || amt < 200) {
      validationMsg.textContent = 'Minimum $200';
      return;
    }
    if (amt > depositWalletBalance + interestWalletBalance) {
      validationMsg.textContent = 'Exceeds available balance';
      return;
    }
    const plan = plans.find(p => amt >= p.min && amt <= p.max);
    if (!plan) {
      validationMsg.textContent = 'No plan matches that amount';
      return;
    }

    planLabel.textContent   = plan.name;
    roiLabel.textContent    = `${plan.weeklyRoi}%`;
    profitLabel.textContent = formatCurrency((amt * plan.weeklyRoi) / 100);
    detailsPanel.style.display = 'block';
    investBtn.disabled = false;
  });

  // on submit
  form.addEventListener('submit', async e => {
    e.preventDefault();
    showLoading('invest-loading', true);
    try {
      const amt = parseFloat(amountInput.value);
      if (isNaN(amt)) throw new Error('Invalid amount');

      // re-fetch deposit to avoid race
      const { data: prof, error: pErr } = await supabaseClient
        .from('profiles')
        .select('deposit_wallet')
        .eq('id', userId)
        .single();
      if (pErr) throw pErr;
      if (amt > (prof.deposit_wallet || 0)) {
        throw new Error('Insufficient deposit funds');
      }

      // lookup plan ID in DB
      const plan  = plans.find(p => amt >= p.min && amt <= p.max);
      const { data: planRow, error: planErr } = await supabaseClient
        .from('plans')
        .select('id')
        .eq('name', plan.name)
        .single();
      if (planErr || !planRow) throw new Error('Plan not found');

      // compute timeline & total profit (16 weeks)
      const totalProfit = (amt * plan.weeklyRoi * 16) / 100;
      const now   = new Date();
      const then  = new Date(now.getTime() + 16 * 7 * 24 * 60 * 60 * 1000);

      // INSERT investment
      const { error: invErr } = await supabaseClient
        .from('investments')
        .insert({
          user_id:     userId,
          plan_id:     planRow.id,
          principal:   amt,
          total_profit: totalProfit,
          start_time:  now.toISOString(),
          end_time:    then.toISOString(),
          status:      'active'
        });
      if (invErr) throw invErr;

      // DEDUCT deposit
      depositWalletBalance -= amt;
      await supabaseClient
        .from('profiles')
        .update({ deposit_wallet: depositWalletBalance })
        .eq('id', userId);

      // LOG transaction
      await supabaseClient
        .from('transactions')
        .insert({
          user_id:    userId,
          type:       'investment',
          amount:     amt,
          status:     'completed',
          created_at: new Date().toISOString()
        });

      // refresh UI balances & clear form
      refreshBalances();
      showSuccess('invest-success', 'Investment started!');
      form.reset();
      detailsPanel.style.display = 'none';

      // reload the investments list
      await loadActiveInvestments(userId);

    } catch (err) {
      console.error(err);
      showError('invest-error', 'Error starting investment: ' + err.message);
    } finally {
      showLoading('invest-loading', false);
    }
  });
}

// -------------------------------
// ACTIVE INVESTMENTS & AUTO-CALCULATOR
// -------------------------------
async function loadActiveInvestments(userId) {
  showLoading('investments-loading', true);
  try {
    clearAllInvestmentIntervals();
    const { data: invs, error } = await supabaseClient
      .from('investments')
      .select(`*, plan:plans(name)`)
      .eq('user_id', userId)
      .in('status', ['active','profit_ready'])
      .order('start_time', { ascending: false });
    if (error) throw error;

    const container = document.getElementById('investments-container');
    container.innerHTML = '';
    document.getElementById('no-investments').style.display = invs.length ? 'none' : 'block';

    invs.forEach(inv => {
      const div = document.createElement('div');
      div.className = 'investment-item';
      div.dataset.id = inv.id;
      div.innerHTML = `
        <p>Plan: <span>${inv.plan?.name}</span></p>
        <p>Invested: <span>${formatCurrency(inv.principal)}</span></p>
        <p>Profit so far: <span class="current-profit">${formatCurrency(0)}</span></p>
        <p>Time Left: <span class="time-left"></span></p>
      `;
      container.appendChild(div);
      startInvestmentCalculator(inv, div);
    });
  } catch (err) {
    console.error(err);
    showError('investments-error', 'Error loading investments: ' + err.message);
  } finally {
    showLoading('investments-loading', false);
  }
}

function startInvestmentCalculator(inv, div) {
  const startTime = new Date(inv.start_time);
  const endTime   = new Date(inv.end_time);
  const totalSec  = (endTime - startTime) / 1000;
  const ratePerS  = inv.total_profit / totalSec;
  let doneProfitTransfer  = false;
  let doneCapitalTransfer = false;

  const profitSpan = div.querySelector('.current-profit');
  const timeSpan   = div.querySelector('.time-left');

  const tick = async () => {
    const now = new Date();
    const elapsedSec = (now - startTime) / 1000;

    // 1) Active accrual
    if (inv.status === 'active' && now < endTime) {
      const prof    = Math.min(elapsedSec * ratePerS, inv.total_profit);
      profitSpan.textContent = formatCurrency(prof);
      timeSpan.textContent   = formatTimeLeft(endTime - now);

    // 2) End reached → status flip & message
    } else if (inv.status === 'active' && now >= endTime) {
      profitSpan.textContent = formatCurrency(inv.total_profit);
      timeSpan.textContent   = '0d 0h 0m 0s';

      // mark profit_ready once
      inv.status = 'profit_ready';
      await supabaseClient
        .from('investments')
        .update({ status: 'profit_ready' })
        .eq('id', inv.id);

      const msg = document.createElement('p');
      msg.textContent = 'Done! Profits auto-transfer in 7 days, capital in 14 days.';
      div.appendChild(msg);
    }

    // DAYS since plan ended
    const daysAfterEnd = (now - endTime) / (1000*60*60*24);

    // 3) After 7 days → profit transfer
    if (inv.status === 'profit_ready' && daysAfterEnd >= 7 && !doneProfitTransfer) {
      doneProfitTransfer = true;

      // pull current interest
      const { data: prof, error } = await supabaseClient
        .from('profiles')
        .select('interest_wallet')
        .eq('id', inv.user_id)
        .single();
      if (!error) {
        interestWalletBalance = (prof.interest_wallet || 0) + inv.total_profit;
        await supabaseClient
          .from('profiles')
          .update({ interest_wallet: interestWalletBalance })
          .eq('id', inv.user_id);

        // log txn
        await supabaseClient
          .from('transactions')
          .insert({
            user_id: inv.user_id,
            type:    'profit',
            amount:  inv.total_profit,
            status:  'completed',
            created_at: new Date().toISOString()
          });

        refreshBalances();
      }
    }

    // 4) After 14 days → capital transfer & complete
    if (inv.status === 'profit_ready' && daysAfterEnd >= 14 && !doneCapitalTransfer) {
      doneCapitalTransfer = true;

      const { data: prof, error } = await supabaseClient
        .from('profiles')
        .select('interest_wallet')
        .eq('id', inv.user_id)
        .single();
      if (!error) {
        interestWalletBalance = (prof.interest_wallet || 0) + inv.principal;
        await supabaseClient
          .from('profiles')
          .update({ interest_wallet: interestWalletBalance })
          .eq('id', inv.user_id);

        await supabaseClient
          .from('transactions')
          .insert({
            user_id:    inv.user_id,
            type:       'capital',
            amount:     inv.principal,
            status:     'completed',
            created_at: new Date().toISOString()
          });

        // finally mark completed
        await supabaseClient
          .from('investments')
          .update({ status: 'completed' })
          .eq('id', inv.id);

        const p = document.createElement('p');
        p.textContent = 'Capital moved to interest wallet.';
        div.appendChild(p);

        refreshBalances();
      }
    }
  };

  // kick off and every half-second
  tick();
  const iv = setInterval(tick, 500);
  investmentIntervals.push(iv);
}

function formatTimeLeft(ms) {
  const s  = Math.floor(ms/1000);
  const d  = Math.floor(s/(24*3600));
  const h  = Math.floor((s%(24*3600))/3600);
  const m  = Math.floor((s%3600)/60);
  const sec= s%60;
  return `${d}d ${h}h ${m}m ${sec}s`;
}

function clearAllInvestmentIntervals() {
  investmentIntervals.forEach(i=>clearInterval(i));
  investmentIntervals = [];
}

// -------------------------------
// PAGE BOOTSTRAP
// -------------------------------
document.getElementById('logout-btn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  window.location.href = 'login.html';
});

// wire up your AOS, hamburger, theme-toggle, time updater, etc. here…

initAccountBalance();
