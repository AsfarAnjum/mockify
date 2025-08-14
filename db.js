import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

// Reuse one connection
let dbPromise;

/**
 * Open DB and ensure required tables exist.
 */
export async function getDB() {
  if (!dbPromise) {
    dbPromise = open({ filename: 'data.sqlite', driver: sqlite3.Database });
  }
  const db = await dbPromise;

  await db.exec(`
    CREATE TABLE IF NOT EXISTS shops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop TEXT UNIQUE,
      access_token TEXT,
      scope TEXT,
      installed_at TEXT
    );

    -- Optional app session store (safe to keep even if unused)
    CREATE TABLE IF NOT EXISTS sessions (
      shop TEXT,
      data TEXT,
      created_at TEXT
    );
  `);

  return db;
}

/**
 * Delete saved sessions/tokens for a shop (used to self-heal on 401/403).
 */
export async function clearShopSessions(shop) {
  if (!shop) return;
  const db = await getDB();

  // If a sessions table is in use, clear rows for this shop
  try { await db.run('DELETE FROM sessions WHERE shop = ?', [shop]); } catch {}

  // Also null the token in shops table (covers re-installs)
  try { await db.run('UPDATE shops SET access_token = NULL WHERE shop = ?', [shop]); } catch {}
}