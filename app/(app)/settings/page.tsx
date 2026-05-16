'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import NotificationToggle from '@/components/NotificationToggle'
import type { RunnerProfile } from '@/types/database'

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS = [
  { id: 'mon', label: 'Pon' }, { id: 'tue', label: 'Wt' },
  { id: 'wed', label: 'Śr' }, { id: 'thu', label: 'Czw' },
  { id: 'fri', label: 'Pt' }, { id: 'sat', label: 'Sob' },
  { id: 'sun', label: 'Ndz' },
]

const DISTANCES = [
  { id: '5km', label: '5 km' }, { id: '10km', label: '10 km' },
  { id: 'half', label: 'Półmaraton' }, { id: 'marathon', label: 'Maraton' },
]

const SESSION_OPTS = [
  { id: 30, label: '30 min' }, { id: 45, label: '45 min' },
  { id: 60, label: '60 min' }, { id: 90, label: '90 min' },
  { id: 120, label: '2 godz+' },
]

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
  const [profile, setProfile] = useState<RunnerProfile | null>(null)
  const [email, setEmail] = useState('')
  const [stravaConnected, setStravaConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [profileChanged, setProfileChanged] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteModal, setDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Form state
  const [form, setForm] = useState({
    race_goal: '', race_distance: '', race_date: '',
    weekly_km: '',
    pb_5k: '', pb_10k: '', pb_half: '', pb_marathon: '',
    available_days: [] as string[],
    max_session_minutes: 60, injury_history: '', additional_goal: '',
  })

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: { user } }, { data: prof }, { data: strava }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('runner_profiles').select('*').maybeSingle(),
        supabase.from('strava_tokens').select('user_id').maybeSingle(),
      ])
      setEmail(user?.email ?? '')
      setStravaConnected(!!strava)
      if (prof) {
        setProfile(prof)
        setForm({
          race_goal:           prof.race_goal            ?? '',
          race_distance:       prof.race_distance         ?? '',
          race_date:           prof.race_date             ?? '',
          weekly_km:           prof.weekly_km?.toString() ?? '',
          pb_5k:               prof.pb_5k                 ?? '',
          pb_10k:              prof.pb_10k                ?? '',
          pb_half:             prof.pb_half               ?? '',
          pb_marathon:         prof.pb_marathon            ?? '',
          available_days:      prof.available_days         ?? [],
          max_session_minutes: prof.max_session_minutes   ?? 60,
          injury_history:      prof.injury_history         ?? '',
          additional_goal:     prof.additional_goal        ?? '',
        })
      }
      setLoading(false)
    }
    load()
  }, [])

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
    setProfileChanged(true)
    setSaved(false)
  }

  function toggleDay(day: string) {
    set('available_days', form.available_days.includes(day)
      ? form.available_days.filter(d => d !== day)
      : [...form.available_days, day]
    )
  }

  async function save() {
    setSaving(true)
    setError(null)
    const res = await fetch('/api/profile/update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        weekly_km: form.weekly_km ? Number(form.weekly_km) : null,
        max_session_minutes: form.max_session_minutes,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Błąd zapisu')
    } else {
      setProfile(data.profile)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  async function disconnectStrava() {
    const supabase = createClient()
    await supabase.from('strava_tokens').delete().neq('user_id', '')
    setStravaConnected(false)
  }

  async function deleteAccount() {
    setDeleting(true)
    // Supabase doesn't allow client-side user deletion — send to support or use admin API
    // For now: sign out and show instruction
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login?deleted=1')
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
        <p className="text-sm" style={{ color: 'var(--text-2)' }}>Zarządzaj profilem i kontem</p>
      </div>

      <div className="flex flex-col gap-4">

        {/* ── 1. Profil biegacza ── */}
        <Section title="Profil biegacza">

          <Field label="Cel treningowy">
            <input
              value={form.race_goal}
              onChange={e => set('race_goal', e.target.value)}
              placeholder="np. Ukończyć maraton poniżej 4 godzin"
              style={inputStyle}
            />
          </Field>

          <Field label="Dystans docelowy">
            <div className="flex gap-2 flex-wrap">
              {DISTANCES.map(d => (
                <button key={d.id} onClick={() => set('race_distance', d.id)}
                  className="rounded-xl px-4 py-2 text-sm font-semibold transition-all"
                  style={{
                    background: form.race_distance === d.id ? 'var(--green)' : 'var(--surface2)',
                    color: form.race_distance === d.id ? '#000' : 'var(--text-2)',
                    border: `1px solid ${form.race_distance === d.id ? 'var(--green)' : 'var(--border)'}`,
                  }}>
                  {d.label}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Data zawodów">
              <input type="date" value={form.race_date}
                onChange={e => set('race_date', e.target.value)}
                style={inputStyle} />
            </Field>
            <Field label="Km / tydzień">
              <input type="number" value={form.weekly_km} min={0} max={300}
                onChange={e => set('weekly_km', e.target.value)}
                placeholder="np. 30" style={inputStyle} />
            </Field>
          </div>

          <Field label="Rekordy życiowe">
            <div className="space-y-2">
              {([
                { key: 'pb_5k',      label: '5 km',       ph: 'np. 23:45',   hint: 'MM:SS' },
                { key: 'pb_10k',     label: '10 km',      ph: 'np. 48:30',   hint: 'MM:SS' },
                { key: 'pb_half',    label: 'Półmaraton', ph: 'np. 1:52:30', hint: 'H:MM:SS' },
                { key: 'pb_marathon',label: 'Maraton',    ph: 'np. 3:45:00', hint: 'H:MM:SS' },
              ] as const).map(({ key, label, ph, hint }) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-xs w-24 shrink-0" style={{ color: 'var(--text-3)' }}>{label}</span>
                  <div className="relative flex-1">
                    <input
                      value={form[key]}
                      onChange={e => set(key, e.target.value)}
                      placeholder={ph}
                      style={{ ...inputStyle, paddingRight: 60 }}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
                      style={{ color: 'var(--text-3)' }}>{hint}</span>
                  </div>
                </div>
              ))}
            </div>
          </Field>

          <Field label="Dostępne dni treningowe">
            <div className="flex gap-2 flex-wrap">
              {DAYS.map(d => (
                <button key={d.id} onClick={() => toggleDay(d.id)}
                  className="w-12 h-10 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: form.available_days.includes(d.id) ? 'var(--green)' : 'var(--surface2)',
                    color: form.available_days.includes(d.id) ? '#000' : 'var(--text-2)',
                    border: `1px solid ${form.available_days.includes(d.id) ? 'var(--green)' : 'var(--border)'}`,
                  }}>
                  {d.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Maksymalny czas sesji">
            <div className="flex gap-2 flex-wrap">
              {SESSION_OPTS.map(s => (
                <button key={s.id} onClick={() => set('max_session_minutes', s.id)}
                  className="rounded-xl px-4 py-2 text-sm font-semibold transition-all"
                  style={{
                    background: form.max_session_minutes === s.id ? 'var(--orange)' : 'var(--surface2)',
                    color: form.max_session_minutes === s.id ? '#000' : 'var(--text-2)',
                    border: `1px solid ${form.max_session_minutes === s.id ? 'var(--orange)' : 'var(--border)'}`,
                  }}>
                  {s.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Historia kontuzji">
            <textarea value={form.injury_history}
              onChange={e => set('injury_history', e.target.value)}
              rows={2} placeholder="np. Ból kolana w 2024 (ustąpił)"
              style={{ ...inputStyle, resize: 'vertical' }} />
          </Field>

          <Field label="Cel dodatkowy">
            <input value={form.additional_goal}
              onChange={e => set('additional_goal', e.target.value)}
              placeholder="np. Schudnąć 5 kg, poprawić kondycję"
              style={inputStyle} />
          </Field>

          {/* Error */}
          {error && (
            <p className="text-sm rounded-xl px-4 py-3"
              style={{ background: 'var(--orange-dim)', color: 'var(--orange)' }}>
              {error}
            </p>
          )}

          {/* Save button */}
          <button onClick={save} disabled={saving}
            className="rounded-xl py-3 text-sm font-black uppercase tracking-widest transition-all hover:-translate-y-0.5"
            style={{
              fontFamily: 'var(--font-barlow-condensed), sans-serif',
              background: saved ? 'var(--green)' : 'var(--orange)',
              color: '#000',
              opacity: saving ? 0.7 : 1,
            }}>
            {saving ? 'Zapisywanie...' : saved ? '✓ Zapisano!' : 'Zapisz profil'}
          </button>
        </Section>

        {/* ── Plan regeneration banner ── */}
        {profileChanged && saved && (
          <div className="rounded-2xl p-4 flex items-center justify-between gap-4"
            style={{ background: 'var(--orange-dim)', border: '1px solid var(--orange)' }}>
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--orange)' }}>
                Profil zaktualizowany
              </p>
              <p className="text-xs" style={{ color: 'var(--text-2)' }}>
                Zregeneruj plan aby Claude uwzględnił nowe dane.
              </p>
            </div>
            <button
              onClick={() => router.push('/plan')}
              className="rounded-xl px-4 py-2 text-sm font-black uppercase tracking-widest flex-shrink-0"
              style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif', background: 'var(--orange)', color: '#000' }}>
              Plan →
            </button>
          </div>
        )}

        {/* ── 2. Konto ── */}
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

        {/* ── 3. Integracje ── */}
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
