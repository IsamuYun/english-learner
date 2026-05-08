import { FormEvent, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import Button from '../components/Button'
import Card from '../components/Card'
import { useAuth } from '../lib/auth'
import { ApiError } from '../lib/api'

type Mode = 'login' | 'register'

interface LocationState {
  from?: { pathname: string }
}

export default function Login() {
  const { status, login, register } = useAuth()
  const location = useLocation()
  const from = (location.state as LocationState | null)?.from?.pathname ?? '/'

  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === 'authenticated') {
    return <Navigate to={from} replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (username.trim().length < 3) {
      setError('用户名至少 3 个字符（字母、数字、_-.）')
      return
    }
    if (password.length < 6) {
      setError('密码至少 6 位')
      return
    }
    setSubmitting(true)
    try {
      if (mode === 'login') {
        await login(username.trim(), password)
      } else {
        await register(username.trim(), password, displayName.trim() || undefined)
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) setError('用户名或密码错误')
        else if (err.status === 409) setError('用户名已被占用')
        else setError(err.message)
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('登录失败')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-surface-alt/40">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block w-7 h-7 rounded-md bg-gradient-to-br from-accent to-[#3aa0ff]"
            />
            <span className="font-semibold tracking-tight text-lg">English · 上海高考</span>
          </div>
          <p className="mt-3 text-[13px] text-ink-500">
            {mode === 'login' ? '登录以继续学习' : '创建账号开始学习'}
          </p>
        </div>

        <Card padded elevated>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Field
              label="用户名"
              value={username}
              onChange={setUsername}
              autoComplete="username"
              placeholder="3-40 字符，字母数字 _-."
              autoFocus
            />
            {mode === 'register' && (
              <Field
                label="昵称（可选）"
                value={displayName}
                onChange={setDisplayName}
                autoComplete="nickname"
                placeholder="显示名"
              />
            )}
            <Field
              label="密码"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder="至少 6 位"
            />

            {error && (
              <div className="text-[13px] text-bad bg-bad/10 px-3 py-2 rounded-lg">{error}</div>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={submitting}
            >
              {submitting ? '请稍候…' : mode === 'login' ? '登录' : '注册并登录'}
            </Button>
          </form>

          <div className="mt-5 text-center text-[13px] text-ink-500">
            {mode === 'login' ? (
              <>
                还没有账号？{' '}
                <button
                  type="button"
                  className="text-accent hover:underline"
                  onClick={() => {
                    setMode('register')
                    setError(null)
                  }}
                >
                  注册一个
                </button>
              </>
            ) : (
              <>
                已有账号？{' '}
                <button
                  type="button"
                  className="text-accent hover:underline"
                  onClick={() => {
                    setMode('login')
                    setError(null)
                  }}
                >
                  去登录
                </button>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

interface FieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  autoComplete?: string
  autoFocus?: boolean
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  autoComplete,
  autoFocus,
}: FieldProps) {
  return (
    <label className="block">
      <span className="text-[13px] text-ink-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        className="mt-1.5 w-full h-10 px-3 rounded-xl bg-surface-alt hairline text-[14px] focus:outline-none focus:ring-2 focus:ring-accent/40 focus:bg-surface"
      />
    </label>
  )
}
