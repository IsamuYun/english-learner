import { spawnSync } from 'node:child_process'
import { existsSync, unlinkSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const SERVER = resolve(ROOT, 'server')
const DB = resolve(SERVER, 'data/e2e.db')
const VOCAB_MD = resolve(ROOT, 'src/data/上海高考英语词汇表.md')

export default async function globalSetup() {
  // Wipe any leftover SQLite files so each run starts from a known state.
  for (const suffix of ['', '-shm', '-wal']) {
    const f = DB + suffix
    if (existsSync(f)) unlinkSync(f)
  }

  // Seed words. The seed script's first line `import '../db.js'` triggers migrations,
  // so this also bootstraps the schema for the e2e DB.
  const r = spawnSync(
    'npx',
    ['tsx', 'src/scripts/seed.ts', VOCAB_MD],
    {
      cwd: SERVER,
      env: { ...process.env, DB_PATH: DB },
      stdio: 'inherit',
    },
  )
  if (r.status !== 0) {
    throw new Error(`seed script failed with status ${r.status}`)
  }
}
