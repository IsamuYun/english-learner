// Web Speech API helpers — TTS (SpeechSynthesis) + STT (SpeechRecognition).
// All calls are best-effort: if the browser doesn't support a feature, we fail gracefully.

export function speak(
  text: string,
  opts: { rate?: number; voiceURI?: string; lang?: string } = {},
): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve()
      return
    }
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = opts.lang ?? 'en-US'
    u.rate = opts.rate ?? 0.95
    u.pitch = 1
    if (opts.voiceURI) {
      const v = window.speechSynthesis.getVoices().find((x) => x.voiceURI === opts.voiceURI)
      if (v) u.voice = v
    }
    u.onend = () => resolve()
    u.onerror = () => resolve()
    window.speechSynthesis.speak(u)
  })
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
}

export function getVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return []
  return window.speechSynthesis.getVoices().filter((v) => /^en|zh/i.test(v.lang))
}

export function onVoicesReady(cb: () => void) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  window.speechSynthesis.onvoiceschanged = cb
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
