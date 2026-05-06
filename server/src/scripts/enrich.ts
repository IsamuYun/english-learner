import { db } from '../db.js'

interface DictEntry {
  phonetic?: string
  phonetics?: { text?: string }[]
  meanings?: {
    definitions?: { example?: string }[]
  }[]
}

async function fetchDict(word: string): Promise<DictEntry | null> {
  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const data = (await res.json()) as DictEntry[]
    return Array.isArray(data) && data.length > 0 ? data[0] : null
  } catch {
    return null
  }
}

function pickIpa(e: DictEntry): string | null {
  if (e.phonetic) return e.phonetic
  for (const p of e.phonetics ?? []) if (p.text) return p.text
  return null
}

function pickExample(e: DictEntry): string | null {
  for (const m of e.meanings ?? []) {
    for (const d of m.definitions ?? []) {
      if (d.example && d.example.trim()) return d.example.trim()
    }
  }
  return null
}

async function main() {
  const limitArg = process.argv.find((a) => a.startsWith('--limit='))
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity

  const rows = db
    .prepare(
      `SELECT id, word FROM words
       WHERE is_phrase = 0 AND (ipa IS NULL OR ipa = '')
       ORDER BY id`,
    )
    .all() as { id: number; word: string }[]

  const todo = rows.slice(0, Math.min(rows.length, limit))
  console.log(`enriching ${todo.length} word(s)...`)

  const update = db.prepare(
    `UPDATE words
       SET ipa = COALESCE(?, ipa),
           example_en = COALESCE(example_en, ?),
           updated_at = ?
     WHERE id = ?`,
  )

  let withIpa = 0
  let withExample = 0
  let missed = 0

  for (let i = 0; i < todo.length; i++) {
    const { id, word } = todo[i]
    const e = await fetchDict(word)
    if (!e) {
      missed++
    } else {
      const ipa = pickIpa(e)
      const ex = pickExample(e)
      if (ipa || ex) {
        update.run(ipa, ex, Date.now(), id)
        if (ipa) withIpa++
        if (ex) withExample++
      } else {
        missed++
      }
    }

    if ((i + 1) % 25 === 0) {
      console.log(`  ${i + 1}/${todo.length}  ipa+${withIpa}  ex+${withExample}  miss${missed}`)
    }
    await new Promise((r) => setTimeout(r, 120))
  }

  console.log(`done. ipa filled: ${withIpa}  examples filled: ${withExample}  missed: ${missed}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
