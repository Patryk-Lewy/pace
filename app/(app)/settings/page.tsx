'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import NotificationToggle from '@/components/NotificationToggle'

// ─── Helper components ────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-6 flex flex-col gap-5"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <h2 className="text-lg font-black uppercase tracking-widest"
        style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif', color: 'var(--text-3)' }}>
        {title}
      </h2>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface2)', border: '1px solid var(--border)',
  color: 'var(--text)', borderRadius: 10, padding: '10px 14px', fontSize: 14, width: '100%',
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [stravaConnected, setStravaConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [deleteModal, setDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: { user } }, { data: strava }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('strava_tokens').select('user_id').maybeSingle(),
      ])
      setEmail(user?.email ?? '')
      setStravaConnected(!!strava)
      setLoading(false)
    }
    load()
  }, [])

  async function disconnectStrava() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('strava_tokens').delete().eq('user_id', user.id)
    setStravaConnected(false)
  }

  async function deleteAccount() {
    setDeleting(true)
    try {
      const res = await fetch('/api/account/delete', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error ?? 'Nie udało się usunąć konta. Spróbuj ponownie lub napisz na plewandowskkii@gmail.com')
        setDeleting(false)
        return
      }
      await createClient().auth.signOut()
      router.push('/login?deleted=1')
    } catch (err) {
      console.error('[DELETE ACCOUNT]', err)
      alert('Błąd sieci. Spróbuj ponownie.')
      setDeleting(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-sm" style={{ color: 'var(--text-3)' }}>Ładowanie...</p>
    </div>
  )

  return (
    <div className="max-w-2xl animate-fade-up">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-5xl font-black mb-1"
          style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif' }}>
          Ustawienia
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-2)' }}>Konto i integracje</p>
      </div>

      <div className="flex flex-col gap-4">

        {/* ── Plan params hint ── */}
        <div className="rounded-2xl p-4 flex items-center justify-between gap-4"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div>
            <p className="text-sm font-bold">Parametry treningowe</p>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>
              Cel, dystans, dni i rekordy edytujesz teraz przy planie.
            </p>
          </div>
          <Link href="/plan"
            className="rounded-xl px-4 py-2 text-sm font-black uppercase tracking-widest flex-shrink-0"
            style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif', background: 'var(--green)', color: '#000' }}>
            Plan →
          </Link>
        </div>

        {/* ── Konto ── */}
        <Section title="Konto">
          <Field label="Email">
            <input value={email} readOnly style={{ ...inputStyle, opacity: 0.5 }} />
          </Field>
          <div className="flex flex-col gap-2">
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>
              Aby zmienić hasło, wyloguj się i użyj opcji „Resetuj hasło" na stronie logowania.
            </p>
            <button
              onClick={() => setDeleteModal(true)}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold self-start transition-all"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-3)' }}>
              Usuń konto
            </button>
          </div>
        </Section>

        {/* ── Integracje ── */}
        <Section title="Integracje">

          {/* Strava */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-black"
                style={{ background: '#FC4C02' }}>S</div>
              <div>
                <p className="text-sm font-semibold">Strava</p>
                <p className="text-xs" style={{ color: stravaConnected ? 'var(--green)' : 'var(--text-3)' }}>
                  {stravaConnected ? '● Połączona' : '○ Niepołączona'}
                </p>
              </div>
            </div>
            {stravaConnected ? (
              <button onClick={disconnectStrava}
                className="rounded-xl px-4 py-2 text-xs font-semibold transition-all"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-3)' }}>
                Odłącz
              </button>
            ) : (
              <a href="/api/strava/connect"
                className="rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest"
                style={{ background: '#FC4C02', color: '#fff', fontFamily: 'var(--font-barlow-condensed), sans-serif' }}>
                Połącz →
              </a>
            )}
          </div>

          {/* Push notifications */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
                style={{ background: 'var(--surface2)' }}>🔔</div>
              <div>
                <p className="text-sm font-semibold">Powiadomienia push</p>
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                  Przypomnienie o treningu o 8:00
                </p>
              </div>
            </div>
            <NotificationToggle />
          </div>
        </Section>

      </div>

      {/* ── Delete modal ── */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)' }}
          onClick={e => e.target === e.currentTarget && setDeleteModal(false)}>
          <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h3 className="text-xl font-black" style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif' }}>
              Usuń konto
            </h3>
            <p className="text-sm" style={{ color: 'var(--text-2)' }}>
              Wszystkie Twoje dane (plan, treningi, statystyki) zostaną trwale usunięte.
              Tej operacji nie można cofnąć.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModal(false)}
                className="flex-1 rounded-xl py-3 text-sm font-semibold"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                Anuluj
              </button>
              <button onClick={deleteAccount} disabled={deleting}
                className="flex-1 rounded-xl py-3 text-sm font-bold transition-all"
                style={{ background: '#ef4444', color: '#fff' }}>
                {deleting ? 'Usuwanie...' : 'Usuń konto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
