import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

let db: Database.Database

export function getDb(): Database.Database {
  if (!db) throw new Error('DB not initialized — call initDb() first')
  return db
}

export function initDb(): Database.Database {
  const dbPath = path.resolve(process.env.DB_PATH ?? './data/petreg.db')
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db)
  return db
}

function runMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    );
  `)

  const row = db.prepare('SELECT MAX(version) as v FROM schema_version').get() as { v: number | null }
  const current = row?.v ?? 0

  const migrations: Array<{ version: number; sql: string }> = [
    {
      version: 1,
      sql: `
        CREATE TABLE IF NOT EXISTS runners (
          id                INTEGER PRIMARY KEY AUTOINCREMENT,
          ticket_id         TEXT    NOT NULL UNIQUE,
          first_name        TEXT    NOT NULL DEFAULT '',
          last_name         TEXT    NOT NULL DEFAULT '',
          email             TEXT    NOT NULL DEFAULT '',
          phone             TEXT,
          bib_number        TEXT    UNIQUE,
          cert_file_key     TEXT,
          dog_photo_key     TEXT,
          submission_status TEXT    NOT NULL DEFAULT 'pending'
                              CHECK(submission_status IN ('pending','submitted','verified','rejected')),
          notes             TEXT,
          created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
          updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_runners_ticket_id  ON runners(ticket_id);
        CREATE INDEX IF NOT EXISTS idx_runners_bib_number ON runners(bib_number);
        CREATE INDEX IF NOT EXISTS idx_runners_email      ON runners(email);

        CREATE TABLE IF NOT EXISTS staff_accounts (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          username   TEXT NOT NULL UNIQUE,
          email      TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          role       TEXT NOT NULL DEFAULT 'official'
                       CHECK(role IN ('admin','official')),
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS crew_tokens (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          token      TEXT NOT NULL UNIQUE,
          label      TEXT NOT NULL DEFAULT '',
          active     INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS system_settings (
          key        TEXT PRIMARY KEY,
          value      TEXT NOT NULL DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS audit_log (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          actor_id   INTEGER,
          actor_role TEXT,
          action     TEXT NOT NULL,
          entity     TEXT NOT NULL,
          entity_id  TEXT NOT NULL,
          detail     TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- Default settings
        INSERT OR IGNORE INTO system_settings(key, value) VALUES
          ('confirmation_cc_email', ''),
          ('event_name', 'Dog Run Race'),
          ('crew_link_base_url', 'http://localhost:5173/crew');
      `,
    },
    {
      version: 2,
      sql: `
        ALTER TABLE runners ADD COLUMN ticket_name  TEXT;
        ALTER TABLE runners ADD COLUMN shirt_size   TEXT;
        ALTER TABLE runners ADD COLUMN collar_size  TEXT;
      `,
    },
    {
      version: 3,
      sql: `
        ALTER TABLE runners ADD COLUMN cert_file_key_2 TEXT;
        ALTER TABLE runners ADD COLUMN cert_file_key_3 TEXT;
      `,
    },
    {
      version: 4,
      sql: `
        ALTER TABLE runners ADD COLUMN checked_in INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE runners ADD COLUMN checked_in_at TEXT;
      `,
    },
    {
      version: 5,
      sql: `
        ALTER TABLE runners ADD COLUMN uploads_locked INTEGER NOT NULL DEFAULT 0;
      `,
    },
  ]

  for (const m of migrations) {
    if (m.version > current) {
      db.transaction(() => {
        db.exec(m.sql)
        db.prepare('INSERT OR REPLACE INTO schema_version(version) VALUES (?)').run(m.version)
      })()
      console.log(`DB migration v${m.version} applied`)
    }
  }
}
