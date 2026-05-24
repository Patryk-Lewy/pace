'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Hasła nie są identyczne.')
      return
    }
    if (password.length < 6) {
      setError('Hasło musi mieć co najmniej 6 znaków.')
      return
    }

    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
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
        Nowe hasło
      </h1>
      <p className="text-sm mb-8" style={{ color: 'var(--text-2)' }}>
        Ustaw nowe hasło do swojego konta PACE.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            className="block text-xs font-semibold uppercase tracking-widest mb-2"
            style={{ color: 'var(--text-3)' }}
          >
            Nowe hasło
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
            placeholder="minimum 6 znaków"
            className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-colors"
            style={{
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
          />
        </div>

        <div>
          <label
            className="block text-xs font-semibold uppercase tracking-widest mb-2"
            style={{ color: 'var(--text-3)' }}
          >
            Powtórz hasło
          </label>
          <input
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            placeholder="••••••••"
            className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-colors"
            style={{
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              borderColor: confirm && confirm !== password ? 'var(--orange)' : 'var(--border)',
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
          {loading ? 'Zapisywanie...' : 'Ustaw nowe hasło'}
        </button>
      </form>
    </div>
  )
}
