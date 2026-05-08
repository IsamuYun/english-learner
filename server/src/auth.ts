import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { db } from './db.js'

const SCRYPT_KEYLEN = 64
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30 // 30 days

export interface UserRow {
  id: number
  username: string
  display_name: string
  password_hash: string
  password_salt: string
  created_at: number
}

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const useSalt = salt ?? randomBytes(16).toString('hex')
  const hash = scryptSync(password, useSalt, SCRYPT_KEYLEN).toString('hex')
  return { hash, salt: useSalt }
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const candidate = scryptSync(password, salt, SCRYPT_KEYLEN)
  const stored = Buffer.from(hash, 'hex')
  if (candidate.length !== stored.length) return false
  return timingSafeEqual(candidate, stored)
}

export function createSession(userId: number): { token: string; expiresAt: number } {
  const token = randomBytes(32).toString('hex')
  const now = Date.now()
  const expiresAt = now + SESSION_TTL_MS
  db.prepare(
    `INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`,
  ).run(token, userId, now, expiresAt)
  return { token, expiresAt }
}

export function deleteSession(token: string): void {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
}

export function lookupSession(token: string): UserRow | null {
  const row = db
    .prepare(
      `SELECT u.* FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`,
    )
    .get(token, Date.now()) as UserRow | undefined
  return row ?? null
}

function extractToken(req: FastifyRequest): string | null {
  const h = req.headers['authorization']
  if (!h || typeof h !== 'string') return null
  const m = h.match(/^Bearer\s+(.+)$/i)
  return m ? m[1].trim() : null
}

function isPublic(method: string, url: string): boolean {
  if (url === '/api/health') return true
  if (url.startsWith('/api/auth/')) return true
  // Word content is read-only data, not user-scoped — let the public Home page
  // fetch it. Mutating verbs stay protected so /manage stays gated.
  if (method === 'GET' && (url === '/api/words' || url.startsWith('/api/words/'))) return true
  // AI status is a yes/no flag about the project config; safe to expose so
  // anonymous Home / Settings can show "AI ready" without 401s.
  if (method === 'GET' && url === '/api/ai/status') return true
  return false
}

declare module 'fastify' {
  interface FastifyRequest {
    userId?: number
    user?: UserRow
  }
}

export function registerAuthHook(app: FastifyInstance): void {
  app.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
    const url = req.url.split('?')[0]
    if (!url.startsWith('/api/')) return
    if (isPublic(req.method, url)) return

    const token = extractToken(req)
    if (!token) {
      reply.code(401).send({ error: 'unauthenticated' })
      return reply
    }
    const user = lookupSession(token)
    if (!user) {
      reply.code(401).send({ error: 'unauthenticated' })
      return reply
    }
    req.userId = user.id
    req.user = user
  })
}
