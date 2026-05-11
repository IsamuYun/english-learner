// TTS via the backend /api/tts route (CosyVoice). STT still uses the browser's
// SpeechRecognition. The audio is fetched as a blob (the route requires a
// bearer token, which <audio src> can't carry), played via an HTMLAudioElement,
// and kept in a small in-memory LRU keyed on text+voice. Playback rate is
// applied on the audio element so changing speed never re-hits the model.

import { getAuthToken } from './api'

export interface TTSVoice {
  id: string
  label: string
  lang: string
}

const DEFAULT_VOICE = '台湾女'
const MAX_BLOB_CACHE = 50

const blobCache = new Map<string, string>()
let currentAudio: HTMLAudioElement | null = null

function rememberBlob(key: string, url: string) {
  blobCache.set(key, url)
  while (blobCache.size > MAX_BLOB_CACHE) {
    const oldest = blobCache.keys().next().value
    if (oldest === undefined) break
    const u = blobCache.get(oldest)
    if (u) URL.revokeObjectURL(u)
    blobCache.delete(oldest)
  }
}

function authHeaders(): Record<string, string> {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function fetchAudioUrl(text: string, voice: string): Promise<string | null> {
  const key = `${voice}${text}`
  const cached = blobCache.get(key)
  if (cached) return cached
  const qs = new URLSearchParams({ text, voice })
  const res = await fetch(`/api/tts?${qs.toString()}`, { headers: authHeaders() })
  if (!res.ok) return null
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  rememberBlob(key, url)
  return url
}

export function speak(
  text: string,
  opts: { rate?: number; voiceURI?: string; lang?: string } = {},
): Promise<void> {
  return new Promise((resolve) => {
    const trimmed = text.trim()
    if (!trimmed) {
      resolve()
      return
    }
    stopSpeaking()
    const voice = opts.voiceURI && opts.voiceURI.trim() ? opts.voiceURI : DEFAULT_VOICE
    fetchAudioUrl(trimmed, voice)
      .then((url) => {
        if (!url) {
          resolve()
          return
        }
        const audio = new Audio(url)
        audio.playbackRate = opts.rate ?? 1
        currentAudio = audio
        const finish = () => {
          if (currentAudio === audio) currentAudio = null
          resolve()
        }
        audio.onended = finish
        audio.onerror = finish
        audio.play().catch(finish)
      })
      .catch(() => resolve())
  })
}

export function stopSpeaking() {
  if (currentAudio) {
    try {
      currentAudio.pause()
      currentAudio.currentTime = 0
    } catch {
      /* noop */
    }
    currentAudio = null
  }
}

let voicesCache: TTSVoice[] | null = null
let voicesPromise: Promise<TTSVoice[]> | null = null
const voicesListeners = new Set<() => void>()

function loadVoices(): Promise<TTSVoice[]> {
  if (voicesPromise) return voicesPromise
  voicesPromise = fetch('/api/tts/voices', { headers: authHeaders() })
    .then((r) => (r.ok ? (r.json() as Promise<{ voices: TTSVoice[] }>) : { voices: [] }))
    .then((d) => {
      voicesCache = d.voices ?? []
      for (const l of voicesListeners) l()
      return voicesCache
    })
    .catch(() => {
      voicesCache = []
      return voicesCache
    })
  return voicesPromise
}

export function getVoices(): TTSVoice[] {
  if (voicesCache === null) void loadVoices()
  return voicesCache ?? []
}

export function onVoicesReady(cb: () => void) {
  voicesListeners.add(cb)
  if (voicesCache !== null) cb()
  else void loadVoices()
}

// ---- Speech recognition ----

type SR = {
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: any) => void) | null
  onerror: ((e: any) => void) | null
  onend: (() => void) | null
  continuous: boolean
  interimResults: boolean
  lang: string
}

function getSRCtor(): { new (): SR } | null {
  if (typeof window === 'undefined') return null
  // @ts-ignore
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

export const speechRecognitionAvailable = () => !!getSRCtor()

export interface ListenHandle {
  stop: () => void
}

export function listen(opts: {
  lang?: string
  onPartial?: (t: string) => void
  onFinal: (t: string) => void
  onError?: (e: string) => void
}): ListenHandle | null {
  const Ctor = getSRCtor()
  if (!Ctor) {
    opts.onError?.('SpeechRecognition not supported in this browser. Try Chrome / Edge / Safari.')
    return null
  }
  const r = new Ctor()
  r.lang = opts.lang ?? 'en-US'
  r.continuous = false
  r.interimResults = true
  let finalText = ''
  r.onresult = (e: any) => {
    let partial = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const result = e.results[i]
      const t = result[0].transcript
      if (result.isFinal) finalText += t
      else partial += t
    }
    if (partial) opts.onPartial?.(partial)
  }
  r.onerror = (e: any) => opts.onError?.(e.error || 'recognition-error')
  r.onend = () => {
    if (finalText) opts.onFinal(finalText.trim())
    else opts.onError?.('no-speech')
  }
  try {
    r.start()
  } catch (e) {
    opts.onError?.('start-failed')
    return null
  }
  return { stop: () => r.stop() }
}
