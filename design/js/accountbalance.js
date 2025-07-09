// -------------------------------
// GLOBAL STATE & UTILS
// -------------------------------
let depositWalletBalance  = 0;
let interestWalletBalance = 0;
let investmentIntervals   = [];

// format USD
function formatCurrency(amount) {
  return amount.toLocaleString('en-US', {
    style:    'currency',
    currency: 'USD',
  });
}

// show/hide helpers
function showLoading(id, show) {
  document.getElementById(id).style.display = show ? 'block' : 'none';
}
function showError(id, msg) {
  const e = document.getElementById(id);
  e.textContent = msg;
  e.style.display = 'block';
  setTimeout(() => e.style.display = 'none', 5000);
}
function showSuccess(id, msg) {
  const e = document.getElementById(id);
  e.textContent = msg;
  e.style.display = 'block';
  setTimeout(() => e.style.display = 'none', 5000);
}

// central UI refresh: deposit, interest, total
function refreshBalances() {
  const total = depositWalletBalance + interestWalletBalance;
  document.getElementById('depositWallet').textContent  = formatCurrency(depositWalletBalance);
  document.getElementById('accountBalance').textContent = formatCurrency(interestWalletBalance);
  document.getElementById('totalBalance').textContent  = formatCurrency(total);
}

// -------------------------------
// INITIALIZE DASHBOARD
// -------------------------------
async function initAccountBalance() {
  showLoading('invest-loading', true);
  try {
    const { data: { user }, error: authErr } = await supabaseClient.auth.getUser();
    if (authErr || !user) return window.location.href = 'login.html';
    const userId = user.id;

    // fetch both wallets
    const { data: profile, error: profErr } = await supabaseClient
      .from('profiles')
      .select('first_name, photo_url, deposit_wallet, account_balance')
      .eq('id', userId)
      .single();
    if (profErr) throw profErr;

    // assign to JS state
    depositWalletBalance  = profile.deposit_wallet   || 0;
    interestWalletBalance = profile.account_balance || 0;

    // welcome text
    document.getElementById('welcomeName').textContent = profile.first_name || 'User';

    // profile photo
    if (profile.photo_url) {
      const { data: urlData } = supabaseClient
        .storage.from('profile-photos')
        .getPublicUrl(profile.photo_url);
      const img = document.getElementById('navProfilePhoto');
      img.src = urlData.publicUrl;
      img.style.display = 'block';
      document.getElementById('defaultProfileIcon').style.display = 'none';
    }

    // first balance render
    refreshBalances();

    // wire up form & investments
    initInvestmentForm(userId);
    await loadActiveInvestments(userId);

  } catch (err) {
    console.error('Init error:', err);
    showError('invest-error', 'Error initializing page: ' + err.message);
  } finally {
    showLoading('invest-loading', false);
  }
}

// -------------------------------
// INVESTMENT FORM
// -------------------------------
function initInvestmentForm(userId) {
  const form    = document.getElementById('invest-form');
  const input   = document.getElementById('invest-amount');
  const btn     = document.getElementById('invest-btn');
  const msg     = document.getElementById('invest-validation');
  const details = document.getElementById('investment-details');
  const planLbl = document.getElementById('selected-plan');
  const roiLbl  = document.getElementById('weekly-roi');
  const profLbl = document.getElementById('weekly-profit');

  input.addEventListener('input', () => {
    const amt = parseFloat(input.value);
    msg.textContent = '';
    details.style.display = 'none';
    btn.disabled = true;

    if (isNaN(amt) || amt < 200) {
      msg.textContent = 'Amount must be at least $200';
      return;
    }
    if (amt > depositWalletBalance + interestWalletBalance) {
      msg.textContent = 'Amount exceeds your total balance';
      return;
    }
    const plan = plans.find(p => amt >= p.min && amt <= p.max);
    if (!plan) {
      msg.textContent = 'Invalid amount for any plan';
      return;
    }

    planLbl.textContent   = plan.name;
    roiLbl.textContent    = `${plan.weeklyRoi}%`;
    profLbl.textContent   = formatCurrency((amt * plan.weeklyRoi) / 100);
    details.style.display = 'block';
    btn.disabled = false;
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    showLoading('invest-loading', true);

    try {
      const amt = parseFloat(input.value);
      if (isNaN(amt) || amt < 200 || amt > depositWalletBalance + interestWalletBalance) {
        throw new Error('Invalid investment amount');
      }

      // re-fetch deposit for race safety
      const { data: profFresh, error: pErr } = await supabaseClient
        .from('profiles')
        .select('deposit_wallet')
        .eq('id', userId)
        .single();
      if (pErr) throw pErr;
      if (amt > (profFresh.deposit_wallet || 0)) {
        throw new Error('Insufficient deposit funds');
      }

      const plan = plans.find(p => amt >= p.min && amt <= p.max);
      const { data: planRow, error: planErr } = await supabaseClient
        .from('plans')
        .select('id')
        .eq('name', plan.name)
        .single();
      if (planErr || !planRow) throw new Error('Plan not found');

      // compute profit & dates (16 weeks)
      const totalProfit = (amt * plan.weeklyRoi * 16) / 100;
      const now  = new Date();
      const then = new Date(now.getTime() + 16 * 7 * 24 * 60 * 60 * 1000);

      // insert investment
      const { error: invErr } = await supabaseClient
        .from('investments')
        .insert({
          user_id:      userId,
          plan_id:      planRow.id,
          principal:    amt,
          total_profit: totalProfit,
          start_time:   now.toISOString(),
          end_time:     then.toISOString(),
          status:       'active'
        });
      if (invErr) throw invErr;

      // deduct deposit
      depositWalletBalance -= amt;
      await supabaseClient
        .from('profiles')
        .update({ deposit_wallet: depositWalletBalance })
        .eq('id', userId);

      // log transaction
      await supabaseClient
        .from('transactions')
        .insert({
          user_id:    userId,
          type:       'investment',
          amount:     amt,
          status:     'completed',
          created_at: new Date().toISOString()
        });

      // update UI & reset
      refreshBalances();
      showSuccess('invest-success', 'Investment started successfully!');
      form.reset();
      details.style.display = 'none';

      // reload active investments
      await loadActiveInvestments(userId);

    } catch (err) {
      console.error('Investment error:', err);
      showError('invest-error', 'Error starting investment: ' + err.message);
    } finally {
      showLoading('invest-loading', false);
    }
  });
}

// -------------------------------
// (your loadActiveInvestments & startInvestmentCalculator stay the same,
//  except that on profit/capital auto-payout you update interestWalletBalance
//  then call `refreshBalances()` so the UI reflects it instantly)
// -------------------------------

// finally:
initAccountBalance();
