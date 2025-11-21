import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '../config';
import logger from '../utils/logger';

let db: Database.Database;

export function initDatabase(): Database.Database {
  const dbDir = path.dirname(config.dbPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    logger.info(`Created database directory: ${dbDir}`);
  }

  db = new Database(config.dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = -64000');
  db.pragma('temp_store = MEMORY');

  createTables();

  logger.info('Database initialized successfully');
  return db;
}

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS containers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      bandwidth_limit INTEGER,
      bandwidth_used INTEGER DEFAULT 0,
      bandwidth_extra INTEGER DEFAULT 0,
      reset_day INTEGER DEFAULT 1,
      last_reset_at INTEGER,
      expire_at INTEGER,
      status TEXT DEFAULT 'active',
      share_token TEXT UNIQUE,
      share_token_expire INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS traffic_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      container_id TEXT NOT NULL,
      rx_bytes INTEGER NOT NULL,
      tx_bytes INTEGER NOT NULL,
      total_bytes INTEGER NOT NULL,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (container_id) REFERENCES containers(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_traffic_container_time
    ON traffic_logs(container_id, timestamp);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      container_id TEXT,
      action TEXT NOT NULL,
      details TEXT,
      timestamp INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_audit_time
    ON audit_logs(timestamp DESC);
  `);

  logger.info('Database tables created/verified');
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function closeDatabase() {
  if (db) {
    db.close();
    logger.info('Database connection closed');
  }
}
