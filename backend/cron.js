/**
 * cron.js — Daily data collection jobs
 * Runs inside the server process (started from server.js)
 */

import cron from 'node-cron';
import { fetchDolares, fetchBtcPrice } from './fetchers.js';
import { upsertBtcPrice, upsertBlueRate, upsertOficialRate } from './db.js';

function todayUTC() {
  return new Date().toISOString().substring(0, 10); // YYYY-MM-DD
}

async function saveDailySnapshot() {
  const date = todayUTC();
  console.log(`[Cron] Saving daily snapshot for ${date}`);

  try {
    const [dolares, btcData] = await Promise.all([
      fetchDolares(),
      fetchBtcPrice()
    ]);

    // BTC price
    const btcUsd = btcData?.bitcoin?.usd;
    if (btcUsd) {
      upsertBtcPrice(date, btcUsd);
      console.log(`[Cron] BTC: $${btcUsd.toLocaleString('en-US')}`);
    }

    // Dollar rates
    for (const item of dolares) {
      if (item.casa === 'blue') {
        upsertBlueRate(date, item.compra, item.venta);
        console.log(`[Cron] Blue: compra $${item.compra} / venta $${item.venta}`);
      }
      if (item.casa === 'oficial') {
        upsertOficialRate(date, item.compra, item.venta);
        console.log(`[Cron] Oficial: compra $${item.compra} / venta $${item.venta}`);
      }
    }
  } catch (err) {
    console.error(`[Cron] Daily snapshot failed:`, err.message);
  }
}

export function startCron() {
  // Run at 00:30 UTC every day
  cron.schedule('30 0 * * *', saveDailySnapshot);
  console.log('[Cron] Daily snapshot job scheduled (00:30 UTC)');

  // Also save immediately on startup so today's data is always present
  saveDailySnapshot();
}
