import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import Card from '../components/Card'
import Icon from '../components/Icon'
import { ESSAY_PROMPTS } from '../data/essayPrompts'
import { READING_PASSAGES } from '../data/readingPassages'
import { CONVERSATION_SCENARIOS } from '../data/conversationScenarios'
import { essayStore, flashcardStore, readingStore, settingsStore, subscribe } from '../lib/storage'
import { useWords } from '../lib/useWords'

interface ModuleCard {
  to: string
  title: string
  caption: string
  body: string
  icon: 'flashcard' | 'chat' | 'book' | 'pen'
  accent: string
}

const MODULES: ModuleCard[] = [
  {
    to: '/flashcards',
    title: '单词卡',
    caption: 'Flashcards',
    body: '高考核心词汇，配有发音、例句、语音造句与 AI 评价。',
    icon: 'flashcard',
    accent: 'from-[#0071e3] to-[#3aa0ff]',
  },
  {
    to: '/conversation',
    title: '口语对话',
    caption: 'Conversation',
    body: '中文情景提示，分步说出英语，AI 实时给出改进建议。',
    icon: 'chat',
    accent: 'from-[#34c759] to-[#5fdb87]',
  },
  {
    to: '/reading',
    title: '阅读理解',
    caption: 'Reading',
    body: '短文 + 选择题，自动批改，分析错因。',
    icon: 'book',
    accent: 'from-[#ff9500] to-[#ffb84d]',
  },
  {
    to: '/essay',
    title: '每周作文',
    caption: 'Weekly Essay',
    body: '12 周循序渐进的作文计划，AI 评分与优化范文。',
    icon: 'pen',
    accent: 'from-[#af52de] to-[#cf86eb]',
  },
]

export default function Home() {
  const [, force] = useState(0)
  useEffect(() => subscribe(() => force((v) => v + 1)), [])

  const { total: vocabTotal, words: previewWords } = useWords({ pageSize: 50 })

  const stats = useMemo(() => {
    const fc = flashcardStore.get()
    const knownCount = Object.values(fc).filter((p) => p.bucket >= 3).length
    const reading = readingStore.list()
    const recent = reading.slice(0, 5)
    const accuracy =
      recent.length > 0
        ? Math.round(
            (recent.reduce((s, r) => s + r.correct, 0) /
              recent.reduce((s, r) => s + r.total, 0)) *
              100,
          )
        : null
    const essays = essayStore.all()
    const essaysCount = Object.keys(essays).length
    return { knownCount, accuracy, essaysCount }
  }, [])

  const settings = settingsStore.get()
  const apiReady = !!settings.apiKey
  const todayWord = previewWords.length
    ? previewWords[new Date().getDate() % previewWords.length]
    : null

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="pt-2 md:pt-4">
        <div className="text-[12px] uppercase tracking-[0.18em] text-accent font-medium">
          Shanghai Gaokao · English Companion
        </div>
        <h1 className="mt-3 text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05] text-ink-900">
          慢一点，<br className="hidden md:block" />
          把英语学得 <span className="text-accent">更踏实</span>。
        </h1>
        <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-ink-500">
          为上海高三学生量身打造的英语练习空间。单词、口语、阅读、作文，四个模块循序渐进，
          每一步都有发音、范例与 AI 反馈陪伴。
        </p>
        <div className="mt-8 flex items-center gap-3">
          <Link
            to="/flashcards"
            className="inline-flex items-center gap-1.5 h-11 px-5 rounded-xl2 bg-ink-900 text-white text-[14px] font-medium hover:bg-ink-700 transition-colors"
          >
            开始今天的练习
            <Icon name="arrow-right" size={16} />
          </Link>
          <Link
            to="/settings"
            className="inline-flex items-center gap-1.5 h-11 px-5 rounded-xl2 hairline bg-surface text-[14px] text-ink-700 hover:bg-surface-alt transition-colors"
          >
            {apiReady ? 'AI 已就绪' : '配置 AI 评价'}
            <Icon name="chevron-right" size={16} />
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="掌握的单词"
          value={stats.knownCount}
          unit={`/ ${vocabTotal}`}
          hint="单词卡中标记为「认识」的累计数量"
        />
        <StatCard
          label="近 5 次阅读正确率"
          value={stats.accuracy ?? '—'}
          unit={stats.accuracy !== null ? '%' : ''}
          hint="完成更多阅读以建立稳定数据"
        />
        <StatCard
          label="作文已写"
          value={stats.essaysCount}
          unit={`/ ${ESSAY_PROMPTS.length} 周`}
          hint="保持每周一篇的节奏"
        />
      </section>

      {/* Modules */}
      <section>
        <h2 className="text-[15px] font-medium text-ink-500 mb-4">学习模块</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {MODULES.map((m) => (
            <Link
              key={m.to}
              to={m.to}
              className="group relative overflow-hidden rounded-3xl2 hairline bg-surface p-7 transition-all duration-300 ease-apple hover:shadow-card hover:-translate-y-0.5"
            >
              <div
                aria-hidden
                className={`absolute -top-12 -right-12 w-44 h-44 rounded-full bg-gradient-to-br ${m.accent} opacity-[0.18] blur-2xl transition-opacity duration-300 group-hover:opacity-30`}
              />
              <div className="relative flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-surface-alt flex items-center justify-center text-ink-700 group-hover:bg-accent-soft group-hover:text-accent transition-colors">
                  <Icon name={m.icon} size={22} />
                </div>
                <div className="flex-1">
                  <div className="text-[11.5px] uppercase tracking-[0.16em] text-ink-400">
                    {m.caption}
                  </div>
                  <div className="mt-1 text-xl font-semibold tracking-tight">{m.title}</div>
                  <p className="mt-2 text-[14px] text-ink-500 leading-relaxed">{m.body}</p>
                </div>
                <div className="text-ink-300 group-hover:text-accent transition-colors">
                  <Icon name="chevron-right" size={20} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Today's snippet */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card padded>
          <div className="text-[12px] uppercase tracking-[0.14em] text-ink-400">今日推荐</div>
          {todayWord ? (
            <>
              <div className="mt-2 text-2xl font-semibold tracking-tight">{todayWord.word}</div>
              <div className="mt-1 text-[13px] text-ink-500 num">
                {todayWord.ipa || '—'} · {todayWord.zh}
              </div>
            </>
          ) : (
            <div className="mt-2 text-[13px] text-ink-400">载入中…</div>
          )}
          <Link
            to="/flashcards"
            className="mt-4 inline-flex items-center gap-1 text-[13px] text-accent hover:underline"
          >
            打开单词卡
            <Icon name="arrow-right" size={14} />
          </Link>
        </Card>

        <Card padded>
          <div className="text-[12px] uppercase tracking-[0.14em] text-ink-400">本周话题</div>
          <div className="mt-2 text-xl font-semibold tracking-tight">
            {CONVERSATION_SCENARIOS[new Date().getDay() % CONVERSATION_SCENARIOS.length].title}
          </div>
          <div className="mt-1 text-[13px] text-ink-500 leading-relaxed">
            {CONVERSATION_SCENARIOS[new Date().getDay() % CONVERSATION_SCENARIOS.length].zhContext}
          </div>
          <Link
            to="/conversation"
            className="mt-4 inline-flex items-center gap-1 text-[13px] text-accent hover:underline"
          >
            进入口语练习
            <Icon name="arrow-right" size={14} />
          </Link>
        </Card>

        <Card padded>
          <div className="text-[12px] uppercase tracking-[0.14em] text-ink-400">推荐阅读</div>
          <div className="mt-2 text-xl font-semibold tracking-tight">
            {READING_PASSAGES[0].title}
          </div>
          <div className="mt-1 text-[13px] text-ink-500">
            难度 · L{READING_PASSAGES[0].level}
          </div>
          <Link
            to="/reading"
            className="mt-4 inline-flex items-center gap-1 text-[13px] text-accent hover:underline"
          >
            开始阅读
            <Icon name="arrow-right" size={14} />
          </Link>
        </Card>
      </section>
    </div>
  )
}

function StatCard({
  label,
  value,
  unit,
  hint,
}: {
  label: string
  value: number | string
  unit?: string
  hint?: string
}) {
  return (
    <Card padded className="flex flex-col">
      <div className="text-[13px] text-ink-500">{label}</div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-4xl font-semibold tracking-tight num text-ink-900">{value}</span>
        {unit && <span className="text-[14px] text-ink-400 num">{unit}</span>}
      </div>
      {hint && <div className="mt-2 text-[12px] text-ink-400">{hint}</div>}
    </Card>
  )
}
