import { useEffect, useRef, useState } from 'react'
import Card from '../components/Card'
import Icon from '../components/Icon'
import Button from '../components/Button'
import PageHeader from '../components/PageHeader'
import { settingsStore } from '../lib/storage'
import { getVoices, onVoicesReady, speak, type TTSVoice } from '../lib/speech'
import { aiApi, type AiStatus } from '../lib/api'
import type { AppSettings } from '../types'

export default function Settings() {
  const [s, setS] = useState<AppSettings>(() => settingsStore.get())
  const [voices, setVoices] = useState<TTSVoice[]>(getVoices())
  const [savedFlash, setSavedFlash] = useState(false)
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null)
  const rateTimer = useRef<number | null>(null)

  useEffect(() => {
    onVoicesReady(() => setVoices(getVoices()))
  }, [])

  useEffect(() => {
    let cancelled = false
    aiApi
      .status()
      .then((r) => {
        if (!cancelled) setAiStatus(r)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const flashSaved = () => {
    setSavedFlash(true)
    window.setTimeout(() => setSavedFlash(false), 1200)
  }

  const setAndPersist = (patch: Partial<AppSettings>) => {
    setS((cur) => {
      const next = { ...cur, ...patch }
      settingsStore.set(next)
      return next
    })
    flashSaved()
  }

  const handleVoiceChange = (voiceURI: string) => setAndPersist({ voice: voiceURI })

  const handleRateChange = (rate: number) => {
    setS((cur) => ({ ...cur, rate }))
    if (rateTimer.current !== null) window.clearTimeout(rateTimer.current)
    rateTimer.current = window.setTimeout(() => {
      const cur = settingsStore.get()
      settingsStore.set({ ...cur, rate })
      flashSaved()
    }, 350)
  }

  const test = () => {
    speak('Reading widely is vital for academic success.', {
      rate: s.rate,
      voiceURI: s.voice,
    })
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <PageHeader
        eyebrow="Settings"
        title="设置"
        description="语音偏好会自动保存到你的账号；AI 评价由项目统一配置，无需个人填写密钥。"
      />

      <Card padded className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">AI 评价状态</h3>
            <p className="text-[13px] text-ink-500 mt-1">
              AI 句子点评、口语反馈、阅读讲解与作文批改由项目统一接入 Google Gemini。
              未启用时，应用会回退到本地基础规则反馈。
            </p>
          </div>
          <span
            className={[
              'shrink-0 inline-flex items-center px-2.5 h-7 rounded-full text-[12px]',
              aiStatus?.enabled ? 'bg-good/10 text-good' : 'bg-surface-alt text-ink-500',
            ].join(' ')}
          >
            {aiStatus === null ? '检查中…' : aiStatus.enabled ? '已启用' : '未配置'}
          </span>
        </div>
        {aiStatus?.enabled && (
          <p className="text-[12px] text-ink-400 num">模型：{aiStatus.model}</p>
        )}
        {aiStatus && !aiStatus.enabled && (
          <p className="text-[12px] text-ink-400 leading-relaxed">
            管理员可在服务端 <code className="num">server/.env</code> 中设置{' '}
            <code className="num">GEMINI_API_KEY</code>，重启服务后即生效。
          </p>
        )}
      </Card>

      <Card padded className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">语音设置</h3>
            <p className="text-[13px] text-ink-500 mt-1">
              选择 CosyVoice 嗓音和语速。修改后自动保存，下次登录在任何设备都会沿用。
            </p>
          </div>
          {savedFlash && (
            <span className="shrink-0 text-[12px] text-good inline-flex items-center gap-1 animate-fadeIn">
              <Icon name="check" size={12} />
              已自动保存
            </span>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-[12px] text-ink-500">嗓音</label>
          <div className="relative">
            <select
              value={s.voice}
              onChange={(e) => handleVoiceChange(e.target.value)}
              className="w-full h-11 rounded-xl hairline bg-surface px-3 pr-9 text-[14px] appearance-none"
            >
              {voices.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
            <Icon
              name="chevron-down"
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none"
            />
          </div>
          <p className="text-[12px] text-ink-400">
            嗓音由 CosyVoice (FunAudioLLM) 服务端合成，结果会缓存，重复内容直接命中。
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[12px] text-ink-500">语速</label>
            <span className="text-[12px] text-ink-700 num">{s.rate.toFixed(2)}×</span>
          </div>
          <input
            type="range"
            min="0.6"
            max="1.3"
            step="0.05"
            value={s.rate}
            onChange={(e) => handleRateChange(parseFloat(e.target.value))}
            className="w-full accent-accent"
          />
        </div>

        <Button
          variant="secondary"
          onClick={test}
          leading={<Icon name="play" size={14} />}
        >
          试听一句
        </Button>
      </Card>
    </div>
  )
}
