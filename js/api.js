/**
 * api.js — Argentine Finance Dashboard
 * Fetch wrappers with sessionStorage cache (5-min TTL)
 * Works over file:// — no ES modules, plain globals
 */

const DFA_API = (function () {
  const TTL = 5 * 60 * 1000; // 5 minutes

  // ─── Cache helpers ──────────────────────────────────────────────────────
  function getCached(key) {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts > TTL) return null;
      return data;
    } catch { return null; }
  }

  function getCachedStale(key) {
    // Returns cached data ignoring TTL (for fallback on network failure)
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw).data;
    } catch { return null; }
  }

  function setCache(key, data) {
    try {
      sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
    } catch { /* storage full — ignore */ }
  }

  function clearCache(key) {
    try { sessionStorage.removeItem(key); } catch { /* ignore */ }
  }

  // ─── Core fetch with cache ───────────────────────────────────────────────
  async function fetchWithCache(key, url) {
    const cached = getCached(key);
    if (cached) return { data: cached, fromCache: true, stale: false };

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCache(key, data);
      return { data, fromCache: false, stale: false };
    } catch (err) {
      const stale = getCachedStale(key);
      if (stale) return { data: stale, fromCache: true, stale: true };
      throw err;
    }
  }

  // ─── Public API functions ────────────────────────────────────────────────

  /**
   * DolarAPI — all dollar types
   * Returns array of { casa, nombre, compra, venta, fechaActualizacion }
   * casa values: "blue", "oficial", "bolsa", "contadoconliqui", "cripto", "tarjeta"
   */
  async function getDolares() {
    const result = await fetchWithCache(
      'dfa_dolares',
      'https://dolarapi.com/v1/dolares'
    );
    // Index by casa for easy lookup
    const byKey = {};
    for (const item of result.data) {
      byKey[item.casa] = item;
    }
    return { ...result, byKey };
  }

  /**
   * CoinGecko — BTC, ETH, USDT current prices in USD
   * Returns { bitcoin: { usd }, ethereum: { usd }, tether: { usd } }
   */
  async function getCryptoPrice() {
    return fetchWithCache(
      'dfa_crypto_price',
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether&vs_currencies=usd'
    );
  }

  /**
   * CoinGecko — Top 20 coins by market cap
   * Returns array of coin objects with current_price, market_cap, price_change_percentage_24h, etc.
   */
  async function getCryptoMarkets() {
    return fetchWithCache(
      'dfa_markets',
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=false&price_change_percentage=24h'
    );
  }

  /**
   * CoinGecko — Global market data
   * Returns { data: { market_cap_percentage, total_volume, ... } }
   */
  async function getCoinGeckoGlobal() {
    return fetchWithCache(
      'dfa_global',
      'https://api.coingecko.com/api/v3/global'
    );
  }

  /**
   * CoinGecko — BTC historical price chart
   * days: 7 | 30 | 90
   * Returns { prices: [[timestamp_ms, price], ...] }
   */
  async function getBtcHistory(days) {
    const key = `dfa_history_${days}d`;
    return fetchWithCache(
      key,
      `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${days}&interval=daily`
    );
  }

  /**
   * Bluelytics — Historical blue dollar data
   * Returns array or null if CORS blocks it
   * Response: { oficial: [...], blue: [...] } with { value_avg, value_sell, value_buy, date }
   */
  async function getBlueHistory() {
    const cached = getCached('dfa_blue_history');
    if (cached) return { data: cached, fromCache: true, stale: false };

    try {
      const res = await fetch('https://api.bluelytics.com.ar/v2/evolution.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCache('dfa_blue_history', data);
      return { data, fromCache: false, stale: false };
    } catch {
      // CORS or network failure — return null gracefully
      return null;
    }
  }

  /**
   * Alternative.me — Fear & Greed index
   * Returns { data: [{ value, value_classification, timestamp }] }
   */
  async function getFearGreed() {
    return fetchWithCache(
      'dfa_fng',
      'https://api.alternative.me/fng/?limit=1'
    );
  }

  // ─── Cache management ────────────────────────────────────────────────────
  function clearDolares() { clearCache('dfa_dolares'); }
  function clearBtcHistory(days) { clearCache(`dfa_history_${days}d`); }
  function clearAll() {
    ['dfa_dolares','dfa_crypto_price','dfa_markets','dfa_global',
     'dfa_history_7d','dfa_history_30d','dfa_history_90d',
     'dfa_blue_history','dfa_fng'].forEach(clearCache);
  }

  return {
    getDolares,
    getCryptoPrice,
    getCryptoMarkets,
    getCoinGeckoGlobal,
    getBtcHistory,
    getBlueHistory,
    getFearGreed,
    clearDolares,
    clearBtcHistory,
    clearAll
  };
})();

// Make available globally
window.DFA_API = DFA_API;
