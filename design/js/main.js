// 1. Fetch Live Crypto Prices (Coingecko API)
async function fetchTicker() {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd'
    );
    const data = await res.json();
    document.getElementById('ticker').textContent = 
      `BTC: $${data.bitcoin.usd}  |  ETH: $${data.ethereum.usd}`;
  } catch (err) {
    console.error('Ticker load error:', err);
  }
}

// 2. Initialize & Refresh Every 30 Seconds
fetchTicker();
setInterval(fetchTicker, 30000);
