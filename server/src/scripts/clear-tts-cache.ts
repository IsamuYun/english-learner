import '../env.js'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { rmSync } from 'node:fs'
import { db } from '../db.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_CACHE_DIR = resolve(__dirname, '..', '..', 'data', 'tts')
const CACHE_DIR = process.env.TTS_CACHE_DIR ?? DEFAULT_CACHE_DIR

rmSync(CACHE_DIR, { recursive: true, force: true })
const { changes } = db.prepare('DELETE FROM tts_cache').run()
console.log(`cleared ${changes} row(s) + ${CACHE_DIR}`)
