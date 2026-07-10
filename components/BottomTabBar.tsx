'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ACTIVE = 'var(--green)'
const IDLE = 'rgba(255,255,255,.32)'

// Routes that render immersively without the tab bar (own back button).
const HIDDEN_ON = ['/settings', '/race', '/run', '/onboarding']

function isHidden(pathname: string): boolean {
  if (HIDDEN_ON.some(r => pathname.startsWith(r))) return true
  // Workout detail (/calendar/[id]) is immersive; the calendar index is not.
  if (/^\/calendar\/[^/]+$/.test(pathname)) return true
  return false
}

function Icon({ name }: { name: 'home' | 'plan' | 'calendar' | 'stats' }) {
  const common = {
    width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 2,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  }
  switch (name) {
    case 'home':
      return <svg {...common}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h5v-6h4v6h5V9.5" /></svg>
    case 'plan':
      return <svg {...common}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 4v16" /></svg>
    case 'calendar':
      return <svg {...common}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></svg>
    case 'stats':
      return <svg {...common}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
  }
}

export default function BottomTabBar() {
  const pathname = usePathname()
  if (isHidden(pathname)) return null

  const tabs = [
    { href: '/dashboard', label: 'Dziś', icon: 'home' as const, active: pathname.startsWith('/dashboard') },
    { href: '/plan', label: 'Plan', icon: 'plan' as const, active: pathname.startsWith('/plan') },
    { href: '/calendar', label: 'Kalendarz', icon: 'calendar' as const, active: pathname.startsWith('/calendar') },
    { href: '/stats', label: 'Statystyki', icon: 'stats' as const, active: pathname.startsWith('/stats') },
  ]

  return (
    <nav
      className="fixed left-0 right-0 bottom-0 z-20 flex items-start justify-around"
      style={{
        height: 92,
        background: 'rgba(16,16,20,.94)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid var(--border)',
        padding: '12px 14px 0',
      }}
    >
      {tabs.slice(0, 2).map(t => <Tab key={t.href} {...t} />)}

      {/* FAB — start a live run */}
      <Link
        href="/run"
        aria-label="Zacznij bieg"
        className="flex-none flex items-center justify-center press"
        style={{
          width: 56, height: 56, borderRadius: '50%', background: 'var(--green)',
          marginTop: -16, boxShadow: '0 8px 24px -4px rgba(0,230,118,.5)',
        }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="#000">
          <path d="M13.5 5.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm-2 3-3 2 1 4-2 5h2l2-4 2 2v4h2v-5l-2-2 1-3 2 2h3v-2h-2l-2-2-2.5-1.5-1.5 1.5Z" />
        </svg>
      </Link>

      {tabs.slice(2).map(t => <Tab key={t.href} {...t} />)}
    </nav>
  )
}

function Tab({ href, label, icon, active }: {
  href: string; label: string; icon: 'home' | 'plan' | 'calendar' | 'stats'; active: boolean
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center flex-1 press"
      style={{ gap: 5, color: active ? ACTIVE : IDLE, textDecoration: 'none' }}
    >
      <Icon name={icon} />
      <span style={{ font: "600 10px var(--font-barlow)", letterSpacing: '.2px' }}>{label}</span>
    </Link>
  )
}
