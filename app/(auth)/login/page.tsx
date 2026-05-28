'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [deleted, setDeleted] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      setDeleted(params.get('deleted') === '1')
    }
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div
      className="rounded-2xl p-8 border"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <h1
        className="text-2xl font-bold mb-1"
        style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif' }}
      >
        Zaloguj się
      </h1>
      <p className="text-sm mb-8" style={{ color: 'var(--text-2)' }}>
        Witaj z powrotem, biegaczu.
      </p>

      {deleted && (
        <div className="rounded-xl px-4 py-3 mb-6 text-sm"
          style={{ background: 'var(--green-dim)', border: '1px solid rgba(0,230,118,0.3)', color: 'var(--green)' }}>
          ✓ Twoje konto i wszystkie dane zostały trwale usunięte.
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-3)' }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            placeholder="jan@example.com"
            className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-colors"
            style={{
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
              Hasło
            </label>
            <Link href="/reset-password" className="text-xs" style={{ color: 'var(--green)' }}>
              Zapomniałem hasła
            </Link>
          </div>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-colors"
            style={{
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
          />
        </div>

        {error && (
          <p className="text-sm rounded-xl px-4 py-3" style={{ background: 'var(--orange-dim)', color: 'var(--orange)' }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl py-3 text-sm font-black uppercase tracking-widest transition-all"
          style={{
            fontFamily: 'var(--font-barlow-condensed), sans-serif',
            background: loading ? 'var(--surface3)' : 'var(--green)',
            color: loading ? 'var(--text-3)' : '#000',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Logowanie...' : 'Zaloguj się'}
        </button>
      </form>

      <p className="text-center text-sm mt-6" style={{ color: 'var(--text-3)' }}>
        Nie masz konta?{' '}
        <Link href="/register" className="font-semibold" style={{ color: 'var(--green)' }}>
          Zarejestruj się
        </Link>
      </p>
    </div>
  )
}
