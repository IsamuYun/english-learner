import type {
  AppSettings,
  EssayDraft,
  FlashcardProgress,
  ReadingResult,
} from '../types'
import { essaysApi, flashcardsApi, readingApi, settingsApi } from './api'

export const defaultSettings: AppSettings = {
  voice: '台湾女',
  rate: 0.95,
}

const listeners = new Set<() => void>()
function notify() {
  for (const l of listeners) l()
  // window 'storage' event preserved for backward compatibility w/ existing pages
  try {
    window.dispatchEvent(new StorageEvent('storage'))
  } catch {
    /* noop */
  }
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// ---------- settings ----------
let settingsCache: AppSettings = { ...defaultSettings }

export const settingsStore = {
  get: (): AppSettings => settingsCache,
  set: (s: AppSettings): void => {
    settingsCache = s
    void settingsApi.put(s).catch(console.error)
    notify()
  },
}

// ---------- flashcards ----------
let flashcardCache: Record<string, FlashcardProgress> = {}

export const flashcardStore = {
  get: (): Record<string, FlashcardProgress> => flashcardCache,
  set: (m: Record<string, FlashcardProgress>): void => {
    flashcardCache = m
    notify()
  },
  update: (id: string, patch: Partial<FlashcardProgress>): FlashcardProgress => {
    const cur = flashcardCache[id]
    const base: FlashcardProgress = {
      wordId: id,
      seen: 0,
      known: 0,
      lastReviewed: 0,
      due: 0,
      bucket: 0,
    }
    const next = { ...base, ...cur, ...patch }
    flashcardCache = { ...flashcardCache, [id]: next }
    void flashcardsApi.put(id, patch).catch(console.error)
    notify()
    return next
  },
}

// ---------- reading ----------
let readingCache: ReadingResult[] = []

export const readingStore = {
  list: (): ReadingResult[] => readingCache,
  add: (r: ReadingResult): void => {
    readingCache = [r, ...readingCache].slice(0, 100)
    void readingApi.add(r).catch(console.error)
    notify()
  },
}

// ---------- essays ----------
let essayCache: Record<number, EssayDraft> = {}

export const essayStore = {
  all: (): Record<number, EssayDraft> => essayCache,
  upsert: (d: EssayDraft): void => {
    essayCache = { ...essayCache, [d.week]: d }
    void essaysApi.put(d).catch(console.error)
    notify()
  },
  get: (week: number): EssayDraft | undefined => essayCache[week],
}

// ---------- hydration ----------
export function resetCaches(): void {
  settingsCache = { ...defaultSettings }
  flashcardCache = {}
  readingCache = []
  essayCache = {}
  notify()
}

export async function hydrate(): Promise<void> {
  try {
    const [s, fc, re, es] = await Promise.all([
      settingsApi.get().catch(() => ({})),
      flashcardsApi.all().catch(() => ({})),
      readingApi.list().catch(() => []),
      essaysApi.all().catch(() => ({})),
    ])
    const merged = { ...defaultSettings, ...(s as Partial<AppSettings>) }
    if (!merged.voice) merged.voice = defaultSettings.voice
    settingsCache = merged
    flashcardCache = fc
    readingCache = re
    essayCache = es
    notify()
  } catch (e) {
    console.error('hydrate failed', e)
  }
}
