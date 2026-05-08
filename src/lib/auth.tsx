import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  authApi,
  getAuthToken,
  onUnauthorized,
  setAuthToken,
  type AuthUser,
} from './api'
import { hydrate, resetCaches } from './storage'

type Status = 'loading' | 'anonymous' | 'authenticated'

interface AuthContextValue {
  status: Status
  user: AuthUser | null
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string, displayName?: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const hydrated = useRef(false)

  const finishAuth = useCallback(async (u: AuthUser) => {
    setUser(u)
    setStatus('authenticated')
    hydrated.current = false
    await hydrate()
    hydrated.current = true
  }, [])

  const clearAuth = useCallback(() => {
    setAuthToken(null)
    setUser(null)
    setStatus('anonymous')
    resetCaches()
  }, [])

  // Bootstrap: if a token is in localStorage, try to fetch /me
  useEffect(() => {
    let cancelled = false
    const token = getAuthToken()
    if (!token) {
      setStatus('anonymous')
      return
    }
    authApi
      .me()
      .then((res) => {
        if (cancelled) return
        void finishAuth(res.user)
      })
      .catch(() => {
        if (cancelled) return
        clearAuth()
      })
    return () => {
      cancelled = true
    }
  }, [finishAuth, clearAuth])

  // On any 401 from the API client, kick the user out
  useEffect(() => onUnauthorized(() => clearAuth()), [clearAuth])

  const login = useCallback<AuthContextValue['login']>(
    async (username, password) => {
      const res = await authApi.login({ username, password })
      setAuthToken(res.token)
      await finishAuth(res.user)
    },
    [finishAuth],
  )

  const register = useCallback<AuthContextValue['register']>(
    async (username, password, displayName) => {
      const res = await authApi.register({ username, password, displayName })
      setAuthToken(res.token)
      await finishAuth(res.user)
    },
    [finishAuth],
  )

  const logout = useCallback<AuthContextValue['logout']>(async () => {
    try {
      await authApi.logout()
    } catch {
      /* noop */
    }
    clearAuth()
  }, [clearAuth])

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, login, register, logout }),
    [status, user, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
