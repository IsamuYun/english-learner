import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { db } from '../db.js'

interface ParsedEntry {
  word: string
  pos: string | null
  zh: string
  is_phrase: 0 | 1
}

const CN_RE = /[一-鿿]/
const POS_TOKEN_RE = /^[a-zA-Z./]+\.$/

function parseEntries(md: string): ParsedEntry[] {
  const out: ParsedEntry[] = []
  const lines = md.split(/\r?\n/)
  let inPhrases = false
  let seenWords = 0
  let seenPhrases = 0

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    if (line.includes('526个高频词组')) {
      inPhrases = true
      continue
    }
    if (/^\*\*[A-Z]\*\*$/.test(line)) continue
    if (line.startsWith('**') && line.endsWith('**')) continue

    const m = /^(\d+)\.\s*(.+)$/.exec(line)
    if (!m) continue
    const body = m[2].trim()
    if (!body) continue

    const idx = body.search(CN_RE)
    if (idx === -1) continue
    const head = body.slice(0, idx).trim()
    const zh = body.slice(idx).trim()
    if (!head || !zh) continue

    if (!inPhrases) {
      const tokens = head.split(/\s+/)
      const last = tokens[tokens.length - 1]
      let word: string
      let pos: string | null
      if (tokens.length > 1 && POS_TOKEN_RE.test(last)) {
        pos = last
        word = tokens.slice(0, -1).join(' ')
      } else {
        word = head
        pos = null
      }
      if (!word) continue
      out.push({ word, pos, zh, is_phrase: 0 })
      seenWords++
    } else {
      out.push({ word: head, pos: null, zh, is_phrase: 1 })
      seenPhrases++
    }
  }

  console.log(`parsed ${seenWords} words + ${seenPhrases} phrases (${out.length} total)`)
  return out
}

function seed() {
  const path = resolve(
    process.cwd(),
    process.argv[2] ??
      '../src/data/上海高考英语词汇表.md',
  )
  const md = readFileSync(path, 'utf8')
  const entries = parseEntries(md)

  const insert = db.prepare(
    `INSERT OR IGNORE INTO words
       (word, ipa, pos, zh, example_en, example_zh, level, is_phrase, tags, source, created_at, updated_at)
     VALUES (?, NULL, ?, ?, NULL, NULL, ?, ?, NULL, ?, ?, ?)`,
  )

  const now = Date.now()
  const tx = db.transaction((rows: ParsedEntry[]) => {
    let inserted = 0
    for (const e of rows) {
      const level = e.is_phrase ? 3 : 2
      const r = insert.run(e.word, e.pos, e.zh, level, e.is_phrase, 'shanghai-gaokao', now, now)
      if (r.changes > 0) inserted++
    }
    return inserted
  })

  const inserted = tx(entries)
  const total = (db.prepare('SELECT COUNT(*) as c FROM words').get() as { c: number }).c
  console.log(`inserted ${inserted} new rows, total in DB: ${total}`)
}

seed()
