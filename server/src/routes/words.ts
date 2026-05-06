import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '../db.js'

const Level = z.union([z.literal(1), z.literal(2), z.literal(3)])

const WordInput = z.object({
  word: z.string().trim().min(1).max(120),
  ipa: z.string().trim().max(120).nullable().optional(),
  pos: z.string().trim().max(40).nullable().optional(),
  zh: z.string().trim().min(1).max(500),
  example_en: z.string().trim().max(500).nullable().optional(),
  example_zh: z.string().trim().max(500).nullable().optional(),
  level: Level.default(2),
  is_phrase: z.union([z.literal(0), z.literal(1)]).default(0),
  tags: z.string().trim().max(200).nullable().optional(),
})

type WordRow = {
  id: number
  word: string
  ipa: string | null
  pos: string | null
  zh: string
  example_en: string | null
  example_zh: string | null
  level: 1 | 2 | 3
  is_phrase: 0 | 1
  tags: string | null
  source: string | null
  created_at: number
  updated_at: number
}

export async function wordsRoutes(app: FastifyInstance) {
  app.get('/api/words', async (req) => {
    const q = z
      .object({
        q: z.string().optional(),
        level: z.enum(['1', '2', '3', 'all']).optional(),
        is_phrase: z.enum(['0', '1', 'all']).optional(),
        page: z.coerce.number().int().positive().default(1),
        pageSize: z.coerce.number().int().positive().max(500).default(50),
      })
      .parse(req.query)

    const where: string[] = []
    const params: any[] = []

    if (q.q) {
      where.push('(word LIKE ? OR zh LIKE ?)')
      const like = `%${q.q}%`
      params.push(like, like)
    }
    if (q.level && q.level !== 'all') {
      where.push('level = ?')
      params.push(parseInt(q.level, 10))
    }
    if (q.is_phrase && q.is_phrase !== 'all') {
      where.push('is_phrase = ?')
      params.push(parseInt(q.is_phrase, 10))
    }

    const sqlWhere = where.length ? 'WHERE ' + where.join(' AND ') : ''
    const total = (
      db.prepare(`SELECT COUNT(*) as c FROM words ${sqlWhere}`).get(...params) as { c: number }
    ).c

    const offset = (q.page - 1) * q.pageSize
    const rows = db
      .prepare(
        `SELECT * FROM words ${sqlWhere}
         ORDER BY id ASC
         LIMIT ? OFFSET ?`,
      )
      .all(...params, q.pageSize, offset) as WordRow[]

    return { items: rows, total, page: q.page, pageSize: q.pageSize }
  })

  app.get('/api/words/:id', async (req, reply) => {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params)
    const row = db.prepare('SELECT * FROM words WHERE id = ?').get(id) as WordRow | undefined
    if (!row) return reply.code(404).send({ error: 'not found' })
    return row
  })

  app.post('/api/words', async (req, reply) => {
    const data = WordInput.parse(req.body)
    const now = Date.now()
    try {
      const r = db
        .prepare(
          `INSERT INTO words
             (word, ipa, pos, zh, example_en, example_zh, level, is_phrase, tags, source, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          data.word,
          data.ipa ?? null,
          data.pos ?? null,
          data.zh,
          data.example_en ?? null,
          data.example_zh ?? null,
          data.level,
          data.is_phrase,
          data.tags ?? null,
          'manual',
          now,
          now,
        )
      const row = db.prepare('SELECT * FROM words WHERE id = ?').get(r.lastInsertRowid) as WordRow
      return reply.code(201).send(row)
    } catch (e: any) {
      if (String(e?.message ?? '').includes('UNIQUE')) {
        return reply.code(409).send({ error: 'duplicate word' })
      }
      throw e
    }
  })

  app.put('/api/words/:id', async (req, reply) => {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params)
    const data = WordInput.partial().parse(req.body)
    const cur = db.prepare('SELECT * FROM words WHERE id = ?').get(id) as WordRow | undefined
    if (!cur) return reply.code(404).send({ error: 'not found' })

    const merged = { ...cur, ...data, updated_at: Date.now() }
    db.prepare(
      `UPDATE words SET
         word = ?, ipa = ?, pos = ?, zh = ?, example_en = ?, example_zh = ?,
         level = ?, is_phrase = ?, tags = ?, updated_at = ?
       WHERE id = ?`,
    ).run(
      merged.word,
      merged.ipa ?? null,
      merged.pos ?? null,
      merged.zh,
      merged.example_en ?? null,
      merged.example_zh ?? null,
      merged.level,
      merged.is_phrase,
      merged.tags ?? null,
      merged.updated_at,
      id,
    )
    return db.prepare('SELECT * FROM words WHERE id = ?').get(id) as WordRow
  })

  app.delete('/api/words/:id', async (req, reply) => {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params)
    const r = db.prepare('DELETE FROM words WHERE id = ?').run(id)
    if (r.changes === 0) return reply.code(404).send({ error: 'not found' })
    return reply.code(204).send()
  })
}
