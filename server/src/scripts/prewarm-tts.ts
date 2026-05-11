import '../env.js'
import { db } from '../db.js'
import { TTS_VOICES, prewarmOne } from '../routes/tts.js'

interface WordRow {
  word: string
  example_en: string | null
}

const VOICE_IDS = new Set<string>(TTS_VOICES.map((v) => v.id))

function parseArgs() {
  const args = process.argv.slice(2)
  let voiceArg: string | undefined
  let includeExamples = true
  for (const a of args) {
    if (a.startsWith('--voice=') || a.startsWith('--voices=')) {
      voiceArg = a.split('=')[1]
    } else if (a === '--no-examples') {
      includeExamples = false
    } else if (a === '--help' || a === '-h') {
      process.stdout.write(
        `Usage: npm run tts:prewarm -- [--voice=<id>[,<id>...]] [--no-examples]

  --voice=<id>     Voice ID(s), comma-separated. Default: 台湾女.
                   Use --voice=all to prewarm every configured voice.
  --no-examples    Skip example_en sentences (default: include).

Available voices:
${TTS_VOICES.map((v) => `  ${v.id.padEnd(10)} ${v.label}`).join('\n')}
`,
      )
      process.exit(0)
    }
  }
  let voices: string[]
  if (!voiceArg) voices = ['台湾女']
  else if (voiceArg === 'all') voices = TTS_VOICES.map((v) => v.id)
  else {
    voices = voiceArg.split(',').map((s) => s.trim()).filter(Boolean)
    for (const v of voices) {
      if (!VOICE_IDS.has(v)) {
        console.error(`unknown voice: ${v}`)
        process.exit(1)
      }
    }
  }
  return { voices, includeExamples }
}

async function main() {
  const { voices, includeExamples } = parseArgs()
  const rows = db.prepare('SELECT word, example_en FROM words ORDER BY id').all() as WordRow[]

  const texts = new Set<string>()
  for (const r of rows) {
    const w = r.word?.trim()
    if (w) texts.add(w)
    if (includeExamples && r.example_en) {
      const e = r.example_en.trim()
      if (e) texts.add(e)
    }
  }

  const queue = [...texts]
  const total = queue.length * voices.length
  console.log(
    `prewarming ${queue.length} unique text(s) × ${voices.length} voice(s) = ${total} item(s)`,
  )
  console.log(`voices: ${voices.join(', ')}\n`)

  let done = 0
  let hits = 0
  let misses = 0
  let errors = 0
  const t0 = Date.now()

  for (const voice of voices) {
    for (const text of queue) {
      done++
      try {
        const t = Date.now()
        const status = await prewarmOne(text, voice)
        if (status === 'hit') {
          hits++
        } else {
          misses++
          const ms = Date.now() - t
          const preview = text.length > 60 ? text.slice(0, 57) + '...' : text
          console.log(`[${done}/${total}] +${voice} (${ms}ms) ${preview}`)
        }
      } catch (e) {
        errors++
        const msg = e instanceof Error ? e.message : String(e)
        const preview = text.length > 60 ? text.slice(0, 57) + '...' : text
        console.error(`[${done}/${total}] ERR ${voice} :: ${preview} :: ${msg}`)
      }
    }
  }

  const secs = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(
    `\ndone in ${secs}s  cached: ${hits}  synthesized: ${misses}  errors: ${errors}`,
  )
  if (errors > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
