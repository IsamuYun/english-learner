import { useEffect, useState } from 'react'
import type { VocabWord } from '../types'
import { wordsApi, type WordsListQuery } from './api'

export interface WordsHookState {
  words: VocabWord[]
  total: number
  loading: boolean
  error: string | null
  refresh: () => void
}

export function useWords(query: WordsListQuery = {}, deps: ReadonlyArray<unknown> = []): WordsHookState {
  const [words, setWords] = useState<VocabWord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    wordsApi
      .list(query)
      .then((res) => {
        if (cancelled) return
        setWords(res.items.map(wordsApi.raw))
        setTotal(res.total)
        setError(null)
      })
      .catch((e: Error) => {
        if (cancelled) return
        setError(e.message)
        setWords([])
        setTotal(0)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps])

  return { words, total, loading, error, refresh: () => setTick((t) => t + 1) }
}
