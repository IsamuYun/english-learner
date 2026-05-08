import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ENV_PATH = resolve(__dirname, '..', '.env')

// Tiny .env loader. We don't pull in dotenv to keep the dep surface minimal —
// this file is parsed once at startup, before any other module reads
// process.env. Explicit env (systemd Environment=, shell export) wins over
// the file so production deploys can override without editing it.
if (existsSync(ENV_PATH)) {
  const content = readFileSync(ENV_PATH, 'utf8')
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    if (!key || key in process.env) continue
    const value = line.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '')
    process.env[key] = value
  }
}
