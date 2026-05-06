import { useEffect, useMemo, useState } from 'react'
import Button from '../components/Button'
import Card from '../components/Card'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import Spinner from '../components/Spinner'
import { wordsApi, type WordsListQuery } from '../lib/api'

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

type Draft = Omit<RawWord, 'id'>

const EMPTY_DRAFT: Draft = {
  word: '',
  ipa: '',
  pos: '',
  zh: '',
  example_en: '',
  example_zh: '',
  level: 2,
  is_phrase: 0,
  tags: '',
}

const PAGE_SIZE = 25

export default function Manage() {
  const [q, setQ] = useState('')
  const [level, setLevel] = useState<'all' | 1 | 2 | 3>('all')
  const [phrase, setPhrase] = useState<'all' | 0 | 1>('all')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<RawWord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)

  const query = useMemo<WordsListQuery>(
    () => ({
      q: q.trim() || undefined,
      level: level === 'all' ? undefined : level,
      is_phrase: phrase === 'all' ? undefined : phrase,
      page,
      pageSize: PAGE_SIZE,
    }),
    [q, level, phrase, page],
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    wordsApi
      .list(query)
      .then((res) => {
        if (cancelled) return
        setItems(res.items)
        setTotal(res.total)
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [query, tick])

  const refresh = () => setTick((t) => t + 1)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const startEdit = (row: RawWord) => {
    setAdding(false)
    setEditingId(row.id)
    setDraft({
      word: row.word,
      ipa: row.ipa ?? '',
      pos: row.pos ?? '',
      zh: row.zh,
      example_en: row.example_en ?? '',
      example_zh: row.example_zh ?? '',
      level: row.level,
      is_phrase: row.is_phrase,
      tags: row.tags ?? '',
    })
  }

  const startAdd = () => {
    setEditingId(null)
    setAdding(true)
    setDraft(EMPTY_DRAFT)
  }

  const cancel = () => {
    setEditingId(null)
    setAdding(false)
    setDraft(EMPTY_DRAFT)
  }

  const handleSave = async () => {
    if (!draft.word.trim() || !draft.zh.trim()) {
      alert('单词和中文释义不能为空')
      return
    }
    setSaving(true)
    try {
      const payload = {
        word: draft.word.trim(),
        ipa: draft.ipa?.trim() || null,
        pos: draft.pos?.trim() || null,
        zh: draft.zh.trim(),
        example_en: draft.example_en?.trim() || null,
        example_zh: draft.example_zh?.trim() || null,
        level: draft.level,
        is_phrase: draft.is_phrase,
        tags: draft.tags?.trim() || null,
      }
      if (editingId !== null) {
        await wordsApi.update(editingId, payload)
      } else {
        await wordsApi.create(payload)
      }
      cancel()
      refresh()
    } catch (e: any) {
      alert(`保存失败：${e?.message ?? e}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row: RawWord) => {
    if (!confirm(`确认删除「${row.word}」？`)) return
    try {
      await wordsApi.remove(row.id)
      refresh()
    } catch (e: any) {
      alert(`删除失败：${e?.message ?? e}`)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Manage"
        title="词条管理"
        description="搜索、筛选、编辑、新增词条。修改即时写入数据库。"
        actions={
          <Button onClick={startAdd} leading={<Icon name="sparkle" size={16} />}>
            新增词条
          </Button>
        }
      />

      {/* Filters */}
      <Card padded className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(1)
            }}
            placeholder="搜索单词或中文释义…"
            className="flex-1 min-w-[200px] h-10 px-3 rounded-xl hairline bg-surface-warm text-[14px] focus:bg-surface transition-colors"
          />
          <SegSwitch<'all' | 1 | 2 | 3>
            value={level}
            onChange={(v) => {
              setLevel(v)
              setPage(1)
            }}
            options={[
              { value: 'all', label: '全部' },
              { value: 1, label: 'L1' },
              { value: 2, label: 'L2' },
              { value: 3, label: 'L3' },
            ]}
          />
          <SegSwitch<'all' | 0 | 1>
            value={phrase}
            onChange={(v) => {
              setPhrase(v)
              setPage(1)
            }}
            options={[
              { value: 'all', label: '全部' },
              { value: 0, label: '单词' },
              { value: 1, label: '词组' },
            ]}
          />
        </div>
        <div className="text-[12px] text-ink-400">
          {loading ? (
            <span className="inline-flex items-center gap-1">
              <Spinner /> 载入中…
            </span>
          ) : (
            <>
              共 <span className="num">{total}</span> 条 · 第 {page} / {totalPages} 页
            </>
          )}
          {error && <span className="ml-2 text-bad">· {error}</span>}
        </div>
      </Card>

      {/* Add/Edit form */}
      {(adding || editingId !== null) && (
        <Card padded className="space-y-4 border-2 border-accent/30">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold tracking-tight">
              {adding ? '新增词条' : `编辑 #${editingId}`}
            </h3>
            <Button variant="ghost" size="sm" onClick={cancel}>
              取消
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="单词 / 词组 *">
              <input
                value={draft.word}
                onChange={(e) => setDraft({ ...draft, word: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="中文释义 *">
              <input
                value={draft.zh}
                onChange={(e) => setDraft({ ...draft, zh: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="IPA 音标">
              <input
                value={draft.ipa ?? ''}
                onChange={(e) => setDraft({ ...draft, ipa: e.target.value })}
                placeholder="/ˈeksæmpl/"
                className={inputCls}
              />
            </Field>
            <Field label="词性">
              <input
                value={draft.pos ?? ''}
                onChange={(e) => setDraft({ ...draft, pos: e.target.value })}
                placeholder="n. / v. / adj."
                className={inputCls}
              />
            </Field>
            <Field label="英文例句">
              <input
                value={draft.example_en ?? ''}
                onChange={(e) => setDraft({ ...draft, example_en: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="中文例句">
              <input
                value={draft.example_zh ?? ''}
                onChange={(e) => setDraft({ ...draft, example_zh: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="等级">
              <select
                value={draft.level}
                onChange={(e) =>
                  setDraft({ ...draft, level: parseInt(e.target.value, 10) as 1 | 2 | 3 })
                }
                className={inputCls}
              >
                <option value={1}>L1 基础</option>
                <option value={2}>L2 进阶</option>
                <option value={3}>L3 高阶</option>
              </select>
            </Field>
            <Field label="类型">
              <select
                value={draft.is_phrase}
                onChange={(e) =>
                  setDraft({ ...draft, is_phrase: parseInt(e.target.value, 10) as 0 | 1 })
                }
                className={inputCls}
              >
                <option value={0}>单词</option>
                <option value={1}>词组</option>
              </select>
            </Field>
            <Field label="标签（逗号分隔）" full>
              <input
                value={draft.tags ?? ''}
                onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
                placeholder="culture, environment"
                className={inputCls}
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={cancel}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving} leading={saving ? <Spinner /> : undefined}>
              {saving ? '保存中…' : '保存'}
            </Button>
          </div>
        </Card>
      )}

      {/* List */}
      <Card padded className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="text-ink-400 text-left border-b border-line-soft">
            <tr>
              <th className="py-2 pr-3 font-normal w-12">ID</th>
              <th className="py-2 pr-3 font-normal">单词 / 词组</th>
              <th className="py-2 pr-3 font-normal">IPA</th>
              <th className="py-2 pr-3 font-normal">词性</th>
              <th className="py-2 pr-3 font-normal">中文</th>
              <th className="py-2 pr-3 font-normal w-16">等级</th>
              <th className="py-2 pr-3 font-normal w-16">类型</th>
              <th className="py-2 pr-3 font-normal w-28 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className="border-b border-line-soft hover:bg-surface-warm">
                <td className="py-2 pr-3 num text-ink-400">{row.id}</td>
                <td className="py-2 pr-3 font-medium text-ink-900">{row.word}</td>
                <td className="py-2 pr-3 num text-ink-500">{row.ipa || '—'}</td>
                <td className="py-2 pr-3 text-ink-500">{row.pos || '—'}</td>
                <td className="py-2 pr-3 text-ink-700 max-w-[280px] truncate">{row.zh}</td>
                <td className="py-2 pr-3">L{row.level}</td>
                <td className="py-2 pr-3 text-ink-500">{row.is_phrase ? '词组' : '单词'}</td>
                <td className="py-2 pr-3 text-right whitespace-nowrap">
                  <button
                    onClick={() => startEdit(row)}
                    className="text-accent hover:underline mr-3"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleDelete(row)}
                    className="text-bad hover:underline"
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-ink-400">
                  没有匹配的词条
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          leading={<Icon name="arrow-left" size={14} />}
        >
          上一页
        </Button>
        <div className="text-[12px] text-ink-500 num">
          {page} / {totalPages}
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          trailing={<Icon name="arrow-right" size={14} />}
        >
          下一页
        </Button>
      </div>
    </div>
  )
}

const inputCls =
  'w-full h-10 px-3 rounded-xl hairline bg-surface-warm text-[14px] focus:bg-surface transition-colors'

function Field({
  label,
  children,
  full,
}: {
  label: string
  children: React.ReactNode
  full?: boolean
}) {
  return (
    <label className={`block ${full ? 'md:col-span-2' : ''}`}>
      <div className="text-[12px] text-ink-500 mb-1">{label}</div>
      {children}
    </label>
  )
}

function SegSwitch<T extends string | number>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="hairline rounded-xl bg-surface p-1 flex">
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={[
            'px-3 h-8 rounded-lg text-[13px] transition-colors',
            value === o.value ? 'bg-ink-900 text-white' : 'text-ink-500 hover:text-ink-900',
          ].join(' ')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
