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

// Investment plans (for frontend validation only)
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
    const { data: { user }, error
