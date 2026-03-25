/**
 * api.js — Argentine Finance Dashboard
 * Thin client for the backend API proxy.
 * No API keys here — all secrets live in backend/.env
 *
 * BACKEND_URL is auto-detected:
 *   localhost / file://  →  http://localhost:3000
 *   production           →  update PROD_BACKEND below after first Railway deploy
 */

const DFA_API = (function () {
  const TTL = 5 * 60 * 1000; // 5 minutes client-side cache

  // ─── Backend URL ──────────────────────────────────────────────────────────
  const PROD_BACKEND = 'https://finance-dashboard-ar-production.up.railway.app';

  const BACKEND_URL = (function () {
    const h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || h === '') return 'http://localhost:3000';
    return PROD_BACKEND;
  })();

  // ─── Cache helpers ────────────────────────────────────────────────────────

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

  // ─── Core fetch with cache ────────────────────────────────────────────────

  async function fetchWithCache(key, path) {
    const cached = getCached(key);
    if (cached) return { data: cached, fromCache: true, stale: false };

    try {
      const res = await fetch(`${BACKEND_URL}${path}`);
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

  // ─── Public API functions ─────────────────────────────────────────────────

  /** Dollar types — array of { casa, compra, venta, fechaActualizacion } */
  async function getDolares() {
    const result = await fetchWithCache('dfa_dolares', '/api/dolares');
    const byKey = {};
    for (const item of result.data) byKey[item.casa] = item;
    return { ...result, byKey };
  }

  /** BTC, ETH, USDT prices — { bitcoin: { usd }, ethereum: { usd }, tether: { usd } } */
  async function getCryptoPrice() {
    return fetchWithCache('dfa_crypto_price', '/api/btc-price');
  }

  /** Top 20 coins by market cap */
  async function getCryptoMarkets() {
    return fetchWithCache('dfa_markets', '/api/markets');
  }

  /** Global market data — { data: { market_cap_percentage, total_volume, ... } } */
  async function getCoinGeckoGlobal() {
    return fetchWithCache('dfa_global', '/api/global');
  }

  /** BTC historical chart — { prices: [[timestamp_ms, price_usd], ...] } */
  async function getBtcHistory(days) {
    return fetchWithCache(`dfa_history_${days}d`, `/api/btc-history?days=${days}`);
  }

  /** Historical blue dollar evolution (from DB) */
  async function getBlueHistory() {
    return fetchWithCache('dfa_blue_history', '/api/blue-history');
  }

  /** Fear & Greed index — { data: [{ value, value_classification, timestamp }] } */
  async function getFearGreed() {
    return fetchWithCache('dfa_fng', '/api/fng?limit=1');
  }

  /** Fear & Greed index — last 30 days */
  async function getFearGreed30() {
    return fetchWithCache('dfa_fng_30', '/api/fng?limit=30');
  }

  /**
   * BTC price on a specific date (from backend DB — fast, reliable)
   * date: DD-MM-YYYY format
   * Returns { data: { usd: number|null } }
   */
  async function getBtcPriceOnDate(ddmmyyyy) {
    const cacheKey = `dfa_btc_price_${ddmmyyyy}`;
    const cached = getCached(cacheKey);
    if (cached != null) return { data: { usd: cached }, fromCache: true, stale: false };

    const [dd, mm, yyyy] = ddmmyyyy.split('-');
    const isoDate = `${yyyy}-${mm}-${dd}`;
    try {
      const res = await fetch(`${BACKEND_URL}/api/btc-price-on-date?date=${isoDate}`);
      if (res.ok) {
        const json = await res.json();
        if (json?.usd) {
          setCache(cacheKey, json.usd);
          return { data: { usd: json.usd }, fromCache: false, stale: false };
        }
      }
    } catch { /* fall through to stale */ }

    const stale = getCachedStale(cacheKey);
    if (stale != null) return { data: { usd: stale }, fromCache: true, stale: true };
    return { data: { usd: null }, fromCache: false, stale: false };
  }

  // ─── Cache management ─────────────────────────────────────────────────────

  function clearDolares() { clearCache('dfa_dolares'); }
  function clearBtcHistory(days) { clearCache(`dfa_history_${days}d`); }
  function clearAll() {
    ['dfa_dolares','dfa_crypto_price','dfa_markets','dfa_global',
     'dfa_history_7d','dfa_history_30d','dfa_history_90d',
     'dfa_blue_history','dfa_fng','dfa_fng_30'].forEach(clearCache);
  }

  return {
    getDolares,
    getCryptoPrice,
    getCryptoMarkets,
    getCoinGeckoGlobal,
    getBtcHistory,
    getBtcPriceOnDate,
    getBlueHistory,
    getFearGreed,
    getFearGreed30,
    clearDolares,
    clearBtcHistory,
    clearAll
  };
})();

window.DFA_API = DFA_API;
