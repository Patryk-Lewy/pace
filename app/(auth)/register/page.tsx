'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${location.origin}/onboarding` },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Fire welcome email (fire-and-forget — don't block redirect on failure)
    fetch('/api/auth/welcome-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }).catch(() => {/* ignore */})

    router.push('/onboarding')
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
        Stwórz konto
      </h1>
      <p className="text-sm mb-8" style={{ color: 'var(--text-2)' }}>
        Zbudujemy plan treningowy skrojony pod Ciebie.
      </p>

      <form onSubmit={handleRegister} className="space-y-4">
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
            className="w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={{
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-3)' }}>
            Hasło
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
            placeholder="min. 6 znaków"
            className="w-full rounded-xl px-4 py-3 text-sm outline-none"
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
          {loading ? 'Tworzenie konta...' : 'Zacznij biegać'}
        </button>
      </form>

      <p className="text-center text-sm mt-6" style={{ color: 'var(--text-3)' }}>
        Masz już konto?{' '}
        <Link href="/login" className="font-semibold" style={{ color: 'var(--green)' }}>
          Zaloguj się
        </Link>
      </p>
    </div>
  )
}
