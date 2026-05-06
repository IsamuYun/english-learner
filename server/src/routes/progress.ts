import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '../db.js'

const Bucket = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
])

const FlashcardPatch = z
  .object({
    seen: z.number().int().nonnegative().optional(),
    known: z.number().int().nonnegative().optional(),
    last_reviewed: z.number().int().nonnegative().optional(),
    due: z.number().int().nonnegative().optional(),
    bucket: Bucket.optional(),
  })
  .strict()

const ReadingResult = z.object({
  passage_id: z.string().min(1),
  taken_at: z.number().int().nonnegative(),
  correct: z.number().int().nonnegative(),
  total: z.number().int().positive(),
  answers: z.array(z.number().int()),
})

const EssayDraft = z.object({
  week: z.number().int().positive(),
  text: z.string().default(''),
  feedback: z.unknown().optional(),
})

export async function progressRoutes(app: FastifyInstance) {
  // ---- flashcards ----
  app.get('/api/flashcards', async () => {
    const rows = db.prepare('SELECT * FROM flashcard_progress').all() as any[]
    const map: Record<string, any> = {}
    for (const r of rows) map[String(r.word_id)] = r
    return map
  })

  app.put('/api/flashcards/:wordId', async (req) => {
    const { wordId } = z
      .object({ wordId: z.coerce.number().int().positive() })
      .parse(req.params)
    const patch = FlashcardPatch.parse(req.body)

    const cur = db
      .prepare('SELECT * FROM flashcard_progress WHERE word_id = ?')
      .get(wordId) as any | undefined
    const next = {
      word_id: wordId,
      seen: 0,
      known: 0,
      last_reviewed: 0,
      due: 0,
      bucket: 0,
      ...cur,
      ...patch,
    }

    db.prepare(
      `INSERT INTO flashcard_progress
         (word_id, seen, known, last_reviewed, due, bucket)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(word_id) DO UPDATE SET
         seen = excluded.seen,
         known = excluded.known,
         last_reviewed = excluded.last_reviewed,
         due = excluded.due,
         bucket = excluded.bucket`,
    ).run(next.word_id, next.seen, next.known, next.last_reviewed, next.due, next.bucket)

    return next
  })

  // ---- reading results ----
  app.get('/api/reading-results', async () => {
    const rows = db
      .prepare('SELECT * FROM reading_results ORDER BY taken_at DESC LIMIT 100')
      .all() as any[]
    return rows.map((r) => ({ ...r, answers: JSON.parse(r.answers) }))
  })

  app.post('/api/reading-results', async (req, reply) => {
    const r = ReadingResult.parse(req.body)
    const ins = db.prepare(
      `INSERT INTO reading_results (passage_id, taken_at, correct, total, answers)
       VALUES (?, ?, ?, ?, ?)`,
    )
    ins.run(r.passage_id, r.taken_at, r.correct, r.total, JSON.stringify(r.answers))
    db.prepare(
      `DELETE FROM reading_results WHERE id NOT IN (
         SELECT id FROM reading_results ORDER BY taken_at DESC LIMIT 100
       )`,
    ).run()
    return reply.code(201).send({ ok: true })
  })

  // ---- essays ----
  app.get('/api/essays', async () => {
    const rows = db.prepare('SELECT * FROM essay_drafts').all() as any[]
    const map: Record<number, any> = {}
    for (const r of rows) {
      map[r.week] = {
        week: r.week,
        text: r.text,
        updatedAt: r.updated_at,
        feedback: r.feedback ? JSON.parse(r.feedback) : undefined,
      }
    }
    return map
  })

  app.put('/api/essays/:week', async (req) => {
    const { week } = z.object({ week: z.coerce.number().int().positive() }).parse(req.params)
    const draft = EssayDraft.parse({ ...(req.body as any), week })
    const now = Date.now()
    db.prepare(
      `INSERT INTO essay_drafts (week, text, updated_at, feedback)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(week) DO UPDATE SET
         text = excluded.text,
         updated_at = excluded.updated_at,
         feedback = excluded.feedback`,
    ).run(
      draft.week,
      draft.text,
      now,
      draft.feedback === undefined ? null : JSON.stringify(draft.feedback),
    )
    return { week: draft.week, text: draft.text, updatedAt: now, feedback: draft.feedback }
  })

  // ---- settings ----
  app.get('/api/settings', async () => {
    const rows = db.prepare('SELECT key, value FROM settings').all() as {
      key: string
      value: string
    }[]
    const out: Record<string, unknown> = {}
    for (const r of rows) {
      try {
        out[r.key] = JSON.parse(r.value)
      } catch {
        out[r.key] = r.value
      }
    }
    return out
  })

  app.put('/api/settings', async (req) => {
    const body = z.record(z.unknown()).parse(req.body)
    const tx = db.transaction((entries: [string, unknown][]) => {
      const stmt = db.prepare(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      )
      for (const [k, v] of entries) stmt.run(k, JSON.stringify(v))
    })
    tx(Object.entries(body))
    return body
  })
}
