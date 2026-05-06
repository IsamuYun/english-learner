import Database from 'better-sqlite3'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { mkdirSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = resolve(__dirname, '..', 'data')
mkdirSync(DATA_DIR, { recursive: true })

const DB_PATH = process.env.DB_PATH ?? resolve(DATA_DIR, 'app.db')

export const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

const MIGRATIONS: string[] = [
  `CREATE TABLE IF NOT EXISTS schema_version (
     version INTEGER PRIMARY KEY
   );`,
  `CREATE TABLE IF NOT EXISTS words (
     id          INTEGER PRIMARY KEY AUTOINCREMENT,
     word        TEXT    NOT NULL,
     ipa         TEXT,
     pos         TEXT,
     zh          TEXT    NOT NULL,
     example_en  TEXT,
     example_zh  TEXT,
     level       INTEGER NOT NULL DEFAULT 2 CHECK (level IN (1,2,3)),
     is_phrase   INTEGER NOT NULL DEFAULT 0 CHECK (is_phrase IN (0,1)),
     tags        TEXT,
     source      TEXT,
     created_at  INTEGER NOT NULL,
     updated_at  INTEGER NOT NULL,
     UNIQUE(word, is_phrase)
   );`,
  `CREATE INDEX IF NOT EXISTS idx_words_level    ON words(level);`,
  `CREATE INDEX IF NOT EXISTS idx_words_phrase   ON words(is_phrase);`,
  `CREATE INDEX IF NOT EXISTS idx_words_word     ON words(word);`,
  `CREATE TABLE IF NOT EXISTS flashcard_progress (
     word_id        INTEGER PRIMARY KEY,
     seen           INTEGER NOT NULL DEFAULT 0,
     known          INTEGER NOT NULL DEFAULT 0,
     last_reviewed  INTEGER NOT NULL DEFAULT 0,
     due            INTEGER NOT NULL DEFAULT 0,
     bucket         INTEGER NOT NULL DEFAULT 0 CHECK (bucket BETWEEN 0 AND 4),
     FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
   );`,
  `CREATE TABLE IF NOT EXISTS reading_results (
     id          INTEGER PRIMARY KEY AUTOINCREMENT,
     passage_id  TEXT    NOT NULL,
     taken_at    INTEGER NOT NULL,
     correct     INTEGER NOT NULL,
     total       INTEGER NOT NULL,
     answers     TEXT    NOT NULL
   );`,
  `CREATE INDEX IF NOT EXISTS idx_reading_taken_at ON reading_results(taken_at DESC);`,
  `CREATE TABLE IF NOT EXISTS essay_drafts (
     week        INTEGER PRIMARY KEY,
     text        TEXT    NOT NULL DEFAULT '',
     updated_at  INTEGER NOT NULL,
     feedback    TEXT
   );`,
  `CREATE TABLE IF NOT EXISTS settings (
     key   TEXT PRIMARY KEY,
     value TEXT NOT NULL
   );`,
]

function currentVersion(): number {
  try {
    const row = db.prepare('SELECT MAX(version) as v FROM schema_version').get() as
      | { v: number | null }
      | undefined
    return row?.v ?? 0
  } catch {
    return 0
  }
}

export function migrate(): void {
  db.exec(MIGRATIONS[0])
  const start = currentVersion()
  const tx = db.transaction(() => {
    for (let i = start; i < MIGRATIONS.length; i++) {
      db.exec(MIGRATIONS[i])
      db.prepare('INSERT OR REPLACE INTO schema_version(version) VALUES (?)').run(i + 1)
    }
  })
  tx()
}

migrate()
