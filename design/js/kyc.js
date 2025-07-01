// Initialize AOS animations
AOS.init({ duration: 800, once: true });

// Supabase client
const { createClient } = supabase;
const supabaseClient = createClient(
  'https://iwkdznjqfbsfkscnbrkc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3a2R6bmpxZmJzZmtzY25icmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2Mjk2ODgsImV4cCI6MjA2NjIwNTY4OH0.eRiXpUKP0zAMI9brPHFMxdSwZITGHxu8BPRQprkAbiU'
);

let currentUserId = null;
let tempSession = null;

// Common UI Initialization
function initCommonUI() {
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const navDrawer = document.getElementById('navDrawer');
  const overlay = document.querySelector('.nav-overlay');

  hamburgerBtn.addEventListener('click', () => {
    const isOpen = navDrawer.classList.toggle('open');
    hamburgerBtn.classList.toggle('active');
    overlay.classList.toggle('nav-open');
    hamburgerBtn.setAttribute('aria-expanded', isOpen);
  });

  document.addEventListener('click', (e) => {
    if (!navDrawer.contains(e.target) && !hamburgerBtn.contains(e.target) && navDrawer.classList.contains('open')) {
      navDrawer.classList.remove('open');
      hamburgerBtn.classList.remove('active');
      overlay.classList.remove('nav-open');
      hamburgerBtn.setAttribute('aria-expanded', 'false');
    }
  });

  const themeToggle = document.getElementById('theme-toggle');
  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const icon = themeToggle.querySelector('i');
    icon.classList.toggle('fa-moon');
    icon.classList.toggle('fa-sun');
    themeToggle.setAttribute('aria-label', document.body.classList.contains('light-theme') ? 'Switch to dark theme' : 'Switch to light theme');
  });

  const accountToggle = document.getElementById('account-toggle');
  const submenu = accountToggle.nextElementSibling;
  accountToggle.addEventListener('click', (e) => {
    e.preventDefault();
    const isOpen = submenu.classList.toggle('open');
    accountToggle.setAttribute('aria-expanded', isOpen);
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
  });

  document.getElementById('back-to-top').addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  function updateTimes() {
    const now = new Date();
    document.getElementById('utcTime').textContent = now.toUTCString();
    document.getElementById('localTime').textContent = now.toLocaleTimeString();
    document.getElementById('localDate').textContent = now.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }
  setInterval(updateTimes, 1000);
  updateTimes();
}
initCommonUI();

// KYC Logic
async function loadKYC() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  const authSection = document.getElementById('auth-section');
  const totpSection = document.getElementById('totp-section');
  const kycStatus = document.getElementById('kyc-status');
  const kycForm = document.getElementById('kyc-form');

  if (!session) {
    authSection.style.display = 'block';
    handleAuth();
  } else {
    currentUserId = session.user.id;
    const { data: profile, error } = await supabaseClient
      .from('profiles')
      .select('two_fa_enabled')
      .eq('id', currentUserId)
      .single();
    if (error) {
      showMessage('Error loading profile.', true);
      return;
    }
    if (profile.two_fa_enabled) {
      totpSection.style.display = 'block';
      handleTOTPVerificationForKYC();
    } else {
      await loadProfile(currentUserId);
      await checkKYCStatus(currentUserId);
      kycForm.style.display = 'block';
    }
  }
}

function handleTOTPVerificationForKYC() {
  const totpSubmit = document.getElementById('totp-submit');
  // Remove any existing listeners to prevent duplicates
  totpSubmit.removeEventListener('click', handleTOTPClick);
  totpSubmit.addEventListener('click', handleTOTPClick);
}

async function handleTOTPClick() {
  const code = document.getElementById('totp-code').value;
  if (!/^\d{6}$/.test(code)) {
    showMessage('Enter a valid 6-digit code.', true);
    return;
  }

  const btn = document.getElementById('totp-submit');
  btn.classList.add('loading');
  btn.disabled = true;
  btn.textContent = 'Verifying...';

  try {
    const response = await fetch('/.netlify/functions/verify-totp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: currentUserId, token: code })
    });
    const result = await response.json();

    btn.classList.remove('loading');
    btn.disabled = false;
    btn.textContent = 'Verify Code';

    if (result.ok) {
      document.getElementById('totp-section').style.display = 'none';
      await loadProfile(currentUserId);
      await checkKYCStatus(currentUserId);
      document.getElementById('kyc-form').style.display = 'block';
    } else {
      showMessage('Invalid 2FA code.', true);
    }
  } catch (err) {
    btn.classList.remove('loading');
    btn.disabled = false;
    btn.textContent = 'Verify Code';
    showMessage('Error verifying 2FA code.', true);
  }
}

async function handleAuth() {
  const authForm = document.getElementById('authForm');
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button');
    btn.classList.add('loading');
    btn.disabled = true;
    btn.textContent = 'Logging in...';

    const { data: authData, error } = await supabaseClient.auth.signInWithPassword({
      email: form.email.value,
      password: form.password.value,
    });

    btn.classList.remove('loading');
    btn.disabled = false;
    btn.textContent = 'Log In';

    if (error) {
      showMessage('Login error: ' + error.message, true);
      return;
    }

    tempSession = authData.session;
    currentUserId = authData.user.id;
    const { data: profile, error: profErr } = await supabaseClient
      .from('profiles')
      .select('two_fa_enabled')
      .eq('id', currentUserId)
      .single();

    if (profErr) {
      showMessage('Error checking 2FA status.', true);
      return;
    }

    if (profile.two_fa_enabled) {
      authForm.style.display = 'none';
      document.getElementById('totp-section').style.display = 'block';
    } else {
      await supabaseClient.auth.setSession(tempSession);
      await loadProfile(currentUserId);
      await checkKYCStatus(currentUserId);
      document.getElementById('auth-section').style.display = 'none';
      document.getElementById('kyc-form').style.display = 'block';
    }
  });

  // TOTP for login
  document.getElementById('totp-submit').addEventListener('click', async () => {
    const code = document.getElementById('totp-code').value;
    if (!/^\d{6}$/.test(code)) {
      showMessage('Enter a valid 6-digit code.', true);
      return;
    }

    const btn = document.getElementById('totp-submit');
    btn.classList.add('loading');
    btn.disabled = true;
    btn.textContent = 'Verifying...';

    try {
      const response = await fetch('/.netlify/functions/verify-totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUserId, token: code })
      });
      const result = await response.json();

      btn.classList.remove('loading');
      btn.disabled = false;
      btn.textContent = 'Verify Code';

      if (result.ok) {
        await supabaseClient.auth.setSession(tempSession);
        await loadProfile(currentUserId);
        await checkKYCStatus(currentUserId);
        document.getElementById('auth-section').style.display = 'none';
        document.getElementById('kyc-form').style.display = 'block';
      } else {
        showMessage('Invalid 2FA code.', true);
      }
    } catch (err) {
      btn.classList.remove('loading');
      btn.disabled = false;
      btn.textContent = 'Verify Code';
      showMessage('Error verifying 2FA code.', true);
    }
  });
}

async function loadProfile(userId) {
  const { data: profile, error } = await supabaseClient.from('profiles').select('*').eq('id', userId).single();
  if (error) {
    showMessage('Error loading profile.', true);
    return;
  }
  document.getElementById('welcomeName').textContent = profile.first_name || 'User';
  if (profile.photo_url) {
    const { data: urlData } = supabaseClient.storage.from('profile-photos').getPublicUrl(profile.photo_url);
    document.getElementById('navProfilePhoto').src = urlData.publicUrl;
    document.getElementById('navProfilePhoto').style.display = 'block';
    document.getElementById('defaultProfileIcon').style.display = 'none';
  }
}

async function checkKYCStatus(userId) {
  const { data: kycRequests, error } = await supabaseClient
    .from('kyc_requests')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    showMessage('Error checking KYC status.', true);
    return;
  }

  const statusMessage = document.getElementById('status-message');
  if (kycRequests.length > 0) {
    const latest = kycRequests[0];
    document.getElementById('kyc-status').style.display = 'block';
    if (latest.status === 'approved') {
      statusMessage.textContent = 'Your KYC is approved.';
      document.getElementById('kyc-form').style.display = 'none';
    } else if (latest.status === 'rejected') {
      statusMessage.textContent = `Your KYC was rejected. Reason: ${latest.admin_notes || 'None'}`;
    } else {
      statusMessage.textContent = 'Your KYC request is pending approval.';
      document.getElementById('kyc-form').style.display = 'none';
    }
  }
}

function initForm() {
  const countries = [
    { code: 'US', name: 'United States' },
    { code: 'CA', name: 'Canada' },
    { code: 'GB', name: 'United Kingdom' },
  ];
  const nationalitySelect = document.querySelector('select[name="nationality"]');
  countries.forEach(c => {
    const option = document.createElement('option');
    option.value = c.code;
    option.textContent = c.name;
    nationalitySelect.appendChild(option);
  });

  let currentStep = 1;
  const steps = document.querySelectorAll('.step');
  const indicators = document.querySelectorAll('.step-indicator');

  function showStep(step) {
    steps.forEach(s => s.style.display = 'none');
    document.getElementById(`step${step}`).style.display = 'block';
    indicators.forEach((i, idx) => i.classList.toggle('active', idx + 1 === step));
  }
  showStep(currentStep);

  document.querySelectorAll('.next-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (validateStep(currentStep)) {
        currentStep++;
        if (currentStep === 5) populateReview();
        showStep(currentStep);
      }
    });
  });

  document.querySelectorAll('.prev-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentStep--;
      showStep(currentStep);
    });
  });

  // Drag-and-drop
  const dropZones = document.querySelectorAll('.drop-zone');
  dropZones.forEach(zone => {
    const input = zone.previousElementSibling;
    zone.addEventListener('dragover', e => e.preventDefault());
    zone.addEventListener('drop', e => {
      e.preventDefault();
      input.files = e.dataTransfer.files;
      previewFile(input);
    });
    input.addEventListener('change', () => previewFile(input));
  });

  document.getElementById('kycForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    if (validateAllSteps()) {
      try {
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);
        const userId = (await supabaseClient.auth.getSession()).data.session.user.id;

        const documentFile = formData.get('document_scan');
        const addressFile = formData.get('proof_of_address');
        if (documentFile && documentFile.size > 0) {
          data.document_scan = await uploadFile(documentFile, `documents/${userId}_${Date.now()}_${documentFile.name}`);
        } else {
          throw new Error('Document scan is required.');
        }
        if (addressFile && addressFile.size > 0) {
          data.proof_of_address = await uploadFile(addressFile, `proofs/${userId}_${Date.now()}_${addressFile.name}`);
        } else {
          throw new Error('Proof of address is required.');
        }

        const { error } = await supabaseClient.from('kyc_requests').insert({
          user_id: userId,
          ...data,
          date_of_birth: convertToUTC(data.date_of_birth),
          status: 'pending',
          created_at: new Date().toISOString(),
        });

        if (error) throw new Error('Error submitting KYC: ' + error.message);

        showMessage('KYC submitted successfully.', false);
        setTimeout(() => window.location.href = 'kyc-confirmation.html', 2000);
      } catch (err) {
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit';
        showMessage(err.message, true);
      }
    } else {
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit';
    }
  });
}

function previewFile(input) {
  const file = input.files[0];
  const previewId = input.name === 'document_scan' ? 'document-preview' : 'address-preview';
  const preview = document.getElementById(previewId);
  if (file && file.size <= 10 * 1024 * 1024) {
    const reader = new FileReader();
    reader.onload = e => {
      preview.src = e.target.result;
      preview.style.display = file.type.includes('pdf') ? 'none' : 'block';
    };
    reader.readAsDataURL(file);
  } else {
    showMessage('File must be JPEG, PNG, or PDF and under 10MB.', true);
  }
}

async function uploadFile(file, path) {
  if (!file || file.size > 10 * 1024 * 1024) {
    throw new Error('File must be under 10MB.');
  }
  if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) {
    throw new Error('File must be JPEG, PNG, or PDF.');
  }
  const { data, error } = await supabaseClient.storage
    .from('kyc-documents')
    .upload(path, file, { contentType: file.type });
  if (error) {
    throw new Error('Error uploading file: ' + error.message);
  }
  return data.path;
}

function validateStep(step) {
  const fields = document.querySelectorAll(`#step${step} [required]`);
  let valid = true;
  fields.forEach(f => {
    if (!f.value.trim()) {
      valid = false;
      f.classList.add('invalid');
      showMessage(`${f.name.replace('_', ' ')} is required.`, true);
    } else if (f.name === 'date_of_birth' && !isOver18(f.value)) {
      valid = false;
      f.classList.add('invalid');
      showMessage('You must be at least 18 years old.', true);
    } else if (f.name === 'card_number' && !luhnCheck(f.value.replace(/\s/g, ''))) {
      valid = false;
      f.classList.add('invalid');
      showMessage('Invalid card number.', true);
    } else if (f.name === 'card_expiry' && !isFutureDate(f.value)) {
      valid = false;
      f.classList.add('invalid');
      showMessage('Expiry date must be in the future.', true);
    } else if (f.name === 'card_cvv' && !/^\d{3,4}$/.test(f.value)) {
      valid = false;
      f.classList.add('invalid');
      showMessage('CVV must be 3-4 digits.', true);
    } else if (f.name === 'document_scan' && !f.files[0]) {
      valid = false;
      showMessage('Document scan is required.', true);
    } else if (f.name === 'proof_of_address' && !f.files[0]) {
      valid = false;
      showMessage('Proof of address is required.', true);
    } else {
      f.classList.remove('invalid');
    }
  });
  return valid;
}

function validateAllSteps() {
  for (let i = 1; i <= 4; i++) {
    if (!validateStep(i)) return false;
  }
  return true;
}

function isOver18(dob) {
  const [day, month, year] = dob.split('/').map(Number);
  const birthDate = new Date(year, month - 1, day);
  const ageDiff = (new Date() - birthDate) / (1000 * 60 * 60 * 24 * 365.25);
  return ageDiff >= 18;
}

function isFutureDate(expiry) {
  const [month, year] = expiry.split('/').map(Number);
  const expDate = new Date(2000 + year, month - 1, 1);
  return expDate > new Date();
}

function luhnCheck(cardNumber) {
  let sum = 0;
  let isEven = false;
  for (let i = cardNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cardNumber[i], 10);
    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    isEven = !isEven;
  }
  return sum % 10 === 0;
}

function convertToUTC(dateStr) {
  const [day, month, year] = dateStr.split('/').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toISOString();
}

function populateReview() {
  const form = document.getElementById('kycForm');
  const review = document.getElementById('review-content');
  review.innerHTML = '';
  const data = new FormData(form);
  data.forEach((value, key) => {
    if (key !== 'document_scan' && key !== 'proof_of_address') {
      review.innerHTML += `<p><strong>${key.replace('_', ' ')}:</strong> ${value}</p>`;
    }
  });
}

function showMessage(text, isError) {
  const existing = document.querySelector('.message');
  if (existing) existing.remove();
  const msg = document.createElement('div');
  msg.className = `message ${isError ? 'error' : 'success'}`;
  msg.textContent = text;
  document.querySelector('.kyc-section').prepend(msg);
  setTimeout(() => msg.remove(), 3000);
}

loadKYC();
initForm();
