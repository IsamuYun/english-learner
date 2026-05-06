import { useEffect, useRef, useState } from 'react'
import Card from '../components/Card'
import Icon from '../components/Icon'
import Button from '../components/Button'
import PageHeader from '../components/PageHeader'
import Spinner from '../components/Spinner'
import { useWords } from '../lib/useWords'
import { listen, speak, speechRecognitionAvailable, stopSpeaking } from '../lib/speech'
import { evaluateSentence } from '../lib/claude'
import { flashcardStore, settingsStore } from '../lib/storage'
import type { SentenceEvaluation } from '../types'

const LEVEL_OPTIONS: { value: 'all' | 1 | 2 | 3; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 1, label: 'L1 基础' },
  { value: 2, label: 'L2 进阶' },
  { value: 3, label: 'L3 高阶' },
]

export default function Flashcards() {
  const [level, setLevel] = useState<'all' | 1 | 2 | 3>('all')
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [sentence, setSentence] = useState('')
  const [evaluating, setEvaluating] = useState(false)
  const [evaluation, setEvaluation] = useState<SentenceEvaluation | null>(null)
  const [listening, setListening] = useState(false)
  const [partial, setPartial] = useState('')
  const listenRef = useRef<{ stop: () => void } | null>(null)

  const { words: pool, loading } = useWords(
    { level: level === 'all' ? 'all' : level, pageSize: 500 },
    [level],
  )

  const word = pool[Math.min(index, Math.max(pool.length - 1, 0))]

  useEffect(() => {
    setIndex(0)
    setFlipped(false)
    setSentence('')
    setEvaluation(null)
  }, [level])

  useEffect(() => {
    return () => {
      stopSpeaking()
      listenRef.current?.stop()
    }
  }, [])

  if (loading && pool.length === 0) {
    return (
      <div className="py-20 flex items-center justify-center text-ink-400">
        <Spinner /> <span className="ml-2 text-[13px]">载入词汇中…</span>
      </div>
    )
  }
  if (!word) {
    return (
      <div className="py-20 text-center text-ink-500 text-[14px]">
        当前等级下没有词条，去 <a className="text-accent" href="/manage">词条管理</a> 添加吧。
      </div>
    )
  }

  const total = pool.length
  const seenWord = flashcardStore.get()[word.id]

  const handleSpeak = () => {
    const settings = settingsStore.get()
    speak(word.word, { rate: settings.rate, voiceURI: settings.voice })
  }

  const handleSpeakExample = () => {
    const settings = settingsStore.get()
    speak(word.example.en, { rate: settings.rate, voiceURI: settings.voice })
  }

  const goNext = () => {
    setFlipped(false)
    setSentence('')
    setEvaluation(null)
    setPartial('')
    setIndex((i) => (i + 1) % total)
  }

  const goPrev = () => {
    setFlipped(false)
    setSentence('')
    setEvaluation(null)
    setPartial('')
    setIndex((i) => (i - 1 + total) % total)
  }

  const markKnown = () => {
    const cur = flashcardStore.update(word.id, {
      seen: (seenWord?.seen ?? 0) + 1,
      known: (seenWord?.known ?? 0) + 1,
      lastReviewed: Date.now(),
    })
    const next = Math.min(4, ((cur.bucket ?? 0) + 1) as any) as 0 | 1 | 2 | 3 | 4
    flashcardStore.update(word.id, { bucket: next })
    goNext()
  }

  const markUnsure = () => {
    flashcardStore.update(word.id, {
      seen: (seenWord?.seen ?? 0) + 1,
      lastReviewed: Date.now(),
      bucket: 0,
    })
    goNext()
  }

  const startListening = () => {
    if (!speechRecognitionAvailable()) {
      alert('当前浏览器不支持语音识别，请使用 Chrome / Edge / Safari。')
      return
    }
    setListening(true)
    setPartial('')
    listenRef.current = listen({
      lang: 'en-US',
      onPartial: (t) => setPartial(t),
      onFinal: (t) => {
        setSentence((prev) => (prev ? prev + ' ' : '') + t)
        setListening(false)
        setPartial('')
      },
      onError: () => {
        setListening(false)
        setPartial('')
      },
    })
  }

  const stopListening = () => {
    listenRef.current?.stop()
    setListening(false)
  }

  const handleEvaluate = async () => {
    if (!sentence.trim()) return
    setEvaluating(true)
    setEvaluation(null)
    try {
      const res = await evaluateSentence(word, sentence.trim())
      setEvaluation(res)
    } finally {
      setEvaluating(false)
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Flashcards"
        title="单词卡"
        description="点击卡片翻面查看释义与例句，听发音后用目标词造句，AI 会给出反馈。"
        actions={
          <div className="hairline rounded-xl bg-surface p-1 flex">
            {LEVEL_OPTIONS.map((o) => (
              <button
                key={String(o.value)}
                onClick={() => setLevel(o.value)}
                className={[
                  'px-3 h-8 rounded-lg text-[13px] transition-colors',
                  level === o.value ? 'bg-ink-900 text-white' : 'text-ink-500 hover:text-ink-900',
                ].join(' ')}
              >
                {o.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="flex items-center justify-between text-[13px] text-ink-500">
        <span className="num">
          {index + 1} / {total}
        </span>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            L{word.level}
          </span>
          <span>{word.pos}</span>
        </div>
      </div>

      {/* Card */}
      <div
        onClick={() => setFlipped((f) => !f)}
        className="relative rounded-3xl2 hairline bg-surface min-h-[280px] md:min-h-[340px] cursor-pointer transition-all duration-300 ease-apple hover:shadow-card animate-flipIn"
      >
        <div className="absolute top-5 right-5 text-[11px] uppercase tracking-[0.16em] text-ink-300">
          tap card to flip
        </div>
        {!flipped ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-10 md:p-14">
            <div className="text-[12px] uppercase tracking-[0.16em] text-ink-400">{word.pos}</div>
            <div className="mt-3 text-5xl md:text-7xl font-semibold tracking-tight text-ink-900">
              {word.word}
            </div>
            <div className="mt-3 text-[15px] text-ink-500 num">{word.ipa}</div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleSpeak()
              }}
              className="mt-6 inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-accent-soft text-accent hover:bg-accent hover:text-white transition-colors"
            >
              <Icon name="speaker" size={16} /> 听发音
            </button>
          </div>
        ) : (
          <div className="p-8 md:p-10 space-y-6">
            <div>
              <div className="text-[12px] uppercase tracking-[0.16em] text-ink-400">释义</div>
              <div className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight">
                {word.zh}
              </div>
            </div>
            <div className="border-t border-line-soft pt-5">
              <div className="flex items-center justify-between">
                <div className="text-[12px] uppercase tracking-[0.16em] text-ink-400">例句</div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSpeakExample()
                  }}
                  className="inline-flex items-center gap-1 text-[12px] text-accent hover:underline"
                >
                  <Icon name="speaker" size={14} /> 朗读
                </button>
              </div>
              <p className="mt-2 text-[18px] leading-relaxed text-ink-900">
                {word.example.en}
              </p>
              <p className="mt-1 text-[14px] text-ink-500 leading-relaxed">{word.example.zh}</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-3">
        <Button variant="secondary" onClick={goPrev} leading={<Icon name="arrow-left" size={16} />}>
          上一张
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={(e) => {
              e.preventDefault()
              markUnsure()
            }}
            leading={<Icon name="refresh" size={16} />}
          >
            还需复习
          </Button>
          <Button
            variant="primary"
            onClick={markKnown}
            leading={<Icon name="check" size={16} />}
          >
            已掌握
          </Button>
        </div>
        <Button variant="secondary" onClick={goNext} trailing={<Icon name="arrow-right" size={16} />}>
          下一张
        </Button>
      </div>

      {/* Practice composer */}
      <Card padded className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[12px] uppercase tracking-[0.16em] text-accent">用 it 造一句</div>
            <h3 className="mt-1 text-lg font-semibold tracking-tight">
              用 “{word.word}” 写一个英文句子
            </h3>
            <p className="text-[13px] text-ink-500 mt-1">
              你可以输入文字，也可以点麦克风用口语输入。完成后点击「请 AI 评价」。
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!listening ? (
              <Button
                variant="secondary"
                onClick={startListening}
                leading={<Icon name="mic" size={16} />}
              >
                语音输入
              </Button>
            ) : (
              <Button
                variant="danger"
                onClick={stopListening}
                leading={<Icon name="stop" size={16} />}
              >
                停止录音
              </Button>
            )}
          </div>
        </div>

        <div className="relative">
          <textarea
            value={sentence}
            onChange={(e) => setSentence(e.target.value)}
            placeholder={`e.g. ${word.example.en}`}
            className="w-full min-h-[120px] resize-y rounded-xl2 hairline bg-surface-warm p-4 text-[15px] leading-relaxed placeholder:text-ink-300 focus:bg-surface transition-colors"
          />
          {listening && (
            <div className="absolute bottom-3 right-3 flex items-center gap-2 rounded-full bg-bad/10 text-bad px-3 h-8 text-[12px]">
              <span className="w-2 h-2 rounded-full bg-bad animate-pulseDot" />
              正在聆听 {partial && `· ${partial}`}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="text-[12px] text-ink-400 num">
            {sentence.trim().split(/\s+/).filter(Boolean).length} 词
          </div>
          <Button
            onClick={handleEvaluate}
            disabled={evaluating || !sentence.trim()}
            leading={evaluating ? <Spinner /> : <Icon name="sparkle" size={16} />}
          >
            {evaluating ? '评价中…' : '请 AI 评价'}
          </Button>
        </div>

        {evaluation && <EvaluationView ev={evaluation} />}
      </Card>
    </div>
  )
}

function EvaluationView({ ev }: { ev: SentenceEvaluation }) {
  const verdictMap: Record<SentenceEvaluation['verdict'], { label: string; cls: string }> = {
    excellent: { label: '出色', cls: 'bg-good/10 text-good' },
    good: { label: '不错', cls: 'bg-accent-soft text-accent' },
    okay: { label: '可改进', cls: 'bg-warn/10 text-warn' },
    'needs-work': { label: '需复习', cls: 'bg-bad/10 text-bad' },
  }
  const v = verdictMap[ev.verdict]
  return (
    <div className="rounded-xl2 bg-surface-warm hairline p-5 space-y-4 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center px-2.5 h-7 rounded-full text-[12px] ${v.cls}`}>
            {v.label}
          </span>
          <span className="text-[13px] text-ink-500">AI 评分</span>
        </div>
        <div className="text-3xl font-semibold tracking-tight num">
          {ev.score}
          <span className="text-[14px] text-ink-400 ml-0.5">/100</span>
        </div>
      </div>

      {ev.comments?.length > 0 && (
        <ul className="space-y-1.5">
          {ev.comments.map((c, i) => (
            <li key={i} className="flex gap-2 text-[14px] text-ink-700">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
              <span className="leading-relaxed">{c}</span>
            </li>
          ))}
        </ul>
      )}

      {ev.corrections && ev.corrections.trim() && (
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-ink-400">建议修订</div>
          <p className="mt-1 text-[14px] text-ink-900">{ev.corrections}</p>
        </div>
      )}

      {ev.natural && ev.natural.trim() && (
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-ink-400">更地道的表达</div>
          <p className="mt-1 text-[14px] text-ink-900">{ev.natural}</p>
        </div>
      )}
    </div>
  )
}
