import type { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'

interface CallOptions {
  json?: boolean
  temperature?: number
  maxOutputTokens?: number
}

async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  opts: CallOptions = {},
): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY
  if (!key) return null
  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'
  try {
    const res = await fetch(`${ENDPOINT}/${model}:generateContent`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': key,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: opts.temperature ?? 0.6,
          maxOutputTokens: opts.maxOutputTokens ?? 1024,
          ...(opts.json ? { responseMimeType: 'application/json' } : {}),
        },
      }),
    })
    if (!res.ok) {
      console.warn('[ai] Gemini error', res.status, await res.text())
      return null
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }
    const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text
    return typeof txt === 'string' ? txt : null
  } catch (e) {
    console.warn('[ai] Gemini exception', e)
    return null
  }
}

function extractJson<T>(text: string): T | null {
  if (!text) return null
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) return null
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as T
  } catch {
    return null
  }
}

const aiUnavailable = (reply: FastifyReply) =>
  reply.code(503).send({ error: 'ai-not-configured' })

const SentenceInput = z.object({
  word: z.object({
    word: z.string().min(1),
    pos: z.string().default(''),
    zh: z.string().default(''),
  }),
  sentence: z.string().min(1),
})

const ConversationInput = z.object({
  zhPrompt: z.string().min(1),
  hintEn: z.string().min(1),
  userEn: z.string().default(''),
})

const ReadingInput = z.object({
  passageBody: z.string().min(1),
  question: z.string().min(1),
  studentChoice: z.string().min(1),
  correctAnswer: z.string().min(1),
})

const EssayInput = z.object({
  prompt: z.object({
    week: z.number().int().positive(),
    title: z.string(),
    enBrief: z.string(),
    minWords: z.number().int().nonnegative(),
    maxWords: z.number().int().nonnegative(),
  }),
  text: z.string().min(1),
})

export async function aiRoutes(app: FastifyInstance) {
  app.get('/api/ai/status', async () => ({
    enabled: !!process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
  }))

  app.post('/api/ai/sentence', async (req, reply) => {
    if (!process.env.GEMINI_API_KEY) return aiUnavailable(reply)
    const { word, sentence } = SentenceInput.parse(req.body)
    const system = `You are an experienced teacher of English to Chinese high-school students preparing for the Shanghai gaokao. Be supportive but precise. Reply with strict JSON only — no markdown, no code fences.`
    const user = `The student is practising the word "${word.word}" (${word.pos}, "${word.zh}").
They wrote this sentence:

"""${sentence}"""

Evaluate the sentence. Return strict JSON with this shape:
{
  "score": <integer 0-100>,
  "verdict": "excellent" | "good" | "okay" | "needs-work",
  "comments": ["short bullet 1 (in Chinese)", "short bullet 2 (in Chinese)"],
  "corrections": "<the sentence with grammar / word-choice fixes, or empty string if perfect>",
  "natural": "<a more natural native-speaker phrasing>"
}

Score rubric: correctness of using "${word.word}" (40), grammar (30), naturalness (20), richness (10).`
    const raw = await callGemini(system, user, { json: true })
    if (!raw) return aiUnavailable(reply)
    const parsed = extractJson<{ score: number }>(raw)
    if (!parsed || typeof parsed.score !== 'number') return aiUnavailable(reply)
    return parsed
  })

  app.post('/api/ai/conversation', async (req, reply) => {
    if (!process.env.GEMINI_API_KEY) return aiUnavailable(reply)
    const { zhPrompt, hintEn, userEn } = ConversationInput.parse(req.body)
    const system = `You are a friendly oral-English coach for Chinese high-school students. Reply with strict JSON only.`
    const user = `The student should express this Chinese meaning in English:
"""${zhPrompt}"""

A reference answer is: "${hintEn}"

The student said: "${userEn}"

Return strict JSON:
{
  "score": <integer 0-100>,
  "verdict": "excellent" | "good" | "okay" | "needs-work",
  "comments": ["<short Chinese bullet>", "..."],
  "better": "<a polished English version the student can imitate>"
}`
    const raw = await callGemini(system, user, { json: true })
    if (!raw) return aiUnavailable(reply)
    const parsed = extractJson<{ score: number }>(raw)
    if (!parsed || typeof parsed.score !== 'number') return aiUnavailable(reply)
    return parsed
  })

  app.post('/api/ai/reading', async (req, reply) => {
    if (!process.env.GEMINI_API_KEY) return aiUnavailable(reply)
    const { passageBody, question, studentChoice, correctAnswer } =
      ReadingInput.parse(req.body)
    const system = `You are a calm reading-comprehension tutor. Use Chinese, 2-3 short sentences max.`
    const user = `Passage:\n"""${passageBody}"""\n\nQuestion: ${question}\nThe correct answer is: ${correctAnswer}\nThe student picked: ${studentChoice}\n\nIn Chinese, briefly explain why the correct answer fits and why the student's choice is wrong (if different).`
    const raw = await callGemini(system, user, { temperature: 0.4, maxOutputTokens: 400 })
    if (!raw) return aiUnavailable(reply)
    return { explanation: raw.trim() }
  })

  app.post('/api/ai/essay', async (req, reply) => {
    if (!process.env.GEMINI_API_KEY) return aiUnavailable(reply)
    const { prompt, text } = EssayInput.parse(req.body)
    const system = `You are a senior English teacher familiar with Shanghai gaokao essay rubrics. Be encouraging and concrete. Reply with strict JSON only.`
    const user = `Topic (week ${prompt.week}): ${prompt.title}
Brief: ${prompt.enBrief}
Word range: ${prompt.minWords}–${prompt.maxWords}

Student essay:
"""${text}"""

Return strict JSON:
{
  "scoreOverall": <0-100>,
  "scoreContent": <0-100>,
  "scoreLanguage": <0-100>,
  "scoreStructure": <0-100>,
  "strengths": ["<Chinese bullet>", "..."],
  "improvements": ["<Chinese bullet, concrete and actionable>", "..."],
  "revised": "<a polished English version, similar length>"
}`
    const raw = await callGemini(system, user, { json: true, maxOutputTokens: 2048 })
    if (!raw) return aiUnavailable(reply)
    const parsed = extractJson<{ scoreOverall: number }>(raw)
    if (!parsed || typeof parsed.scoreOverall !== 'number') return aiUnavailable(reply)
    return parsed
  })
}
