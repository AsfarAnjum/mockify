import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

export async function getDB() {
  const db = await open({ filename: './data.sqlite', driver: sqlite3.Database });
  await db.exec(`CREATE TABLE IF NOT EXISTS shops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop TEXT UNIQUE,
    access_token TEXT,
    scope TEXT,
    installed_at TEXT
  );`);
  return db;
}

// db.js
export async function clearShopSessions(shop) {
  if (!shop) return;
  const db = await getDb();                 // uses your existing getDb()
  await db.run('DELETE FROM sessions WHERE shop = ?', shop); // table name: sessions
}

// Delete any saved sessions/tokens for a shop
export async function clearShopSessions(shop) {
  if (!shop) return;
  const db = await getDB(); // uses your existing getDB()

  // If a 'sessions' table exists, clear rows for this shop
  try { await db.run('DELETE FROM sessions WHERE shop = ?', [shop]); } catch {}

  // Also null the token in shops table (handles re-installs)
  try { await db.run('UPDATE shops SET access_token = NULL WHERE shop = ?', [shop]); } catch {}
}


// ---- add this ----
export async function clearShopSessions(shop) {
  if (!shop) return;
  const db = await getDb();                 // uses your existing getDb()
  // adjust table name if yours is different: sessions / shopify_sessions
  await db.run('DELETE FROM sessions WHERE shop = ?', shop);
}
// ---- end add ----