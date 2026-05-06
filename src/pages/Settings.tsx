import { useEffect, useState } from 'react'
import Card from '../components/Card'
import Icon from '../components/Icon'
import Button from '../components/Button'
import PageHeader from '../components/PageHeader'
import { defaultSettings, settingsStore } from '../lib/storage'
import { getVoices, onVoicesReady, speak } from '../lib/speech'
import type { AppSettings } from '../types'

export default function Settings() {
  const [s, setS] = useState<AppSettings>(() => settingsStore.get())
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(getVoices())
  const [showKey, setShowKey] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => {
    onVoicesReady(() => setVoices(getVoices()))
  }, [])

  const update = (patch: Partial<AppSettings>) => setS((cur) => ({ ...cur, ...patch }))

  const save = () => {
    settingsStore.set(s)
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1600)
  }

  const reset = () => {
    setS({ ...defaultSettings })
  }

  const test = () => {
    speak('Reading widely is vital for academic success.', { rate: s.rate, voiceURI: s.voice })
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <PageHeader
        eyebrow="Settings"
        title="设置"
        description="配置 AI 评价（可选）与语音偏好。所有内容仅保存在本机浏览器中。"
      />

      <Card padded className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">Anthropic API Key</h3>
            <p className="text-[13px] text-ink-500 mt-1">
              用于 AI 句子点评、口语反馈、阅读讲解与作文批改。未填写时仍可使用基础规则反馈。
            </p>
          </div>
          <span
            className={[
              'inline-flex items-center px-2.5 h-7 rounded-full text-[12px]',
              s.apiKey ? 'bg-good/10 text-good' : 'bg-surface-alt text-ink-500',
            ].join(' ')}
          >
            {s.apiKey ? '已配置' : '未配置'}
          </span>
        </div>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={s.apiKey}
            onChange={(e) => update({ apiKey: e.target.value })}
            placeholder="sk-ant-..."
            className="w-full h-11 rounded-xl hairline bg-surface-warm px-4 pr-20 text-[14px] num focus:bg-surface transition-colors"
          />
          <button
            onClick={() => setShowKey((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 px-3 rounded-lg text-[12px] text-ink-500 hover:bg-surface-alt"
          >
            {showKey ? '隐藏' : '显示'}
          </button>
        </div>
        <p className="text-[12px] text-ink-400 leading-relaxed">
          密钥仅保存在你的浏览器（localStorage），调用直接发往 Anthropic 服务器。请使用属于你自己的
          API Key，并妥善保管。
        </p>
      </Card>

      <Card padded className="space-y-5">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">语音设置</h3>
          <p className="text-[13px] text-ink-500 mt-1">
            选择系统已安装的英文嗓音和语速。中文嗓音可用于将来扩展。
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-[12px] text-ink-500">英文嗓音</label>
          <div className="relative">
            <select
              value={s.voice}
              onChange={(e) => update({ voice: e.target.value })}
              className="w-full h-11 rounded-xl hairline bg-surface px-3 pr-9 text-[14px] appearance-none"
            >
              <option value="">使用浏览器默认嗓音</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} · {v.lang}
                </option>
              ))}
            </select>
            <Icon
              name="chevron-down"
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none"
            />
          </div>
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
            onChange={(e) => update({ rate: parseFloat(e.target.value) })}
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

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={reset}>
          恢复默认
        </Button>
        <div className="flex items-center gap-3">
          {savedFlash && (
            <span className="text-[12.5px] text-good inline-flex items-center gap-1 animate-fadeIn">
              <Icon name="check" size={14} />
              已保存
            </span>
          )}
          <Button onClick={save}>保存设置</Button>
        </div>
      </div>
    </div>
  )
}
