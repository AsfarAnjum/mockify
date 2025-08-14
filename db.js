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
