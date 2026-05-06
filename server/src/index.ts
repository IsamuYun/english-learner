import Fastify from 'fastify'
import cors from '@fastify/cors'
import './db.js'
import { wordsRoutes } from './routes/words.js'
import { progressRoutes } from './routes/progress.js'

const app = Fastify({ logger: true })

await app.register(cors, { origin: true })
await app.register(wordsRoutes)
await app.register(progressRoutes)

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
