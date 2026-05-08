import { useEffect, useMemo, useState } from 'react'
import Card from '../components/Card'
import Icon from '../components/Icon'
import Button from '../components/Button'
import PageHeader from '../components/PageHeader'
import Spinner from '../components/Spinner'
import { ESSAY_PROMPTS } from '../data/essayPrompts'
import { gradeEssay } from '../lib/ai'
import { essayStore } from '../lib/storage'
import type { EssayDraft, EssayFeedback } from '../types'

export default function Essay() {
  const [week, setWeek] = useState<number>(() => {
    const all = essayStore.all()
    const written = Object.keys(all).map(Number)
    if (written.length === 0) return 1
    return Math.min(Math.max(...written) + 1, ESSAY_PROMPTS.length)
  })
  const prompt = useMemo(() => ESSAY_PROMPTS.find((p) => p.week === week)!, [week])
  const [text, setText] = useState('')
  const [feedback, setFeedback] = useState<EssayFeedback | undefined>()
  const [grading, setGrading] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  useEffect(() => {
    const draft = essayStore.get(week)
    setText(draft?.text ?? '')
    setFeedback(draft?.feedback)
    setSavedAt(draft?.updatedAt ?? null)
  }, [week])

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length

  const persist = (next: EssayDraft) => {
    essayStore.upsert(next)
    setSavedAt(next.updatedAt)
  }

  const handleSave = () => {
    const next: EssayDraft = {
      week,
      text,
      updatedAt: Date.now(),
      feedback,
    }
    persist(next)
  }

  const handleGrade = async () => {
    if (!text.trim()) return
    setGrading(true)
    try {
      const fb = await gradeEssay(prompt, text.trim())
      setFeedback(fb)
      persist({ week, text, updatedAt: Date.now(), feedback: fb })
    } finally {
      setGrading(false)
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Weekly Essay"
        title="每周作文"
        description="12 周循序渐进。每周一题，写完后请 AI 在内容、语言、结构三个维度打分，并给出改写范文。"
      />

      {/* Week selector */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {ESSAY_PROMPTS.map((p) => {
          const written = !!essayStore.get(p.week)
          const active = p.week === week
          return (
            <button
              key={p.week}
              onClick={() => setWeek(p.week)}
              className={[
                'shrink-0 h-12 px-3.5 rounded-xl text-left transition-colors flex flex-col items-start',
                active
                  ? 'bg-ink-900 text-white'
                  : written
                    ? 'bg-accent-soft text-accent'
                    : 'bg-surface-alt text-ink-500 hover:bg-line-soft',
              ].join(' ')}
            >
              <span className="text-[10.5px] uppercase tracking-[0.14em] opacity-70">
                Week {p.week}
              </span>
              <span className="text-[12.5px] font-medium leading-tight max-w-[10rem] truncate">
                {p.title}
              </span>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-6">
        {/* Prompt */}
        <Card padded className="space-y-5 self-start lg:sticky lg:top-20">
          <div>
            <div className="text-[11.5px] uppercase tracking-[0.16em] text-accent">
              Week {prompt.week}
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">{prompt.title}</h2>
          </div>

          <div className="space-y-2">
            <p className="text-[14.5px] text-ink-900 leading-relaxed">{prompt.zhBrief}</p>
            <p className="text-[13.5px] text-ink-500 leading-relaxed italic">
              {prompt.enBrief}
            </p>
          </div>

          <div className="rounded-xl bg-surface-warm hairline p-4 space-y-2">
            <div className="text-[11.5px] uppercase tracking-[0.16em] text-ink-400">写作要点</div>
            <ul className="space-y-1.5">
              {prompt.rubric.map((r, i) => (
                <li key={i} className="flex gap-2 text-[13px] text-ink-700">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-ink-300 shrink-0" />
                  {r}
                </li>
              ))}
            </ul>
          </div>

          <div className="text-[12px] text-ink-500 num">
            建议字数 {prompt.minWords}–{prompt.maxWords}
          </div>
        </Card>

        {/* Editor + feedback */}
        <div className="space-y-4">
          <Card padded>
            <div className="flex items-center justify-between mb-3">
              <div className="text-[12px] uppercase tracking-[0.16em] text-ink-400">
                我的作文
              </div>
              <div className="text-[12px] text-ink-500 num">
                {wordCount} 词 ·{' '}
                <span
                  className={
                    wordCount >= prompt.minWords && wordCount <= prompt.maxWords
                      ? 'text-good'
                      : wordCount === 0
                        ? 'text-ink-400'
                        : 'text-warn'
                  }
                >
                  {wordCount === 0
                    ? '未开始'
                    : wordCount < prompt.minWords
                      ? `还差 ${prompt.minWords - wordCount}`
                      : wordCount > prompt.maxWords
                        ? `超出 ${wordCount - prompt.maxWords}`
                        : '在范围内'}
                </span>
              </div>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Start writing in English…"
              className="w-full min-h-[420px] resize-y rounded-xl2 hairline bg-surface-warm p-4 text-[15px] leading-[1.85] focus:bg-surface transition-colors"
            />
            <div className="mt-3 flex items-center justify-between">
              <div className="text-[11.5px] text-ink-400">
                {savedAt
                  ? `已保存 · ${new Date(savedAt).toLocaleString()}`
                  : '尚未保存'}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={handleSave} disabled={!text.trim()}>
                  保存草稿
                </Button>
                <Button
                  onClick={handleGrade}
                  disabled={grading || !text.trim()}
                  leading={grading ? <Spinner /> : <Icon name="sparkle" size={16} />}
                >
                  {grading ? '批改中…' : '请 AI 批改'}
                </Button>
              </div>
            </div>
          </Card>

          {feedback && <FeedbackView fb={feedback} />}
        </div>
      </div>
    </div>
  )
}

function FeedbackView({ fb }: { fb: EssayFeedback }) {
  return (
    <Card padded className="space-y-5 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11.5px] uppercase tracking-[0.16em] text-ink-400">总评</div>
          <div className="mt-1 text-4xl font-semibold tracking-tight num">
            {fb.scoreOverall}
            <span className="text-[14px] text-ink-400 ml-1">/100</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <SubScore label="内容" v={fb.scoreContent} />
          <SubScore label="语言" v={fb.scoreLanguage} />
          <SubScore label="结构" v={fb.scoreStructure} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl2 bg-good/5 p-4 space-y-2">
          <div className="text-[12px] uppercase tracking-[0.14em] text-good">亮点</div>
          <ul className="space-y-1.5">
            {fb.strengths.map((s, i) => (
              <li key={i} className="flex gap-2 text-[13.5px] text-ink-900">
                <Icon name="check" size={16} className="mt-0.5 text-good" />
                <span className="leading-relaxed">{s}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl2 bg-warn/5 p-4 space-y-2">
          <div className="text-[12px] uppercase tracking-[0.14em] text-warn">建议</div>
          <ul className="space-y-1.5">
            {fb.improvements.map((s, i) => (
              <li key={i} className="flex gap-2 text-[13.5px] text-ink-900">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-warn shrink-0" />
                <span className="leading-relaxed">{s}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {fb.revised && (
        <div className="rounded-xl2 hairline p-4 bg-surface-warm">
          <div className="text-[11.5px] uppercase tracking-[0.16em] text-ink-400">范文参考</div>
          <p className="mt-2 text-[14.5px] text-ink-900 leading-[1.85] whitespace-pre-wrap">
            {fb.revised}
          </p>
        </div>
      )}
    </Card>
  )
}

function SubScore({ label, v }: { label: string; v: number }) {
  return (
    <div className="px-3 py-2 rounded-xl bg-surface-alt min-w-[78px]">
      <div className="text-[11px] text-ink-500">{label}</div>
      <div className="text-xl font-semibold tracking-tight num">{v}</div>
    </div>
  )
}
