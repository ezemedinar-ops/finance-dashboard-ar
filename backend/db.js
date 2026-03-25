/**
 * db.js — SQLite connection and schema
 * Uses better-sqlite3 (synchronous, perfect for single-process Node)
 */

import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import path from 'path';

// Store DB in /data on Railway (mounted volume), or local ./data folder
const DB_DIR = process.env.DATA_DIR || './data';
const DB_PATH = path.join(DB_DIR, 'finance.db');

// Ensure directory exists at module load time (synchronous)
mkdirSync(DB_DIR, { recursive: true });

let _db = null;

export function getDb() {
  if (_db) return _db;

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL'); // Better concurrent read performance

  _db.exec(`
    CREATE TABLE IF NOT EXISTS btc_prices (
      date      TEXT PRIMARY KEY,  -- YYYY-MM-DD
      price_usd REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS blue_rates (
      date   TEXT PRIMARY KEY,  -- YYYY-MM-DD
      compra REAL,
      venta  REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS oficial_rates (
      date   TEXT PRIMARY KEY,  -- YYYY-MM-DD
      compra REAL,
      venta  REAL NOT NULL
    );
  `);

  return _db;
}

// ─── Query helpers ────────────────────────────────────────────────────────────

export function getBtcPriceOnDate(date) {
  const db = getDb();
  // Exact match first
  const row = db.prepare('SELECT price_usd FROM btc_prices WHERE date = ?').get(date);
  if (row) return { usd: row.price_usd, approximate: false };

  // Closest past date
  const past = db.prepare(
    'SELECT date, price_usd FROM btc_prices WHERE date <= ? ORDER BY date DESC LIMIT 1'
  ).get(date);
  if (past) return { usd: past.price_usd, approximate: true, closestDate: past.date };

  // Closest future date (fallback when date is before our earliest data)
  const future = db.prepare(
    'SELECT date, price_usd FROM btc_prices WHERE date >= ? ORDER BY date ASC LIMIT 1'
  ).get(date);
  if (future) return { usd: future.price_usd, approximate: true, closestDate: future.date };

  return null;
}

export function upsertBtcPrice(date, priceUsd) {
  getDb()
    .prepare('INSERT OR REPLACE INTO btc_prices (date, price_usd) VALUES (?, ?)')
    .run(date, priceUsd);
}

export function upsertBlueRate(date, compra, venta) {
  getDb()
    .prepare('INSERT OR REPLACE INTO blue_rates (date, compra, venta) VALUES (?, ?, ?)')
    .run(date, compra, venta);
}

export function upsertOficialRate(date, compra, venta) {
  getDb()
    .prepare('INSERT OR REPLACE INTO oficial_rates (date, compra, venta) VALUES (?, ?, ?)')
    .run(date, compra, venta);
}

export function getBlueHistory() {
  const db = getDb();
  return db.prepare(
    'SELECT date, compra, venta FROM blue_rates ORDER BY date ASC'
  ).all();
}

export function getOficialHistory() {
  const db = getDb();
  return db.prepare(
    'SELECT date, compra, venta FROM oficial_rates ORDER BY date ASC'
  ).all();
}

export function getBtcCount() {
  return getDb().prepare('SELECT COUNT(*) as n FROM btc_prices').get().n;
}
