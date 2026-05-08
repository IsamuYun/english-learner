import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import Icon from './Icon'
import { useAuth } from '../lib/auth'

interface NavItem {
  to: string
  label: string
  icon: 'home' | 'flashcard' | 'chat' | 'book' | 'pen' | 'settings' | 'list'
}

const NAV: NavItem[] = [
  { to: '/', label: '首页', icon: 'home' },
  { to: '/flashcards', label: '单词卡', icon: 'flashcard' },
  { to: '/conversation', label: '口语对话', icon: 'chat' },
  { to: '/reading', label: '阅读理解', icon: 'book' },
  { to: '/essay', label: '每周作文', icon: 'pen' },
  { to: '/manage', label: '词条管理', icon: 'list' },
  { to: '/settings', label: '设置', icon: 'settings' },
]

export default function Layout() {
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-30 glass border-b border-line-soft">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <NavLink to="/" className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block w-6 h-6 rounded-md bg-gradient-to-br from-accent to-[#3aa0ff]"
            />
            <span className="font-semibold tracking-tight">English · 上海高考</span>
          </NavLink>
          <nav className="hidden md:flex items-center gap-1">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/'}
                className={({ isActive }) =>
                  [
                    'px-3 h-9 inline-flex items-center gap-1.5 rounded-lg text-[13.5px] transition-colors',
                    isActive
                      ? 'text-accent bg-accent-soft'
                      : 'text-ink-700 hover:text-ink-900 hover:bg-surface-alt',
                  ].join(' ')
                }
              >
                <Icon name={n.icon} size={16} />
                <span>{n.label}</span>
              </NavLink>
            ))}
          </nav>
          {user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                onBlur={() => window.setTimeout(() => setMenuOpen(false), 120)}
                className="h-9 px-2.5 inline-flex items-center gap-2 rounded-lg text-[13px] text-ink-700 hover:bg-surface-alt"
              >
                <span className="w-6 h-6 rounded-full bg-accent-soft text-accent text-[12px] font-semibold inline-flex items-center justify-center">
                  {user.displayName.slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden md:inline max-w-[8rem] truncate">{user.displayName}</span>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-11 min-w-[12rem] rounded-xl bg-surface hairline shadow-card py-1 z-40">
                  <div className="px-3 py-2 text-[12px] text-ink-400">@{user.username}</div>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      void logout()
                    }}
                    className="w-full text-left px-3 py-2 text-[13px] text-ink-700 hover:bg-surface-alt"
                  >
                    退出登录
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg bg-ink-900 text-white text-[13px] font-medium hover:bg-ink-700 transition-colors"
            >
              登录
              <Icon name="arrow-right" size={14} />
            </Link>
          )}
        </div>
      </header>

      <main key={pathname} className="flex-1 animate-fadeIn">
        <div className="max-w-6xl mx-auto px-6 py-8 md:py-12">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden sticky bottom-0 glass border-t border-line-soft">
        <div className="grid grid-cols-7">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                [
                  'h-14 flex flex-col items-center justify-center gap-0.5 text-[10.5px]',
                  isActive ? 'text-accent' : 'text-ink-500',
                ].join(' ')
              }
            >
              <Icon name={n.icon} size={18} />
              <span>{n.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
