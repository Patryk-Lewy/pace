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

function ProfileStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ flex: 1, borderRadius: 14, padding: 12, background: 'var(--surface)', border: '1px solid var(--border)', textAlign: 'center' }}>
      <div className="kick" style={{ fontSize: 9, color: 'var(--text-3)' }}>{label}</div>
      <div className="cond" style={{ fontSize: 18, marginTop: 3, color: accent ? 'var(--green)' : 'var(--text)' }}>{value}</div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const DISTANCE_LABELS: Record<string, string> = {
  '5km': '5 km', '10km': '10 km', half: 'Półmaraton', marathon: 'Maraton',
}

type ProfileLite = { race_distance: string | null; weekly_km: number | null; pb_5k: string | null; best_5k_pace: string | null }

export default function SettingsPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [profile, setProfile] = useState<ProfileLite | null>(null)
  const [stravaConnected, setStravaConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [deleteModal, setDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: { user } }, { data: strava }, { data: prof }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('strava_tokens').select('user_id').maybeSingle(),
        supabase.from('runner_profiles').select('race_distance, weekly_km, pb_5k, best_5k_pace').maybeSingle(),
      ])
      setEmail(user?.email ?? '')
      setStravaConnected(!!strava)
      setProfile(prof)
      setLoading(false)
    }
    load()
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

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

  const firstName = (email.split('@')[0].split(/[._-]/)[0] || 'Biegacz')
  const nameCap = firstName.charAt(0).toUpperCase() + firstName.slice(1)
  const pb5 = profile?.pb_5k ?? profile?.best_5k_pace ?? '—'

  return (
    <div className="animate-fade-up">
      {/* Back + header */}
      <Link href="/dashboard" className="press flex items-center"
        style={{ gap: 8, padding: '16px 0 10px', font: '600 13px var(--font-barlow)', color: 'var(--text-2)', textDecoration: 'none' }}>
        <span style={{ fontSize: 18 }}>‹</span> Dziś
      </Link>
      <div className="cond" style={{ fontSize: 30, marginBottom: 16 }}>Ustawienia</div>

      {/* Profile card */}
      <div className="flex items-center" style={{ gap: 14, borderRadius: 20, padding: 18, background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 12 }}>
        <div className="flex items-center justify-center" style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--green-dim)', fontFamily: 'var(--font-barlow-condensed)', fontWeight: 800, fontSize: 22, color: 'var(--green)' }}>
          {nameCap.charAt(0)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: '700 16px var(--font-barlow)' }}>{nameCap}</div>
          <div style={{ font: '500 12px var(--font-barlow)', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</div>
        </div>
      </div>

      {/* Profile stats */}
      <div className="flex" style={{ gap: 8, marginBottom: 12 }}>
        <ProfileStat label="Cel" value={DISTANCE_LABELS[profile?.race_distance ?? ''] ?? '—'} accent />
        <ProfileStat label="Km/tydz." value={profile?.weekly_km ? `${profile.weekly_km} km` : '—'} />
        <ProfileStat label="PB 5k" value={pb5} />
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

      {/* Logout */}
      <button onClick={handleLogout} className="press"
        style={{ width: '100%', textAlign: 'center', marginTop: 20, padding: 12, background: 'none', border: 'none', font: '600 14px var(--font-barlow)', color: 'var(--text-3)' }}>
        Wyloguj się
      </button>

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
