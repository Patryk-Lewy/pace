'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div
        className="rounded-2xl p-8 border text-center"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="text-4xl mb-4">📬</div>
        <h1
          className="text-2xl font-bold mb-2"
          style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif' }}
        >
          Sprawdź skrzynkę
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-2)' }}>
          Wysłaliśmy link do resetu hasła na <strong style={{ color: 'var(--text)' }}>{email}</strong>.
          Link jest ważny przez 24 godziny.
        </p>
        <Link
          href="/login"
          className="text-sm font-semibold"
          style={{ color: 'var(--green)' }}
        >
          ← Wróć do logowania
        </Link>
      </div>
    )
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
        Reset hasła
      </h1>
      <p className="text-sm mb-8" style={{ color: 'var(--text-2)' }}>
        Podaj adres email — wyślemy Ci link do ustawienia nowego hasła.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            className="block text-xs font-semibold uppercase tracking-widest mb-2"
            style={{ color: 'var(--text-3)' }}
          >
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
          {loading ? 'Wysyłanie...' : 'Wyślij link resetujący'}
        </button>
      </form>

      <p className="text-center text-sm mt-6" style={{ color: 'var(--text-3)' }}>
        <Link href="/login" className="font-semibold" style={{ color: 'var(--green)' }}>
          ← Wróć do logowania
        </Link>
      </p>
    </div>
  )
}
