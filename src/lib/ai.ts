// Thin client for AI features. Calls go through `/api/ai/*` on our backend,
// which proxies to Google Gemini using a project-level API key from
// `server/.env`. The browser never holds the key.
//
// On any non-2xx (including 503 "ai-not-configured") or network failure we
// fall back to the local heuristic so the app stays usable offline.

import type {
  EssayFeedback,
  EssayPrompt,
  SentenceEvaluation,
  VocabWord,
} from '../types'
import { aiApi } from './api'

// ============================================================
// Status (cached for the app session)
// ============================================================

let statusCache: Promise<boolean> | null = null

export function getAiEnabled(): Promise<boolean> {
  if (!statusCache) {
    statusCache = aiApi
      .status()
      .then((r) => r.enabled)
      .catch(() => false)
  }
  return statusCache
}

export function clearAiStatusCache(): void {
  statusCache = null
}

// ============================================================
// Sentence evaluation for Flashcards
// ============================================================

export async function evaluateSentence(
  word: VocabWord,
  sentence: string,
): Promise<SentenceEvaluation> {
  try {
    const r = (await aiApi.sentence({
      word: { word: word.word, pos: word.pos, zh: word.zh },
      sentence,
    })) as SentenceEvaluation
    if (r && typeof r.score === 'number') return r
  } catch {
    /* fall through to heuristic */
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
  try {
    const r = (await aiApi.conversation({ zhPrompt, hintEn, userEn })) as ConversationFeedback
    if (r && typeof r.score === 'number') return r
  } catch {
    /* fall through */
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
  try {
    const r = await aiApi.reading({ passageBody, question, studentChoice, correctAnswer })
    return r.explanation ?? null
  } catch {
    return null
  }
}

// ============================================================
// Essay grading
// ============================================================

export async function gradeEssay(prompt: EssayPrompt, text: string): Promise<EssayFeedback> {
  try {
    const r = (await aiApi.essay({
      prompt: {
        week: prompt.week,
        title: prompt.title,
        enBrief: prompt.enBrief,
        minWords: prompt.minWords,
        maxWords: prompt.maxWords,
      },
      text,
    })) as EssayFeedback
    if (r && typeof r.scoreOverall === 'number') return r
  } catch {
    /* fall through */
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
      'AI 暂未启用，配置好服务端 GEMINI_API_KEY 后可获得全面批改与范文。',
    ],
    revised: '',
  }
}
