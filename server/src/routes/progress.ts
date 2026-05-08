import type { FastifyInstance, FastifyRequest } from 'fastify'
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

function uid(req: FastifyRequest): number {
  // requireAuth onRequest hook guarantees userId for non-public routes
  return req.userId as number
}

export async function progressRoutes(app: FastifyInstance) {
  // ---- flashcards ----
  app.get('/api/flashcards', async (req) => {
    const rows = db
      .prepare('SELECT * FROM flashcard_progress WHERE user_id = ?')
      .all(uid(req)) as any[]
    const map: Record<string, any> = {}
    for (const r of rows) map[String(r.word_id)] = r
    return map
  })

  app.put('/api/flashcards/:wordId', async (req) => {
    const { wordId } = z
      .object({ wordId: z.coerce.number().int().positive() })
      .parse(req.params)
    const patch = FlashcardPatch.parse(req.body)
    const userId = uid(req)

    const cur = db
      .prepare('SELECT * FROM flashcard_progress WHERE user_id = ? AND word_id = ?')
      .get(userId, wordId) as any | undefined
    const next = {
      user_id: userId,
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
         (user_id, word_id, seen, known, last_reviewed, due, bucket)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, word_id) DO UPDATE SET
         seen = excluded.seen,
         known = excluded.known,
         last_reviewed = excluded.last_reviewed,
         due = excluded.due,
         bucket = excluded.bucket`,
    ).run(
      next.user_id,
      next.word_id,
      next.seen,
      next.known,
      next.last_reviewed,
      next.due,
      next.bucket,
    )

    return next
  })

  // ---- reading results ----
  app.get('/api/reading-results', async (req) => {
    const rows = db
      .prepare(
        'SELECT * FROM reading_results WHERE user_id = ? ORDER BY taken_at DESC LIMIT 100',
      )
      .all(uid(req)) as any[]
    return rows.map((r) => ({ ...r, answers: JSON.parse(r.answers) }))
  })

  app.post('/api/reading-results', async (req, reply) => {
    const r = ReadingResult.parse(req.body)
    const userId = uid(req)
    db.prepare(
      `INSERT INTO reading_results (passage_id, taken_at, correct, total, answers, user_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(r.passage_id, r.taken_at, r.correct, r.total, JSON.stringify(r.answers), userId)
    db.prepare(
      `DELETE FROM reading_results WHERE user_id = ? AND id NOT IN (
         SELECT id FROM reading_results WHERE user_id = ? ORDER BY taken_at DESC LIMIT 100
       )`,
    ).run(userId, userId)
    return reply.code(201).send({ ok: true })
  })

  // ---- essays ----
  app.get('/api/essays', async (req) => {
    const rows = db
      .prepare('SELECT * FROM essay_drafts WHERE user_id = ?')
      .all(uid(req)) as any[]
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
    const userId = uid(req)
    const now = Date.now()
    db.prepare(
      `INSERT INTO essay_drafts (user_id, week, text, updated_at, feedback)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, week) DO UPDATE SET
         text = excluded.text,
         updated_at = excluded.updated_at,
         feedback = excluded.feedback`,
    ).run(
      userId,
      draft.week,
      draft.text,
      now,
      draft.feedback === undefined ? null : JSON.stringify(draft.feedback),
    )
    return { week: draft.week, text: draft.text, updatedAt: now, feedback: draft.feedback }
  })

  // ---- settings ----
  app.get('/api/settings', async (req) => {
    const rows = db.prepare('SELECT key, value FROM settings WHERE user_id = ?').all(uid(req)) as {
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
    const userId = uid(req)
    const tx = db.transaction((entries: [string, unknown][]) => {
      const stmt = db.prepare(
        `INSERT INTO settings (user_id, key, value) VALUES (?, ?, ?)
         ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value`,
      )
      for (const [k, v] of entries) stmt.run(userId, k, JSON.stringify(v))
    })
    tx(Object.entries(body))
    return body
  })

  // ---- stats ----
  app.get('/api/stats', async (req) => {
    const userId = uid(req)
    const totalWords = (db.prepare('SELECT COUNT(*) as c FROM words').get() as { c: number }).c
    const seenWords = (
      db
        .prepare('SELECT COUNT(*) as c FROM flashcard_progress WHERE user_id = ? AND seen > 0')
        .get(userId) as { c: number }
    ).c
    const knownWords = (
      db
        .prepare('SELECT COUNT(*) as c FROM flashcard_progress WHERE user_id = ? AND bucket >= 3')
        .get(userId) as { c: number }
    ).c
    const masteredWords = (
      db
        .prepare('SELECT COUNT(*) as c FROM flashcard_progress WHERE user_id = ? AND bucket = 4')
        .get(userId) as { c: number }
    ).c

    const byLevelRows = db
      .prepare(
        `SELECT w.level AS level,
                COUNT(*) AS total,
                SUM(CASE WHEN fp.seen > 0 THEN 1 ELSE 0 END) AS seen,
                SUM(CASE WHEN fp.bucket >= 3 THEN 1 ELSE 0 END) AS known
         FROM words w
         LEFT JOIN flashcard_progress fp ON fp.word_id = w.id AND fp.user_id = ?
         GROUP BY w.level
         ORDER BY w.level`,
      )
      .all(userId) as { level: number; total: number; seen: number; known: number }[]

    const essayCount = (
      db.prepare('SELECT COUNT(*) as c FROM essay_drafts WHERE user_id = ?').get(userId) as {
        c: number
      }
    ).c

    const readingAgg = db
      .prepare(
        `SELECT COUNT(*) AS attempts,
                COALESCE(SUM(correct), 0) AS correct,
                COALESCE(SUM(total), 0)   AS total
         FROM reading_results WHERE user_id = ?`,
      )
      .get(userId) as { attempts: number; correct: number; total: number }

    return {
      totalWords,
      seenWords,
      knownWords,
      masteredWords,
      byLevel: byLevelRows.map((r) => ({
        level: r.level,
        total: r.total,
        seen: r.seen ?? 0,
        known: r.known ?? 0,
      })),
      essayCount,
      reading: {
        attempts: readingAgg.attempts,
        correct: readingAgg.correct,
        total: readingAgg.total,
      },
    }
  })
}
