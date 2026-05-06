import type {
  AppSettings,
  EssayDraft,
  EssayFeedback,
  FlashcardProgress,
  ReadingResult,
  VocabWord,
} from '../types'

const BASE = ''

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    let detail = ''
    try {
      detail = await res.text()
    } catch {
      /* noop */
    }
    throw new Error(`${res.status} ${res.statusText} ${detail}`.trim())
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

interface RawWord {
  id: number
  word: string
  ipa: string | null
  pos: string | null
  zh: string
  example_en: string | null
  example_zh: string | null
  level: 1 | 2 | 3
  is_phrase: 0 | 1
  tags: string | null
}

export interface WordsListResponse {
  items: RawWord[]
  total: number
  page: number
  pageSize: number
}

export interface WordsListQuery {
  q?: string
  level?: 1 | 2 | 3 | 'all'
  is_phrase?: 0 | 1 | 'all'
  page?: number
  pageSize?: number
}

export function rawToVocab(r: RawWord): VocabWord {
  return {
    id: String(r.id),
    word: r.word,
    ipa: r.ipa ?? '',
    pos: r.pos ?? '',
    zh: r.zh,
    level: r.level,
    example: { en: r.example_en ?? '', zh: r.example_zh ?? '' },
    tags: r.tags ? r.tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
  }
}

function buildQs(q: WordsListQuery): string {
  const params = new URLSearchParams()
  if (q.q) params.set('q', q.q)
  if (q.level !== undefined) params.set('level', String(q.level))
  if (q.is_phrase !== undefined) params.set('is_phrase', String(q.is_phrase))
  if (q.page) params.set('page', String(q.page))
  if (q.pageSize) params.set('pageSize', String(q.pageSize))
  const s = params.toString()
  return s ? `?${s}` : ''
}

export const wordsApi = {
  list: (q: WordsListQuery = {}) =>
    request<WordsListResponse>(`/api/words${buildQs(q)}`),
  raw: rawToVocab,
  create: (data: Partial<RawWord>) =>
    request<RawWord>('/api/words', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<RawWord>) =>
    request<RawWord>(`/api/words/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: number) =>
    request<void>(`/api/words/${id}`, { method: 'DELETE' }),
}

interface RawFlashcard {
  word_id: number
  seen: number
  known: number
  last_reviewed: number
  due: number
  bucket: 0 | 1 | 2 | 3 | 4
}

function rawFlashcardToProgress(r: RawFlashcard): FlashcardProgress {
  return {
    wordId: String(r.word_id),
    seen: r.seen,
    known: r.known,
    lastReviewed: r.last_reviewed,
    due: r.due,
    bucket: r.bucket,
  }
}

export const flashcardsApi = {
  all: async (): Promise<Record<string, FlashcardProgress>> => {
    const raw = await request<Record<string, RawFlashcard>>('/api/flashcards')
    const out: Record<string, FlashcardProgress> = {}
    for (const k of Object.keys(raw)) out[k] = rawFlashcardToProgress(raw[k])
    return out
  },
  put: (wordId: string, patch: Partial<FlashcardProgress>) => {
    const body: Record<string, unknown> = {}
    if (patch.seen !== undefined) body.seen = patch.seen
    if (patch.known !== undefined) body.known = patch.known
    if (patch.lastReviewed !== undefined) body.last_reviewed = patch.lastReviewed
    if (patch.due !== undefined) body.due = patch.due
    if (patch.bucket !== undefined) body.bucket = patch.bucket
    return request<RawFlashcard>(`/api/flashcards/${encodeURIComponent(wordId)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    })
  },
}

interface RawReading {
  id: number
  passage_id: string
  taken_at: number
  correct: number
  total: number
  answers: number[]
}

export const readingApi = {
  list: async (): Promise<ReadingResult[]> => {
    const rows = await request<RawReading[]>('/api/reading-results')
    return rows.map((r) => ({
      passageId: r.passage_id,
      takenAt: r.taken_at,
      correct: r.correct,
      total: r.total,
      answers: r.answers,
    }))
  },
  add: (r: ReadingResult) =>
    request<{ ok: true }>('/api/reading-results', {
      method: 'POST',
      body: JSON.stringify({
        passage_id: r.passageId,
        taken_at: r.takenAt,
        correct: r.correct,
        total: r.total,
        answers: r.answers,
      }),
    }),
}

interface RawEssay {
  week: number
  text: string
  updatedAt: number
  feedback?: EssayFeedback
}

export const essaysApi = {
  all: async (): Promise<Record<number, EssayDraft>> => {
    const raw = await request<Record<string, RawEssay>>('/api/essays')
    const out: Record<number, EssayDraft> = {}
    for (const k of Object.keys(raw)) {
      const v = raw[k]
      out[v.week] = { week: v.week, text: v.text, updatedAt: v.updatedAt, feedback: v.feedback }
    }
    return out
  },
  put: (draft: EssayDraft) =>
    request<RawEssay>(`/api/essays/${draft.week}`, {
      method: 'PUT',
      body: JSON.stringify({ text: draft.text, feedback: draft.feedback }),
    }),
}

export const settingsApi = {
  get: () => request<Partial<AppSettings>>('/api/settings'),
  put: (s: Partial<AppSettings>) =>
    request<Partial<AppSettings>>('/api/settings', { method: 'PUT', body: JSON.stringify(s) }),
}
