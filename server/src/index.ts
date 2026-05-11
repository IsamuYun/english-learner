import './env.js'    // Must be first: loads .env into process.env before any consumer reads it.
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { ZodError } from 'zod'
import './db.js'
import { wordsRoutes } from './routes/words.js'
import { progressRoutes } from './routes/progress.js'
import { authRoutes } from './routes/auth.js'
import { aiRoutes } from './routes/ai.js'
import { ttsRoutes } from './routes/tts.js'
import { registerAuthHook } from './auth.js'

const app = Fastify({ logger: true })

await app.register(cors, { origin: true, credentials: true })

app.setErrorHandler((err, _req, reply) => {
  if (err instanceof ZodError) {
    return reply.code(400).send({
      error: 'invalid input',
      issues: err.issues.map((i) => ({ path: i.path, message: i.message })),
    })
  }
  reply.send(err)
})

registerAuthHook(app)

await app.register(authRoutes)
await app.register(wordsRoutes)
await app.register(progressRoutes)
await app.register(aiRoutes)
await app.register(ttsRoutes)

app.get('/api/health', async () => ({ ok: true }))

const port = Number(process.env.PORT ?? 3001)
const host = process.env.HOST ?? '127.0.0.1'

app
  .listen({ port, host })
  .then(() => app.log.info(`server ready at http://${host}:${port}`))
  .catch((err) => {
    app.log.error(err)
    process.exit(1)
  })
