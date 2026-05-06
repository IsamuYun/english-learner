import { useEffect, useMemo, useState } from 'react'
import Card from '../components/Card'
import Icon from '../components/Icon'
import Button from '../components/Button'
import PageHeader from '../components/PageHeader'
import Spinner from '../components/Spinner'
import { READING_PASSAGES } from '../data/readingPassages'
import { explainReading } from '../lib/claude'
import { readingStore } from '../lib/storage'

export default function Reading() {
  const [passageId, setPassageId] = useState(READING_PASSAGES[0].id)
  const passage = useMemo(
    () => READING_PASSAGES.find((p) => p.id === passageId)!,
    [passageId],
  )

  const [answers, setAnswers] = useState<(number | null)[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [explaining, setExplaining] = useState<Record<string, boolean>>({})
  const [explanations, setExplanations] = useState<Record<string, string>>({})

  useEffect(() => {
    setAnswers(new Array(passage.questions.length).fill(null))
    setSubmitted(false)
    setExplanations({})
  }, [passageId, passage.questions.length])

  const score = useMemo(() => {
    if (!submitted) return null
    let correct = 0
    passage.questions.forEach((q, i) => {
      if (answers[i] === q.answerIndex) correct++
    })
    return { correct, total: passage.questions.length }
  }, [submitted, answers, passage.questions])

  const handleSubmit = () => {
    if (answers.some((a) => a === null)) return
    setSubmitted(true)
    let correct = 0
    passage.questions.forEach((q, i) => {
      if (answers[i] === q.answerIndex) correct++
    })
    readingStore.add({
      passageId: passage.id,
      takenAt: Date.now(),
      correct,
      total: passage.questions.length,
      answers: answers as number[],
    })
  }

  const handleReset = () => {
    setAnswers(new Array(passage.questions.length).fill(null))
    setSubmitted(false)
    setExplanations({})
  }

  const requestExplain = async (qIdx: number) => {
    const q = passage.questions[qIdx]
    const studentChoice = answers[qIdx] !== null ? q.choices[answers[qIdx]!] : '(no answer)'
    const correctAnswer = q.choices[q.answerIndex]
    setExplaining((m) => ({ ...m, [q.id]: true }))
    try {
      const ai = await explainReading(passage.body, q.prompt, studentChoice, correctAnswer)
      setExplanations((m) => ({ ...m, [q.id]: ai ?? q.explanation }))
    } finally {
      setExplaining((m) => ({ ...m, [q.id]: false }))
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Reading"
        title="阅读理解"
        description="先静下心读完短文，再作答全部选择题。提交后查看分数与每题解析。"
        actions={
          <div className="hairline rounded-xl bg-surface p-1 flex">
            {READING_PASSAGES.map((p) => (
              <button
                key={p.id}
                onClick={() => setPassageId(p.id)}
                className={[
                  'px-3 h-8 rounded-lg text-[13px] transition-colors',
                  p.id === passageId
                    ? 'bg-ink-900 text-white'
                    : 'text-ink-500 hover:text-ink-900',
                ].join(' ')}
              >
                L{p.level}
              </button>
            ))}
          </div>
        }
      />

      <article className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-6">
        {/* Passage */}
        <Card padded className="space-y-4">
          <div>
            <div className="text-[12px] uppercase tracking-[0.16em] text-ink-400">
              Passage · L{passage.level}
            </div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">{passage.title}</h2>
          </div>
          <div className="prose-reading">
            {passage.body.split('\n').map((para, i) => (
              <p
                key={i}
                className="text-[15.5px] leading-[1.85] text-ink-900 mb-4 last:mb-0"
              >
                {para}
              </p>
            ))}
          </div>
        </Card>

        {/* Questions */}
        <div className="space-y-4">
          {passage.questions.map((q, qi) => {
            const userAns = answers[qi]
            const correct = q.answerIndex
            return (
              <Card key={q.id} padded className="space-y-3">
                <div className="flex items-start gap-2">
                  <span className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md bg-surface-alt text-[12px] num text-ink-500">
                    {qi + 1}
                  </span>
                  <p className="text-[15px] leading-relaxed text-ink-900">{q.prompt}</p>
                </div>
                <div className="space-y-1.5">
                  {q.choices.map((c, ci) => {
                    const picked = userAns === ci
                    const isCorrect = submitted && ci === correct
                    const isWrong = submitted && picked && ci !== correct
                    return (
                      <button
                        key={ci}
                        disabled={submitted}
                        onClick={() => {
                          const next = [...answers]
                          next[qi] = ci
                          setAnswers(next)
                        }}
                        className={[
                          'w-full text-left rounded-xl px-3.5 py-3 text-[14px] leading-relaxed flex items-start gap-3 transition-colors',
                          isCorrect
                            ? 'bg-good/10 text-ink-900'
                            : isWrong
                              ? 'bg-bad/10 text-ink-900'
                              : picked
                                ? 'bg-accent-soft text-ink-900'
                                : 'bg-surface-alt text-ink-700 hover:bg-line-soft',
                        ].join(' ')}
                      >
                        <span
                          className={[
                            'shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md text-[12px] mt-0.5',
                            isCorrect
                              ? 'bg-good text-white'
                              : isWrong
                                ? 'bg-bad text-white'
                                : picked
                                  ? 'bg-accent text-white'
                                  : 'bg-surface text-ink-500 hairline',
                          ].join(' ')}
                        >
                          {String.fromCharCode(65 + ci)}
                        </span>
                        <span>{c}</span>
                      </button>
                    )
                  })}
                </div>

                {submitted && (
                  <div className="rounded-xl bg-surface-warm hairline p-3.5 space-y-2 animate-fadeIn">
                    <div className="text-[12px] text-ink-500">解析</div>
                    <p className="text-[13.5px] text-ink-900 leading-relaxed">
                      {explanations[q.id] ?? q.explanation}
                    </p>
                    <div>
                      <button
                        onClick={() => requestExplain(qi)}
                        className="inline-flex items-center gap-1 text-[12px] text-accent hover:underline"
                        disabled={!!explaining[q.id]}
                      >
                        {explaining[q.id] ? <Spinner size={12} /> : <Icon name="sparkle" size={12} />}
                        请 AI 详细讲解
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}

          <div className="flex items-center justify-between gap-2">
            <Button
              variant="secondary"
              onClick={handleReset}
              leading={<Icon name="refresh" size={16} />}
            >
              重置
            </Button>
            {!submitted ? (
              <Button onClick={handleSubmit} disabled={answers.some((a) => a === null)}>
                提交
              </Button>
            ) : (
              <div className="text-right">
                <div className="text-[12px] uppercase tracking-[0.14em] text-ink-400">本次得分</div>
                <div className="text-3xl font-semibold tracking-tight num">
                  {score!.correct}
                  <span className="text-[14px] text-ink-400 ml-0.5">/{score!.total}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </article>
    </div>
  )
}
