/**
 * fetchers.js — Wrappers for all external API calls
 * Each function returns parsed JSON data (throws on HTTP error)
 */

import fetch from 'node-fetch';

const CG_KEY = process.env.COINGECKO_API_KEY || '';

function cgHeaders() {
  if (!CG_KEY) return {};
  return CG_KEY.startsWith('CG-')
    ? { 'x-cg-demo-api-key': CG_KEY }
    : { 'x-cg-pro-api-key': CG_KEY };
}

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.json();
}

// ─── DolarAPI ────────────────────────────────────────────────────────────────

/** Returns array of { casa, nombre, compra, venta, fechaActualizacion } */
export async function fetchDolares() {
  return fetchJSON('https://dolarapi.com/v1/dolares');
}

// ─── CoinGecko ───────────────────────────────────────────────────────────────

/** Returns { bitcoin: { usd }, ethereum: { usd }, tether: { usd } } */
export async function fetchBtcPrice() {
  return fetchJSON(
    'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether&vs_currencies=usd',
    { headers: cgHeaders() }
  );
}

/** Returns array of top 20 coins with image, price, market_cap, etc. */
export async function fetchMarkets() {
  return fetchJSON(
    'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=true&price_change_percentage=24h',
    { headers: cgHeaders() }
  );
}

/** Returns { data: { market_cap_percentage, total_volume, ... } } */
export async function fetchGlobal() {
  return fetchJSON(
    'https://api.coingecko.com/api/v3/global',
    { headers: cgHeaders() }
  );
}

/**
 * Returns { prices: [[timestamp_ms, price_usd], ...] }
 * days: number or 'max'
 */
export async function fetchBtcHistory(days = 365) {
  return fetchJSON(
    `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${days}&interval=daily`,
    { headers: cgHeaders() }
  );
}

/**
 * Returns { prices: [[timestamp_ms, price_usd], ...] } for a date range
 * from/to: Unix seconds
 */
export async function fetchBtcHistoryRange(fromSec, toSec) {
  return fetchJSON(
    `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart/range?vs_currency=usd&from=${fromSec}&to=${toSec}`,
    { headers: cgHeaders() }
  );
}

/**
 * Returns BTC price for a specific date (DD-MM-YYYY)
 * Tries /history first, falls back to /market_chart/range
 */
export async function fetchBtcPriceOnDate(ddmmyyyy) {
  // Try 1: /history endpoint
  try {
    const data = await fetchJSON(
      `https://api.coingecko.com/api/v3/coins/bitcoin/history?date=${ddmmyyyy}&localization=false`,
      { headers: cgHeaders() }
    );
    const usd = data?.market_data?.current_price?.usd;
    if (usd) return usd;
  } catch { /* fall through */ }

  // Try 2: /market_chart/range (±1 day window)
  const [dd, mm, yyyy] = ddmmyyyy.split('-');
  const midnightUtc = Date.UTC(+yyyy, +mm - 1, +dd);
  const from = Math.floor((midnightUtc - 86400000) / 1000);
  const to   = Math.floor((midnightUtc + 2 * 86400000) / 1000);

  const data = await fetchJSON(
    `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart/range?vs_currency=usd&from=${from}&to=${to}`,
    { headers: cgHeaders() }
  );
  const prices = data?.prices;
  if (!prices?.length) throw new Error(`No BTC price data for ${ddmmyyyy}`);

  let best = prices[0];
  let minDiff = Math.abs(best[0] - midnightUtc);
  for (const p of prices) {
    const diff = Math.abs(p[0] - midnightUtc);
    if (diff < minDiff) { minDiff = diff; best = p; }
  }
  return best[1];
}

// ─── Alternative.me ──────────────────────────────────────────────────────────

/** Returns { data: [{ value, value_classification, timestamp }] } */
export async function fetchFearGreed(limit = 1) {
  return fetchJSON(`https://api.alternative.me/fng/?limit=${limit}`);
}

// ─── Bluelytics ──────────────────────────────────────────────────────────────

/**
 * Returns array of { source, value_avg, value_sell, value_buy, date }
 * Note: works from server (no CORS restriction)
 */
export async function fetchBlueHistory() {
  return fetchJSON('https://api.bluelytics.com.ar/v2/evolution.json');
}
