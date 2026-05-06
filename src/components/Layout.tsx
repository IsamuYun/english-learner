import { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import Icon from './Icon'

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

export default function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
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
        </div>
      </header>

      <main key={pathname} className="flex-1 animate-fadeIn">
        <div className="max-w-6xl mx-auto px-6 py-8 md:py-12">{children}</div>
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
