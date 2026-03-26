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
  fetchBtcHistory, fetchBtcHistoryRange, fetchFearGreed, fetchBlueHistory
} from './fetchers.js';
import {
  getBtcPriceOnDate, getBlueHistory, getOficialHistory, getBtcCount,
  upsertBtcPrice, upsertBlueRate, upsertOficialRate, getDb
} from './db.js';

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = (process.env.FRONTEND_URL || '').replace(/\/$/, '');

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors({ origin: FRONTEND_URL || '*' }));
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

// ─── Volatility calculation ───────────────────────────────────────────────────

function calcVolatility(prices) {
  if (!prices || prices.length < 2) return null;
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] === 0) continue;
    returns.push(prices[i] / prices[i - 1] - 1);
  }
  if (returns.length < 2) return null;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance) * 100; // percentage
}

const MIN5  = 5 * 60 * 1000;
const HOUR1 = 60 * 60 * 1000;

// ─── Routes ──────────────────────────────────────────────────────────────────

// Health check
app.get('/health', (req, res) => {
  const db = getDb();
  const blueCount = db.prepare('SELECT COUNT(*) as n FROM blue_rates').get().n;
  const oficialCount = db.prepare('SELECT COUNT(*) as n FROM oficial_rates').get().n;
  res.json({ ok: true, v: 2, btcRows: getBtcCount(), blueRows: blueCount, oficialRows: oficialCount, ts: new Date().toISOString() });
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

// Crypto: markets (enriched with volatility score, supports page + category)
app.get('/api/markets', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const category = req.query.category || '';
  const cacheKey = `markets-${page}-${category || 'all'}`;
  try {
    const raw = await withCache(cacheKey, MIN5, () => fetchMarkets(page, category));
    const enriched = raw.map(coin => {
      const volatility_7d = calcVolatility(coin.sparkline_in_7d?.price);
      const { sparkline_in_7d, ...rest } = coin;
      return { ...rest, volatility_7d };
    });
    res.json(enriched);
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

// Blue + Oficial dollar history — from DB (+ Bluelytics fallback)
app.get('/api/blue-history', async (req, res) => {
  try {
    const blueRows = getBlueHistory();
    const oficialRows = getOficialHistory();

    // If DB has substantial data, serve from DB
    if (blueRows.length > 30) {
      const formatted = [];
      for (const r of blueRows) {
        formatted.push({
          source: 'Blue', date: r.date,
          value_avg: ((r.compra || 0) + r.venta) / 2,
          value_sell: r.venta, value_buy: r.compra
        });
      }
      for (const r of oficialRows) {
        formatted.push({
          source: 'Oficial', date: r.date,
          value_avg: ((r.compra || 0) + r.venta) / 2,
          value_sell: r.venta, value_buy: r.compra
        });
      }
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

// ─── Auto-seed on first deploy ────────────────────────────────────────────────

async function autoSeed() {
  const db = getDb();
  const blueCount = db.prepare('SELECT COUNT(*) as n FROM blue_rates').get().n;

  // Seed Bluelytics data if DB is nearly empty
  if (blueCount < 30) {
    console.log('[AutoSeed] DB has few rows — seeding from Bluelytics...');
    try {
      const evolution = await fetchBlueHistory();
      if (Array.isArray(evolution)) {
        const byDate = {};
        for (const item of evolution) {
          const d = item.date?.substring(0, 10);
          if (!d) continue;
          if (!byDate[d]) byDate[d] = {};
          if (item.source === 'Blue')    byDate[d].blue = item;
          if (item.source === 'Oficial') byDate[d].oficial = item;
        }
        for (const [date, { blue, oficial }] of Object.entries(byDate)) {
          if (blue)    upsertBlueRate(date, blue.value_buy ?? null, blue.value_sell);
          if (oficial) upsertOficialRate(date, oficial.value_buy ?? null, oficial.value_sell);
        }
        const newBlue = db.prepare('SELECT COUNT(*) as n FROM blue_rates').get().n;
        const newOficial = db.prepare('SELECT COUNT(*) as n FROM oficial_rates').get().n;
        console.log(`[AutoSeed] Bluelytics done: ${newBlue} blue, ${newOficial} oficial rows`);
      }
    } catch (err) {
      console.error('[AutoSeed] Bluelytics seed failed:', err.message);
    }
  }

  // Seed BTC prices in 365-day chunks going back to 2013
  const btcCount = getBtcCount();
  if (btcCount < 3000) {
    console.log(`[AutoSeed] BTC has ${btcCount} rows — seeding full history in chunks...`);
    const insert = db.prepare('INSERT OR REPLACE INTO btc_prices (date, price_usd) VALUES (?, ?)');
    const insertMany = db.transaction(rows => {
      for (const [ts, price] of rows) {
        insert.run(new Date(ts).toISOString().substring(0, 10), price);
      }
    });

    const now = Math.floor(Date.now() / 1000);
    const btcGenesis = Math.floor(Date.UTC(2013, 3, 28) / 1000); // Apr 2013 — CoinGecko start
    const oneYear = 365 * 24 * 60 * 60;

    for (let to = now; to > btcGenesis; to -= oneYear) {
      const from = Math.max(to - oneYear, btcGenesis);
      try {
        console.log(`[AutoSeed] BTC chunk: ${new Date(from * 1000).toISOString().substring(0, 10)} → ${new Date(to * 1000).toISOString().substring(0, 10)}`);
        const data = await fetchBtcHistoryRange(from, to);
        if (data?.prices?.length) {
          insertMany(data.prices);
          console.log(`[AutoSeed]   → ${data.prices.length} prices inserted`);
        }
        // Rate limit: wait 2s between requests (CoinGecko demo = 30 req/min)
        await new Promise(r => setTimeout(r, 2000));
      } catch (err) {
        console.error(`[AutoSeed] BTC chunk failed:`, err.message);
        // Wait longer on rate limit then continue
        await new Promise(r => setTimeout(r, 10000));
      }
    }
    console.log(`[AutoSeed] BTC done: ${getBtcCount()} total rows`);
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[DFA Backend] Running on port ${PORT}`);
  startCron();
  autoSeed(); // runs in background, doesn't block server
});
