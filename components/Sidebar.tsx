'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { href: '/dashboard', icon: '◈', label: 'Dashboard' },
  { href: '/plan',      icon: '▤', label: 'Plan' },
  { href: '/calendar',  icon: '▦', label: 'Kalendarz' },
  { href: '/race',      icon: '🏁', label: 'Strategia startowa' },
  { href: '/stats',     icon: '▲', label: 'Statystyki' },
  { href: '/settings',  icon: '⚙', label: 'Ustawienia' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside
      className="flex flex-col items-center py-6 gap-2 shrink-0"
      style={{
        width: 72,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        minHeight: '100vh',
      }}
    >
      {/* Logo */}
      <Link href="/dashboard" className="mb-4">
        <span
          className="text-xs font-black tracking-widest"
          style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif', color: 'var(--green)' }}
        >
          P
        </span>
      </Link>

      {/* Nav */}
      <nav className="flex flex-col gap-1 flex-1">
        {NAV.map(item => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className="w-12 h-12 flex items-center justify-center rounded-xl text-lg transition-all"
              style={{
                background: active ? 'var(--green-dim)' : 'transparent',
                color: active ? 'var(--green)' : 'var(--text-3)',
              }}
            >
              {item.icon}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <button
        onClick={handleLogout}
        title="Wyloguj"
        className="w-12 h-12 flex items-center justify-center rounded-xl text-lg transition-all"
        style={{ color: 'var(--text-3)' }}
      >
        ⏻
      </button>
    </aside>
  )
}
