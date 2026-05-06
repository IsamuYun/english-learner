// Calls Anthropic Claude API directly from the browser.
// Requires a user-supplied API key in Settings. When no key is present we return null,
// and callers fall back to a basic heuristic so the app still works offline.

import type {
  EssayFeedback,
  EssayPrompt,
  SentenceEvaluation,
  VocabWord,
} from '../types'
import { settingsStore } from './storage'

const ENDPOINT = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-haiku-4-5-20251001'

interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string
}

async function callClaude(system: string, messages: AnthropicMessage[]): Promise<string | null> {
  const key = settingsStore.get().apiKey
  if (!key) return null
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system,
        messages,
      }),
    })
    if (!res.ok) {
      const t = await res.text()
      console.warn('Claude API error', res.status, t)
      return null
    }
    const data = await res.json()
    const txt = data?.content?.[0]?.text
    return typeof txt === 'string' ? txt : null
  } catch (e) {
    console.warn('Claude API exception', e)
    return null
  }
}

function extractJson<T>(text: string): T | null {
  if (!text) return null
  // Strip code fences
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim()
  // Find first { and last }
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) return null
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as T
  } catch {
    return null
  }
}

// ============================================================
// Sentence evaluation for Flashcards
// ============================================================

export async function evaluateSentence(
  word: VocabWord,
  sentence: string,
): Promise<SentenceEvaluation> {
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

  const raw = await callClaude(system, [{ role: 'user', content: user }])
  if (raw) {
    const parsed = extractJson<SentenceEvaluation>(raw)
    if (parsed && typeof parsed.score === 'number') return parsed
  }
  return heuristicSentenceEval(word, sentence)
}

function heuristicSentenceEval(word: VocabWord, sentence: string): SentenceEvaluation {
  const s = sentence.trim()
  const lower = s.toLowerCase()
  const containsWord = new RegExp(`\\b${word.word.toLowerCase()}\\w*\\b`).test(lower)
  const wordCount = s.split(/\s+/).filter(Boolean).length
  const endsWithPunct = /[.!?]$/.test(s)
  const startsCapital = /^[A-Z]/.test(s)

  const issues: string[] = []
  let score = 100
  if (!containsWord) {
    score -= 50
    issues.push(`句子中需要包含目标单词 "${word.word}"。`)
  }
  if (wordCount < 4) {
    score -= 20
    issues.push('句子太短，建议补充时间、地点或原因，使句意更完整。')
  }
  if (!startsCapital) {
    score -= 5
    issues.push('英语句子首字母需要大写。')
  }
  if (!endsWithPunct) {
    score -= 5
    issues.push('请在句末加上标点（"."、"!" 或 "?"）。')
  }
  if (issues.length === 0) {
    issues.push('用法基本正确，继续保持，可以尝试加入从句或更地道的搭配。')
  }
  score = Math.max(0, Math.min(100, score))
  const verdict: SentenceEvaluation['verdict'] =
    score >= 90 ? 'excellent' : score >= 75 ? 'good' : score >= 60 ? 'okay' : 'needs-work'

  return {
    score,
    verdict,
    comments: issues,
    corrections: '',
    natural: '',
  }
}

// ============================================================
// Conversation: evaluate user's English vs the model hint
// ============================================================

export interface ConversationFeedback {
  score: number
  verdict: 'excellent' | 'good' | 'okay' | 'needs-work'
  comments: string[]
  better: string
}

export async function evaluateConversationTurn(
  zhPrompt: string,
  hintEn: string,
  userEn: string,
): Promise<ConversationFeedback> {
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
  const raw = await callClaude(system, [{ role: 'user', content: user }])
  if (raw) {
    const parsed = extractJson<ConversationFeedback>(raw)
    if (parsed && typeof parsed.score === 'number') return parsed
  }
  return heuristicConversationEval(hintEn, userEn)
}

function heuristicConversationEval(hint: string, user: string): ConversationFeedback {
  const u = user.trim().toLowerCase()
  const h = hint.toLowerCase()
  if (!u) {
    return {
      score: 0,
      verdict: 'needs-work',
      comments: ['没有检测到你的回答，请尝试再说一次。'],
      better: hint,
    }
  }
  const hWords = new Set(h.replace(/[^a-z\s']/g, '').split(/\s+/).filter((w) => w.length > 2))
  const uWords = new Set(u.replace(/[^a-z\s']/g, '').split(/\s+/).filter((w) => w.length > 2))
  let overlap = 0
  hWords.forEach((w) => {
    if (uWords.has(w)) overlap++
  })
  const ratio = hWords.size === 0 ? 0 : overlap / hWords.size
  const score = Math.round(40 + ratio * 55)
  const verdict: ConversationFeedback['verdict'] =
    score >= 85 ? 'excellent' : score >= 70 ? 'good' : score >= 55 ? 'okay' : 'needs-work'
  return {
    score,
    verdict,
    comments: [
      ratio > 0.6
        ? '关键意思表达到位，继续注意语调与流利度。'
        : '可以再贴近参考答案的核心动词与名词，意思会更准确。',
    ],
    better: hint,
  }
}

// ============================================================
// Reading: explain why an answer is right/wrong (optional flair)
// ============================================================

export async function explainReading(
  passageBody: string,
  question: string,
  studentChoice: string,
  correctAnswer: string,
): Promise<string | null> {
  const system = `You are a calm reading-comprehension tutor. Use Chinese, 2-3 short sentences max.`
  const user = `Passage:\n"""${passageBody}"""\n\nQuestion: ${question}\nThe correct answer is: ${correctAnswer}\nThe student picked: ${studentChoice}\n\nIn Chinese, briefly explain why the correct answer fits and why the student's choice is wrong (if different).`
  return callClaude(system, [{ role: 'user', content: user }])
}

// ============================================================
// Essay grading
// ============================================================

export async function gradeEssay(prompt: EssayPrompt, text: string): Promise<EssayFeedback> {
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
  const raw = await callClaude(system, [{ role: 'user', content: user }])
  if (raw) {
    const parsed = extractJson<EssayFeedback>(raw)
    if (parsed && typeof parsed.scoreOverall === 'number') return parsed
  }
  return heuristicEssayGrade(prompt, text)
}

function heuristicEssayGrade(prompt: EssayPrompt, text: string): EssayFeedback {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const wc = words.length
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0)
  const avgLen = sentences.length ? wc / sentences.length : 0
  const inRange = wc >= prompt.minWords && wc <= prompt.maxWords
  let score = 60
  if (inRange) score += 15
  else if (wc >= prompt.minWords * 0.8) score += 5
  if (sentences.length >= 5) score += 5
  if (avgLen >= 8 && avgLen <= 22) score += 10
  score = Math.max(30, Math.min(95, score))
  return {
    scoreOverall: score,
    scoreContent: score - 5,
    scoreLanguage: score - 8,
    scoreStructure: score - 3,
    strengths: ['完成了写作任务，表达了基本观点。'],
    improvements: [
      inRange
        ? '尝试加入更多衔接词（However, In addition, As a result）让段落更连贯。'
        : `字数应在 ${prompt.minWords}–${prompt.maxWords} 之间，目前为 ${wc}。`,
      '配置 API Key 后可获得 AI 全面批改与范文。',
    ],
    revised: '',
  }
}
