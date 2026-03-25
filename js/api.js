/**
 * api.js — Argentine Finance Dashboard
 * Fetch wrappers with sessionStorage cache (5-min TTL)
 * Works over file:// — no ES modules, plain globals
 *
 * Backend mode: set window.DFA_CONFIG.BACKEND_URL to route all calls
 * through the backend proxy instead of hitting external APIs directly.
 * When BACKEND_URL is set, CoinGecko API key is not needed in the frontend.
 */

const DFA_API = (function () {
  const TTL = 5 * 60 * 1000; // 5 minutes

  // ─── Backend URL (optional) ───────────────────────────────────────────────
  // If set, all API calls go through the backend proxy.
  function BASE_URL() {
    return window.DFA_CONFIG?.BACKEND_URL || '';
  }

  function isBackend() {
    return !!window.DFA_CONFIG?.BACKEND_URL;
  }

  // ─── CoinGecko auth header ────────────────────────────────────────────────
  // Only used when hitting CoinGecko directly (no backend configured)
  function cgHeaders() {
    const key = window.DFA_CONFIG?.COINGECKO_API_KEY;
    if (!key) return {};
    const headerName = key.startsWith('CG-') ? 'x-cg-demo-api-key' : 'x-cg-pro-api-key';
    return { [headerName]: key };
  }

  function cgFetch(url) {
    return fetch(url, { headers: cgHeaders() });
  }

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
  // fetchFn: optional custom fetch function (e.g. cgFetch for CoinGecko auth)
  async function fetchWithCache(key, url, fetchFn) {
    const cached = getCached(key);
    if (cached) return { data: cached, fromCache: true, stale: false };

    const doFetch = fetchFn || fetch;
    try {
      const res = await doFetch(url);
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
    const url = isBackend()
      ? `${BASE_URL()}/api/dolares`
      : 'https://dolarapi.com/v1/dolares';
    const result = await fetchWithCache('dfa_dolares', url);
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
    const url = isBackend()
      ? `${BASE_URL()}/api/btc-price`
      : 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether&vs_currencies=usd';
    return fetchWithCache('dfa_crypto_price', url, isBackend() ? null : cgFetch);
  }

  /**
   * CoinGecko — Top 20 coins by market cap
   * Returns array of coin objects with current_price, market_cap, price_change_percentage_24h, etc.
   */
  async function getCryptoMarkets() {
    const url = isBackend()
      ? `${BASE_URL()}/api/markets`
      : 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=false&price_change_percentage=24h';
    return fetchWithCache('dfa_markets', url, isBackend() ? null : cgFetch);
  }

  /**
   * CoinGecko — Global market data
   * Returns { data: { market_cap_percentage, total_volume, ... } }
   */
  async function getCoinGeckoGlobal() {
    const url = isBackend()
      ? `${BASE_URL()}/api/global`
      : 'https://api.coingecko.com/api/v3/global';
    return fetchWithCache('dfa_global', url, isBackend() ? null : cgFetch);
  }

  /**
   * CoinGecko — BTC historical price chart
   * days: 7 | 30 | 90
   * Returns { prices: [[timestamp_ms, price], ...] }
   */
  async function getBtcHistory(days) {
    const url = isBackend()
      ? `${BASE_URL()}/api/btc-history?days=${days}`
      : `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${days}&interval=daily`;
    return fetchWithCache(`dfa_history_${days}d`, url, isBackend() ? null : cgFetch);
  }

  /**
   * Bluelytics — Historical blue dollar data
   * Returns array or null if CORS blocks it
   * Response: { oficial: [...], blue: [...] } with { value_avg, value_sell, value_buy, date }
   */
  async function getBlueHistory() {
    const cached = getCached('dfa_blue_history');
    if (cached) return { data: cached, fromCache: true, stale: false };

    if (isBackend()) {
      return fetchWithCache('dfa_blue_history', `${BASE_URL()}/api/blue-history`);
    }

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
   * Alternative.me — Fear & Greed index (current)
   * Returns { data: [{ value, value_classification, timestamp }] }
   */
  async function getFearGreed() {
    const url = isBackend()
      ? `${BASE_URL()}/api/fng?limit=1`
      : 'https://api.alternative.me/fng/?limit=1';
    return fetchWithCache('dfa_fng', url);
  }

  /**
   * Alternative.me — Fear & Greed index (last 30 days)
   * Returns { data: [{ value, value_classification, timestamp }, ...] }
   */
  async function getFearGreed30() {
    const url = isBackend()
      ? `${BASE_URL()}/api/fng?limit=30`
      : 'https://api.alternative.me/fng/?limit=30';
    return fetchWithCache('dfa_fng_30', url);
  }

  /**
   * CoinGecko — BTC price on a specific historical date
   * date: DD-MM-YYYY format
   * Returns { market_data: { current_price: { usd } } }
   */
  async function getBtcHistoryByDate(date) {
    return fetchWithCache(
      `dfa_btc_date_${date}`,
      `https://api.coingecko.com/api/v3/coins/bitcoin/history?date=${date}&localization=false`,
      cgFetch
    );
  }

  /**
   * CoinGecko — BTC USD price on a specific date with fallback
   * date: DD-MM-YYYY format
   * Tries /history first; falls back to /market_chart/range if market_data is null
   * Returns { data: { usd: number|null } }
   */
  async function getBtcPriceOnDate(ddmmyyyy) {
    const cacheKey = `dfa_btc_price_${ddmmyyyy}`;
    const cached = getCached(cacheKey);
    if (cached != null) return { data: { usd: cached }, fromCache: true, stale: false };

    // Backend path: hit DB directly — fast, reliable, no rate limits
    if (isBackend()) {
      const [dd, mm, yyyy] = ddmmyyyy.split('-');
      const isoDate = `${yyyy}-${mm}-${dd}`;
      try {
        const res = await fetch(`${BASE_URL()}/api/btc-price-on-date?date=${isoDate}`);
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

    const [dd, mm, yyyy] = ddmmyyyy.split('-');
    const midnightUtc = Date.UTC(+yyyy, +mm - 1, +dd);
    const fromTs = Math.floor((midnightUtc - 86400000) / 1000);
    const toTs   = Math.floor((midnightUtc + 2 * 86400000) / 1000);

    // Try 1: /history endpoint
    try {
      const res = await cgFetch(
        `https://api.coingecko.com/api/v3/coins/bitcoin/history?date=${ddmmyyyy}&localization=false`
      );
      if (res.ok) {
        const json = await res.json();
        const usd = json?.market_data?.current_price?.usd;
        if (usd) {
          setCache(cacheKey, usd);
          return { data: { usd }, fromCache: false, stale: false };
        }
      }
    } catch { /* fall through to range endpoint */ }

    // Try 2: /market_chart/range (more reliable on demo tier)
    try {
      const res = await cgFetch(
        `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart/range?vs_currency=usd&from=${fromTs}&to=${toTs}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const prices = json?.prices;
      if (prices?.length) {
        let best = prices[0];
        let minDiff = Math.abs(best[0] - midnightUtc);
        for (const p of prices) {
          const diff = Math.abs(p[0] - midnightUtc);
          if (diff < minDiff) { minDiff = diff; best = p; }
        }
        const usd = best[1];
        setCache(cacheKey, usd);
        return { data: { usd }, fromCache: false, stale: false };
      }
    } catch { /* fall through */ }

    // Stale fallback
    const stale = getCachedStale(cacheKey);
    if (stale != null) return { data: { usd: stale }, fromCache: true, stale: true };

    return { data: { usd: null }, fromCache: false, stale: false };
  }

  // ─── Cache management ────────────────────────────────────────────────────
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
    getBtcHistoryByDate,
    getBtcPriceOnDate,
    getBlueHistory,
    getFearGreed,
    getFearGreed30,
    clearDolares,
    clearBtcHistory,
    clearAll
  };
})();

// Make available globally
window.DFA_API = DFA_API;
