import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '../db.js'
import {
  createSession,
  deleteSession,
  hashPassword,
  verifyPassword,
  type UserRow,
} from '../auth.js'

const Register = z.object({
  username: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_.-]+$/, 'invalid username'),
  password: z.string().min(6).max(200),
  displayName: z.string().trim().min(1).max(60).optional(),
})

const LoginInput = z.object({
  username: z.string().trim().min(1).max(40),
  password: z.string().min(1).max(200),
})

function publicUser(u: UserRow) {
  return { id: u.id, username: u.username, displayName: u.display_name, createdAt: u.created_at }
}

export async function authRoutes(app: FastifyInstance) {
  app.post('/api/auth/register', async (req, reply) => {
    const data = Register.parse(req.body)
    const exists = db
      .prepare('SELECT id FROM users WHERE username = ?')
      .get(data.username) as { id: number } | undefined
    if (exists) return reply.code(409).send({ error: 'username taken' })

    const { hash, salt } = hashPassword(data.password)
    const now = Date.now()
    const r = db
      .prepare(
        `INSERT INTO users (username, display_name, password_hash, password_salt, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(data.username, data.displayName ?? data.username, hash, salt, now)
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(r.lastInsertRowid) as UserRow
    const session = createSession(user.id)
    return reply.code(201).send({
      token: session.token,
      expiresAt: session.expiresAt,
      user: publicUser(user),
    })
  })

  app.post('/api/auth/login', async (req, reply) => {
    const data = LoginInput.parse(req.body)
    const user = db
      .prepare('SELECT * FROM users WHERE username = ?')
      .get(data.username) as UserRow | undefined
    if (!user || !verifyPassword(data.password, user.password_hash, user.password_salt)) {
      return reply.code(401).send({ error: 'invalid credentials' })
    }
    const session = createSession(user.id)
    return {
      token: session.token,
      expiresAt: session.expiresAt,
      user: publicUser(user),
    }
  })

  app.post('/api/auth/logout', async (req, reply) => {
    const h = req.headers['authorization']
    const token = typeof h === 'string' ? h.match(/^Bearer\s+(.+)$/i)?.[1] : null
    if (token) deleteSession(token.trim())
    return reply.code(204).send()
  })

  app.get('/api/auth/me', async (req, reply) => {
    const h = req.headers['authorization']
    const token = typeof h === 'string' ? h.match(/^Bearer\s+(.+)$/i)?.[1] : null
    if (!token) return reply.code(401).send({ error: 'unauthenticated' })
    const user = db
      .prepare(
        `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token = ? AND s.expires_at > ?`,
      )
      .get(token.trim(), Date.now()) as UserRow | undefined
    if (!user) return reply.code(401).send({ error: 'unauthenticated' })
    return { user: publicUser(user) }
  })
}
