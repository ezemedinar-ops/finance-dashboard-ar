/**
 * server.js — Finance Dashboard Backend
 * Express API proxy + historical data endpoints
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { startCron } from './cron.js';
import {
  fetchDolares, fetchBtcPrice, fetchMarkets, fetchGlobal,
  fetchBtcHistory, fetchFearGreed, fetchBlueHistory
} from './fetchers.js';
import {
  getBtcPriceOnDate, getBlueHistory, getOficialHistory, getBtcCount
} from './db.js';

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || '*';

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json());

// ─── In-memory cache ─────────────────────────────────────────────────────────

const memCache = new Map(); // key → { data: Promise|value, expiresAt: number }

/**
 * Returns cached data or fetches fresh.
 * Serves stale data while refreshing in the background (stale-while-revalidate).
 */
function withCache(key, ttlMs, fetchFn) {
  const now = Date.now();
  const entry = memCache.get(key);

  if (entry && now < entry.expiresAt) {
    return entry.data; // fresh cache hit
  }

  const fresh = fetchFn()
    .then(data => {
      memCache.set(key, { data: Promise.resolve(data), expiresAt: now + ttlMs });
      return data;
    })
    .catch(err => {
      // On error, keep stale entry longer so we don't hammer the upstream
      if (entry) memCache.set(key, { ...entry, expiresAt: now + 60_000 });
      throw err;
    });

  // Serve stale while fresh is loading
  if (entry) return entry.data;
  memCache.set(key, { data: fresh, expiresAt: now + ttlMs });
  return fresh;
}

const MIN5  = 5 * 60 * 1000;
const HOUR1 = 60 * 60 * 1000;

// ─── Routes ──────────────────────────────────────────────────────────────────

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, btcRows: getBtcCount(), ts: new Date().toISOString() });
});

// Dollar rates
app.get('/api/dolares', async (req, res) => {
  try {
    const data = await withCache('dolares', MIN5, fetchDolares);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Crypto: simple price (BTC, ETH, USDT)
app.get('/api/btc-price', async (req, res) => {
  try {
    const data = await withCache('btc-price', MIN5, fetchBtcPrice);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Crypto: top 20 markets
app.get('/api/markets', async (req, res) => {
  try {
    const data = await withCache('markets', MIN5, fetchMarkets);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Crypto: global data (dominance, volume)
app.get('/api/global', async (req, res) => {
  try {
    const data = await withCache('global', MIN5, fetchGlobal);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Crypto: BTC historical chart
app.get('/api/btc-history', async (req, res) => {
  const days = req.query.days || 365;
  try {
    const data = await withCache(`btc-history-${days}`, HOUR1, () => fetchBtcHistory(days));
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Crypto: BTC price on specific date — served from DB (fast, reliable)
app.get('/api/btc-price-on-date', (req, res) => {
  const { date } = req.query; // YYYY-MM-DD
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date query param required (YYYY-MM-DD)' });
  }
  const result = getBtcPriceOnDate(date);
  if (result) return res.json(result);
  res.status(404).json({ error: 'No data for this date' });
});

// Fear & Greed index
app.get('/api/fng', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 1, 365);
  try {
    const data = await withCache(`fng-${limit}`, HOUR1, () => fetchFearGreed(limit));
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Blue dollar history — from DB (+ Bluelytics fallback)
app.get('/api/blue-history', async (req, res) => {
  try {
    // Serve from DB if we have data
    const rows = getBlueHistory();
    if (rows.length > 0) {
      // Return in same shape as Bluelytics for frontend compatibility
      const formatted = rows.map(r => ({
        source: 'Blue',
        date: r.date,
        value_avg: ((r.compra || 0) + r.venta) / 2,
        value_sell: r.venta,
        value_buy: r.compra
      }));
      return res.json(formatted);
    }

    // Fallback: proxy Bluelytics (works server-side, no CORS)
    const data = await withCache('blue-history', HOUR1, fetchBlueHistory);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Oficial rate history — from DB
app.get('/api/oficial-history', (req, res) => {
  const rows = getOficialHistory();
  res.json(rows);
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[DFA Backend] Running on port ${PORT}`);
  startCron();
});
