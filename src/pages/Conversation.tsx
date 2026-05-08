import { useEffect, useMemo, useRef, useState } from 'react'
import Card from '../components/Card'
import Icon from '../components/Icon'
import Button from '../components/Button'
import PageHeader from '../components/PageHeader'
import Spinner from '../components/Spinner'
import { CONVERSATION_SCENARIOS } from '../data/conversationScenarios'
import { listen, speak, speechRecognitionAvailable, stopSpeaking } from '../lib/speech'
import { ConversationFeedback, evaluateConversationTurn } from '../lib/ai'
import { settingsStore } from '../lib/storage'

export default function Conversation() {
  const [scenarioId, setScenarioId] = useState(CONVERSATION_SCENARIOS[0].id)
  const scenario = useMemo(
    () => CONVERSATION_SCENARIOS.find((s) => s.id === scenarioId)!,
    [scenarioId],
  )

  const [turnIdx, setTurnIdx] = useState(0)
  const [hintRevealed, setHintRevealed] = useState(false)
  const [userText, setUserText] = useState('')
  const [partial, setPartial] = useState('')
  const [listening, setListening] = useState(false)
  const [evaluating, setEvaluating] = useState(false)
  const [feedback, setFeedback] = useState<ConversationFeedback | null>(null)
  const listenRef = useRef<{ stop: () => void } | null>(null)

  useEffect(() => {
    setTurnIdx(0)
    resetTurn()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioId])

  useEffect(() => {
    return () => {
      stopSpeaking()
      listenRef.current?.stop()
    }
  }, [])

  const turn = scenario.turns[turnIdx]

  function resetTurn() {
    setUserText('')
    setPartial('')
    setHintRevealed(false)
    setFeedback(null)
  }

  const goPrev = () => {
    if (turnIdx > 0) {
      setTurnIdx((i) => i - 1)
      resetTurn()
    }
  }
  const goNext = () => {
    if (turnIdx < scenario.turns.length - 1) {
      setTurnIdx((i) => i + 1)
      resetTurn()
    }
  }

  const speakHint = () => {
    const settings = settingsStore.get()
    speak(turn.hintEn, { rate: settings.rate, voiceURI: settings.voice })
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
        setUserText((prev) => (prev ? prev + ' ' : '') + t)
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
    if (!userText.trim()) return
    setEvaluating(true)
    setFeedback(null)
    try {
      const r = await evaluateConversationTurn(turn.zhPrompt, turn.hintEn, userText.trim())
      setFeedback(r)
    } finally {
      setEvaluating(false)
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Conversation"
        title="口语对话"
        description="按照中文提示用英语说出对应的句子，可使用语音输入。提示按钮在你想偷看时再揭晓。"
      />

      {/* Scenario picker */}
      <Card padded className="space-y-3">
        <div className="text-[12px] uppercase tracking-[0.16em] text-ink-400">情景</div>
        <div className="flex flex-wrap gap-2">
          {CONVERSATION_SCENARIOS.map((s) => (
            <button
              key={s.id}
              onClick={() => setScenarioId(s.id)}
              className={[
                'h-9 px-3 rounded-xl text-[13px] transition-colors',
                s.id === scenarioId
                  ? 'bg-ink-900 text-white'
                  : 'bg-surface-alt text-ink-700 hover:bg-line-soft',
              ].join(' ')}
            >
              W{s.week} · {s.title}
            </button>
          ))}
        </div>
        <div className="pt-2 border-t border-line-soft">
          <div className="text-[12px] uppercase tracking-[0.16em] text-ink-400">情景描述</div>
          <p className="mt-1 text-[14px] text-ink-700 leading-relaxed">{scenario.zhContext}</p>
        </div>
      </Card>

      {/* Progress */}
      <div className="flex items-center gap-1.5">
        {scenario.turns.map((_, i) => (
          <div
            key={i}
            className={[
              'h-1 flex-1 rounded-full transition-colors',
              i < turnIdx ? 'bg-accent' : i === turnIdx ? 'bg-ink-900' : 'bg-line-soft',
            ].join(' ')}
          />
        ))}
      </div>

      {/* Prompt card */}
      <Card padded elevated className="space-y-6">
        <div>
          <div className="text-[12px] uppercase tracking-[0.16em] text-ink-400">
            第 {turnIdx + 1} / {scenario.turns.length} 句 · 中文意思
          </div>
          <p className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight leading-snug text-ink-900">
            {turn.zhPrompt}
          </p>
        </div>

        <div className="rounded-xl2 bg-surface-warm hairline p-5">
          <div className="flex items-center justify-between">
            <div className="text-[12px] uppercase tracking-[0.16em] text-ink-400">参考英文</div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setHintRevealed((v) => !v)}
                className="text-[12px] text-accent hover:underline"
              >
                {hintRevealed ? '收起' : '查看提示'}
              </button>
              <button
                onClick={speakHint}
                className="inline-flex items-center gap-1 text-[12px] text-accent hover:underline"
              >
                <Icon name="speaker" size={14} /> 朗读
              </button>
            </div>
          </div>
          {hintRevealed ? (
            <div className="mt-2 space-y-1">
              <p className="text-[17px] text-ink-900 leading-relaxed">{turn.hintEn}</p>
              {turn.notes && <p className="text-[12.5px] text-ink-500">💡 {turn.notes}</p>}
            </div>
          ) : (
            <p className="mt-2 text-[14px] text-ink-400">先尝试自己开口，再查看提示效果会更好。</p>
          )}
        </div>

        {/* Composer */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[12px] uppercase tracking-[0.16em] text-ink-400">你的英文</div>
            {!listening ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={startListening}
                leading={<Icon name="mic" size={14} />}
              >
                语音输入
              </Button>
            ) : (
              <Button
                size="sm"
                variant="danger"
                onClick={stopListening}
                leading={<Icon name="stop" size={14} />}
              >
                停止
              </Button>
            )}
          </div>
          <div className="relative">
            <textarea
              value={userText}
              onChange={(e) => setUserText(e.target.value)}
              placeholder="输入你的英语回答…"
              className="w-full min-h-[100px] resize-y rounded-xl2 hairline bg-surface p-4 text-[15px] leading-relaxed focus:bg-surface-warm transition-colors"
            />
            {listening && (
              <div className="absolute bottom-3 right-3 flex items-center gap-2 rounded-full bg-bad/10 text-bad px-3 h-8 text-[12px]">
                <span className="w-2 h-2 rounded-full bg-bad animate-pulseDot" />
                聆听中 {partial && `· ${partial}`}
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setUserText('')}
              disabled={!userText}
              leading={<Icon name="cross" size={14} />}
            >
              清空
            </Button>
            <Button
              onClick={handleEvaluate}
              disabled={evaluating || !userText.trim()}
              leading={evaluating ? <Spinner /> : <Icon name="sparkle" size={16} />}
            >
              {evaluating ? '评价中…' : '请 AI 评价'}
            </Button>
          </div>
        </div>

        {feedback && <ConversationFeedbackView fb={feedback} />}
      </Card>

      {/* Nav */}
      <div className="flex items-center justify-between">
        <Button
          variant="secondary"
          onClick={goPrev}
          disabled={turnIdx === 0}
          leading={<Icon name="arrow-left" size={16} />}
        >
          上一句
        </Button>
        <span className="text-[13px] text-ink-500 num">
          {turnIdx + 1} / {scenario.turns.length}
        </span>
        <Button
          onClick={goNext}
          disabled={turnIdx >= scenario.turns.length - 1}
          trailing={<Icon name="arrow-right" size={16} />}
        >
          下一句
        </Button>
      </div>
    </div>
  )
}

function ConversationFeedbackView({ fb }: { fb: ConversationFeedback }) {
  const map = {
    excellent: { label: '出色', cls: 'bg-good/10 text-good' },
    good: { label: '不错', cls: 'bg-accent-soft text-accent' },
    okay: { label: '可改进', cls: 'bg-warn/10 text-warn' },
    'needs-work': { label: '需复习', cls: 'bg-bad/10 text-bad' },
  } as const
  const v = map[fb.verdict]
  return (
    <div className="rounded-xl2 bg-surface-warm hairline p-5 space-y-4 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center px-2.5 h-7 rounded-full text-[12px] ${v.cls}`}>
            {v.label}
          </span>
          <span className="text-[13px] text-ink-500">口语反馈</span>
        </div>
        <div className="text-3xl font-semibold tracking-tight num">
          {fb.score}
          <span className="text-[14px] text-ink-400 ml-0.5">/100</span>
        </div>
      </div>
      {fb.comments.length > 0 && (
        <ul className="space-y-1.5">
          {fb.comments.map((c, i) => (
            <li key={i} className="flex gap-2 text-[14px] text-ink-700">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
              <span className="leading-relaxed">{c}</span>
            </li>
          ))}
        </ul>
      )}
      {fb.better && (
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-ink-400">推荐说法</div>
          <p className="mt-1 text-[15px] text-ink-900 leading-relaxed">{fb.better}</p>
        </div>
      )}
    </div>
  )
}
