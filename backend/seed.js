/**
 * seed.js — One-time historical data population
 *
 * Run once after deploy:
 *   node seed.js
 *   (or: railway run node seed.js)
 *
 * Populates:
 *   - btc_prices: all daily BTC prices from CoinGecko (from 2013)
 *   - blue_rates: historical blue dollar from Bluelytics
 *   - oficial_rates: historical oficial dollar from Bluelytics
 */

import 'dotenv/config';
import { fetchBlueHistory } from './fetchers.js';
import { upsertBtcPrice, upsertBlueRate, upsertOficialRate, getBtcCount, getDb } from './db.js';
import { mkdirSync } from 'fs';

// Ensure data dir exists
const DATA_DIR = process.env.DATA_DIR || './data';
mkdirSync(DATA_DIR, { recursive: true });

const CG_KEY = process.env.COINGECKO_API_KEY || '';

function cgHeaders() {
  if (!CG_KEY) return {};
  return CG_KEY.startsWith('CG-')
    ? { 'x-cg-demo-api-key': CG_KEY }
    : { 'x-cg-pro-api-key': CG_KEY };
}

// ─── BTC historical prices ────────────────────────────────────────────────────

async function seedBtcPrices() {
  const existing = getBtcCount();
  if (existing > 3000) {
    console.log(`[Seed] BTC prices already seeded (${existing} rows). Skipping.`);
    return;
  }

  console.log('[Seed] Fetching BTC historical prices from CoinGecko (days=max)...');
  const { default: fetch } = await import('node-fetch');

  const res = await fetch(
    'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=max&interval=daily',
    { headers: cgHeaders() }
  );

  if (!res.ok) throw new Error(`CoinGecko responded ${res.status}`);

  const { prices } = await res.json();

  console.log(`[Seed] Inserting ${prices.length} BTC price rows...`);

  const db = getDb();
  const insert = db.prepare('INSERT OR REPLACE INTO btc_prices (date, price_usd) VALUES (?, ?)');
  const insertMany = db.transaction(rows => {
    for (const [ts, price] of rows) {
      const date = new Date(ts).toISOString().substring(0, 10);
      insert.run(date, price);
    }
  });

  insertMany(prices);
  console.log(`[Seed] BTC prices done. Total rows: ${getBtcCount()}`);
}

// ─── Blue + Oficial historical rates ─────────────────────────────────────────

async function seedBlueHistory() {
  const db = getDb();
  const existing = db.prepare('SELECT COUNT(*) as n FROM blue_rates').get().n;

  if (existing > 1000) {
    console.log(`[Seed] Blue rates already seeded (${existing} rows). Skipping.`);
    return;
  }

  console.log('[Seed] Fetching Bluelytics evolution data...');
  const evolution = await fetchBlueHistory();

  if (!Array.isArray(evolution)) {
    console.warn('[Seed] Unexpected Bluelytics response format. Skipping.');
    return;
  }

  // Group by date: build { 'YYYY-MM-DD': { blue: {...}, oficial: {...} } }
  const byDate = {};
  for (const item of evolution) {
    const d = item.date?.substring(0, 10);
    if (!d) continue;
    if (!byDate[d]) byDate[d] = {};
    if (item.source === 'Blue')   byDate[d].blue    = item;
    if (item.source === 'Oficial') byDate[d].oficial = item;
  }

  const insertBlue    = db.prepare('INSERT OR REPLACE INTO blue_rates    (date, compra, venta) VALUES (?, ?, ?)');
  const insertOficial = db.prepare('INSERT OR REPLACE INTO oficial_rates (date, compra, venta) VALUES (?, ?, ?)');

  const insertAll = db.transaction(entries => {
    for (const [date, { blue, oficial }] of entries) {
      if (blue)    insertBlue.run(date, blue.value_buy    ?? null, blue.value_sell);
      if (oficial) insertOficial.run(date, oficial.value_buy ?? null, oficial.value_sell);
    }
  });

  insertAll(Object.entries(byDate));

  const blueCount    = db.prepare('SELECT COUNT(*) as n FROM blue_rates').get().n;
  const oficialCount = db.prepare('SELECT COUNT(*) as n FROM oficial_rates').get().n;
  console.log(`[Seed] Blue rates: ${blueCount} rows. Oficial rates: ${oficialCount} rows.`);
}

// ─── Run ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('[Seed] Starting data seeding...\n');

  try {
    await seedBtcPrices();
  } catch (err) {
    console.error('[Seed] BTC seed failed:', err.message);
  }

  try {
    await seedBlueHistory();
  } catch (err) {
    console.error('[Seed] Blue history seed failed:', err.message);
  }

  console.log('\n[Seed] Done.');
  process.exit(0);
}

main();
