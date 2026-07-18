'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS = [
  { id: 'mon', label: 'Pon' },
  { id: 'tue', label: 'Wt' },
  { id: 'wed', label: 'Śr' },
  { id: 'thu', label: 'Czw' },
  { id: 'fri', label: 'Pt' },
  { id: 'sat', label: 'Sob' },
  { id: 'sun', label: 'Ndz' },
]

const DISTANCES = [
  { id: '5km',      label: '5 km',       emoji: '🏃' },
  { id: '10km',     label: '10 km',      emoji: '🏃' },
  { id: 'half',     label: 'Półmaraton', emoji: '🏅' },
  { id: 'marathon', label: 'Maraton',    emoji: '🏆' },
]

const SESSION_DURATIONS = [
  { id: 30,  label: '30 min' },
  { id: 45,  label: '45 min' },
  { id: 60,  label: '60 min' },
  { id: 90,  label: '90 min' },
  { id: 120, label: '2 godz+' },
]

const PACE_RE = /^\d+:[0-5]\d$/
const TIME_RE = /^\d+:[0-5]\d:[0-5]\d$|^\d+:[0-5]\d$/   // H:MM:SS or MM:SS

// ─── Form types ───────────────────────────────────────────────────────────────

type FormData = {
  race_distance: string
  race_date: string
  race_goal_time: string
  pb_5k: string
  pb_10k: string
  pb_half: string
  pb_marathon: string
  weekly_km: string
  available_days: string[]
  max_session_minutes: number
  injury_history: string
  additional_goal: string
}

const INITIAL: FormData = {
  race_distance: '',
  race_date: '',
  race_goal_time: '',
  pb_5k: '',
  pb_10k: '',
  pb_half: '',
  pb_marathon: '',
  weekly_km: '',
  available_days: [],
  max_session_minutes: 60,
  injury_history: '',
  additional_goal: '',
}

// Steps: 0=welcome, 1=cel, 2=rekordy, 3=dostępność, 4=historia, 5=podsumowanie
// After step 5: loading (generating plan), then step 6=sukces (Strava)
const STEPS = [
  { title: 'Cześć!',        subtitle: 'Zanim zaczniemy — kilka słów o PACE' },
  { title: 'Twój cel',      subtitle: 'Na co trenujesz?' },
  { title: 'Rekordy',       subtitle: 'Twoje najlepsze czasy (opcjonalnie)' },
  { title: 'Dostępność',    subtitle: 'Kiedy możesz trenować?' },
  { title: 'Kontekst',      subtitle: 'Ważne dla Twojego planu' },
  { title: 'Podsumowanie',  subtitle: 'Sprawdź dane i zbuduj plan' },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormData>(INITIAL)
  const [generating, setGenerating] = useState(false)
  const [genStep, setGenStep] = useState(0)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function toggleDay(day: string) {
    set('available_days', form.available_days.includes(day)
      ? form.available_days.filter(d => d !== day)
      : [...form.available_days, day]
    )
  }

  // Validate PB fields on step 2
  function pbError(): string | null {
    const fields: [string, string][] = [
      [form.pb_5k, '5 km'], [form.pb_10k, '10 km'],
    ]
    for (const [val, label] of fields) {
      if (val && !PACE_RE.test(val.trim()) && !TIME_RE.test(val.trim())) {
        return `Format dla ${label}: MM:SS (np. 23:45)`
      }
    }
    const longFields: [string, string][] = [
      [form.pb_half, 'półmaraton'], [form.pb_marathon, 'maraton'],
    ]
    for (const [val, label] of longFields) {
      if (val && !TIME_RE.test(val.trim())) {
        return `Format dla ${label}: H:MM:SS (np. 1:52:30)`
      }
    }
    return null
  }

  async function finish() {
    setError(null)
    setGenerating(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // 1. Save profile
    const { error: saveErr } = await supabase
      .from('runner_profiles')
      .update({
        race_distance:       form.race_distance,
        race_date:           form.race_date || null,
        race_goal_time:      form.race_goal_time.trim() || null,
        pb_5k:               form.pb_5k.trim() || null,
        pb_10k:              form.pb_10k.trim() || null,
        pb_half:             form.pb_half.trim() || null,
        pb_marathon:         form.pb_marathon.trim() || null,
        weekly_km:           form.weekly_km ? parseFloat(form.weekly_km) : null,
        available_days:      form.available_days,
        max_session_minutes: form.max_session_minutes,
        injury_history:      form.injury_history || null,
        additional_goal:     form.additional_goal || null,
        onboarding_completed: true,
        onboarding_step: 5,
      })
      .eq('id', user.id)

    if (saveErr) {
      setError(saveErr.message)
      setGenerating(false)
      return
    }

    // 2. Animate loading steps
    const genMessages = [
      'Analizuję Twój profil...',
      'Obliczam strefy treningowe...',
      'Układam tygodnie treningowe...',
      'Finalizuję plan...',
    ]
    setGenStep(0)
    for (let i = 0; i < genMessages.length - 1; i++) {
      await delay(900)
      setGenStep(i + 1)
    }

    // 3. Generate plan
    const res = await fetch('/api/generate-plan', { method: 'POST' })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Błąd generowania planu')
      setGenerating(false)
      return
    }

    // Mark last step complete before transitioning
    setGenStep(genMessages.length)
    await delay(400)
    setGenerating(false)
    setDone(true)
  }

  const progress = (step / (STEPS.length - 1)) * 100

  // ── Loading screen ──────────────────────────────────────────────────────────
  if (generating) {
    const messages = [
      'Analizuję Twój profil...',
      'Obliczam strefy treningowe...',
      'Układam tygodnie treningowe...',
      'Finalizuję plan...',
    ]
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6"
        style={{ background: 'var(--bg)' }}>
        <div className="w-full max-w-sm text-center">
          <div className="text-5xl mb-6">🤖</div>
          <h2 className="text-3xl font-black mb-2"
            style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif' }}>
            PACE buduje Twój plan
          </h2>
          <p className="text-sm mb-10" style={{ color: 'var(--text-2)' }}>
            Claude analizuje Twoje dane i układa spersonalizowany plan treningowy
          </p>

          <div className="space-y-3 text-left mb-8">
            {messages.map((msg, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-xs"
                  style={{
                    background: i <= genStep ? 'var(--green)' : 'var(--surface2)',
                    color: i <= genStep ? '#000' : 'var(--text-3)',
                    transition: 'background 0.4s',
                  }}>
                  {i < genStep ? '✓' : i === genStep ? '⟳' : ''}
                </div>
                <span className="text-sm transition-all"
                  style={{ color: i <= genStep ? 'var(--text)' : 'var(--text-3)' }}>
                  {msg}
                </span>
              </div>
            ))}
          </div>

          <div className="h-1 rounded-full" style={{ background: 'var(--surface3)' }}>
            <div className="h-1 rounded-full transition-all duration-700"
              style={{ width: `${(genStep / (messages.length - 1)) * 100}%`, background: 'var(--green)' }} />
          </div>
        </div>
      </div>
    )
  }

  // ── Success screen (Strava connect) ─────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6"
        style={{ background: 'var(--bg)' }}>
        <div className="w-full max-w-sm text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-4xl font-black mb-2"
            style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif', color: 'var(--green)' }}>
            Plan gotowy!
          </h2>
          <p className="text-sm mb-10" style={{ color: 'var(--text-2)' }}>
            Claude ułożył dla Ciebie spersonalizowany plan treningowy.
          </p>

          {/* Strava CTA */}
          <div className="rounded-2xl p-5 mb-4 text-left"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p className="text-sm font-bold mb-1">Połącz Stravę — polecamy!</p>
            <p className="text-xs mb-4" style={{ color: 'var(--text-2)' }}>
              PACE automatycznie pobierze Twoje biegi, porówna je z planem i skomentuje każdy trening przez AI.
            </p>
            <a href="/api/strava/connect"
              className="w-full rounded-xl py-3 text-sm font-black uppercase tracking-widest text-center transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2"
              style={{ background: '#FC4C02', color: '#fff', fontFamily: 'var(--font-barlow-condensed), sans-serif', display: 'flex' }}>
              🔗 Połącz Stravę
            </a>
          </div>

          <button
            onClick={() => router.push('/plan')}
            className="w-full rounded-xl py-3 text-sm font-semibold transition-all hover:opacity-80"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
            Przejdź do planu →
          </button>
        </div>
      </div>
    )
  }

  // ── Main onboarding flow ────────────────────────────────────────────────────
  const pbErr = step === 2 ? pbError() : null

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Top bar */}
      <div className="px-6 pt-8 pb-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xl font-black tracking-widest uppercase"
            style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif', color: 'var(--green)' }}>
            PACE
          </span>
          {step > 0 && (
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>
              {step} / {STEPS.length - 1}
            </span>
          )}
        </div>
        {step > 0 && (
          <div className="h-1 rounded-full" style={{ background: 'var(--surface3)' }}>
            <div className="h-1 rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, background: 'var(--green)' }} />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
        <div className="w-full max-w-lg animate-fade-up">
          <h2 className="text-4xl font-black mb-1"
            style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif' }}>
            {STEPS[step].title}
          </h2>
          <p className="text-sm mb-8" style={{ color: 'var(--text-2)' }}>
            {STEPS[step].subtitle}
          </p>

          {/* ── Step 0: Welcome ── */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="rounded-2xl p-5"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-2)' }}>
                  <b style={{ color: 'var(--text)' }}>PACE</b> to AI trener biegowy oparty na Claude.
                  Analizuje Twój profil, historię biegów i postępy — i układa plan, który naprawdę
                  pasuje do Twojego życia.
                </p>
                <div className="space-y-2">
                  {[
                    ['🤖', 'Plan treningowy generowany przez Claude AI'],
                    ['🏃', 'Nagrywanie biegów GPS z głosowym trenerem'],
                    ['💬', 'Czat z trenerem AI, który zna Twoje treningi'],
                    ['📊', 'Automatyczna analiza każdego biegu ze Stravy'],
                    ['📈', 'Adaptacja planu na podstawie Twoich wyników'],
                  ].map(([emoji, text]) => (
                    <div key={text} className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-2)' }}>
                      <span>{emoji}</span>
                      <span>{text}</span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-center" style={{ color: 'var(--text-3)' }}>
                Zajmie Ci to około 2 minut.
              </p>
            </div>
          )}

          {/* ── Step 1: Cel ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-3"
                  style={{ color: 'var(--text-3)' }}>
                  Docelowy dystans
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {DISTANCES.map(d => (
                    <button key={d.id} onClick={() => set('race_distance', d.id)}
                      className="press rounded-xl py-4 text-sm font-bold transition-all"
                      style={{
                        background: form.race_distance === d.id ? 'var(--green-dim)' : 'var(--surface)',
                        border: `1px solid ${form.race_distance === d.id ? 'var(--green)' : 'var(--border)'}`,
                        color: form.race_distance === d.id ? 'var(--green)' : 'var(--text)',
                      }}>
                      {d.emoji} {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2"
                  style={{ color: 'var(--text-3)' }}>
                  Cel czasowy (opcjonalnie)
                </label>
                <div className="relative">
                  <input type="text" value={form.race_goal_time}
                    onChange={e => set('race_goal_time', e.target.value)}
                    placeholder="np. 3:30:00"
                    className="w-full rounded-xl px-4 py-3 text-sm outline-none pr-20"
                    style={{
                      background: 'var(--surface)',
                      border: `1px solid ${form.race_goal_time && TIME_RE.test(form.race_goal_time.trim()) ? 'var(--green)' : 'var(--border)'}`,
                      color: 'var(--text)',
                    }} />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs"
                    style={{ color: 'var(--text-3)' }}>H:MM:SS</span>
                </div>
                <p className="mt-1.5 text-xs" style={{ color: 'var(--text-3)' }}>
                  Claude dobierze tempa treningowe pod ten wynik
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2"
                  style={{ color: 'var(--text-3)' }}>
                  Data zawodów / celu (opcjonalnie)
                </label>
                <input type="date" value={form.race_date}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => set('race_date', e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', colorScheme: 'dark' }} />
                <p className="mt-1.5 text-xs" style={{ color: 'var(--text-3)' }}>
                  Od tej daty zależy długość planu — tapering wypadnie tuż przed startem
                </p>
              </div>
            </div>
          )}

          {/* ── Step 2: Rekordy życiowe ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-xl px-4 py-3 text-xs"
                style={{ background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid rgba(0,230,118,0.2)' }}>
                Na podstawie Twoich rekordów Claude obliczy optymalne tempa treningowe (metoda VDOT).
                Wszystkie pola są opcjonalne, ale im więcej podasz, tym trafniejsze tempa.
              </div>

              {([
                { key: 'pb_5k',      label: '5 km',       placeholder: 'np. 23:45',   hint: 'MM:SS' },
                { key: 'pb_10k',     label: '10 km',      placeholder: 'np. 48:30',   hint: 'MM:SS' },
                { key: 'pb_half',    label: 'Półmaraton', placeholder: 'np. 1:52:30', hint: 'H:MM:SS' },
                { key: 'pb_marathon',label: 'Maraton',    placeholder: 'np. 3:45:00', hint: 'H:MM:SS' },
              ] as const).map(({ key, label, placeholder, hint }) => (
                <div key={key} className="flex items-center gap-3">
                  <label className="text-sm font-semibold shrink-0 w-24"
                    style={{ color: 'var(--text-2)' }}>
                    {label}
                  </label>
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={form[key]}
                      onChange={e => set(key, e.target.value)}
                      placeholder={placeholder}
                      className="w-full rounded-xl px-4 py-3 text-sm outline-none pr-16"
                      style={{
                        background: 'var(--surface)',
                        border: `1px solid ${form[key] && (PACE_RE.test(form[key].trim()) || TIME_RE.test(form[key].trim())) ? 'var(--green)' : 'var(--border)'}`,
                        color: 'var(--text)',
                      }} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
                      style={{ color: 'var(--text-3)' }}>
                      {hint}
                    </span>
                  </div>
                </div>
              ))}

              {pbErr && (
                <p className="text-xs rounded-xl px-4 py-2"
                  style={{ background: 'var(--orange-dim)', color: 'var(--orange)' }}>
                  {pbErr}
                </p>
              )}

              <div className="border-t pt-4" style={{ borderColor: 'var(--border)' }}>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2"
                  style={{ color: 'var(--text-3)' }}>
                  Tygodniowy kilometraż (opcjonalnie)
                </label>
                <div className="relative">
                  <input type="number" value={form.weekly_km}
                    onChange={e => set('weekly_km', e.target.value)}
                    placeholder="np. 30" min={0}
                    className="w-full rounded-xl px-4 py-3 text-sm outline-none pr-16"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs"
                    style={{ color: 'var(--text-3)' }}>km/tyg</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Dostępność ── */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-3"
                  style={{ color: 'var(--text-3)' }}>
                  Dostępne dni w tygodniu
                </label>
                <div className="flex gap-2 flex-wrap">
                  {DAYS.map(d => (
                    <button key={d.id} onClick={() => toggleDay(d.id)}
                      className="press rounded-xl px-4 py-2 text-sm font-semibold transition-all"
                      style={{
                        background: form.available_days.includes(d.id) ? 'var(--green-dim)' : 'var(--surface)',
                        border: `1px solid ${form.available_days.includes(d.id) ? 'var(--green)' : 'var(--border)'}`,
                        color: form.available_days.includes(d.id) ? 'var(--green)' : 'var(--text-2)',
                      }}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-3"
                  style={{ color: 'var(--text-3)' }}>
                  Maksymalny czas sesji
                </label>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {SESSION_DURATIONS.map(d => (
                    <button key={d.id} onClick={() => set('max_session_minutes', d.id)}
                      className="press rounded-xl py-3 text-sm font-semibold transition-all"
                      style={{
                        background: form.max_session_minutes === d.id ? 'var(--green-dim)' : 'var(--surface)',
                        border: `1px solid ${form.max_session_minutes === d.id ? 'var(--green)' : 'var(--border)'}`,
                        color: form.max_session_minutes === d.id ? 'var(--green)' : 'var(--text-2)',
                      }}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 4: Kontekst ── */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2"
                  style={{ color: 'var(--text-3)' }}>
                  Historia kontuzji (opcjonalnie)
                </label>
                <textarea value={form.injury_history}
                  onChange={e => set('injury_history', e.target.value)}
                  placeholder="np. Kolano biegacza (2024), przeciążenie ścięgna Achillesa..."
                  rows={3}
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2"
                  style={{ color: 'var(--text-3)' }}>
                  Cel dodatkowy (opcjonalnie)
                </label>
                <input type="text" value={form.additional_goal}
                  onChange={e => set('additional_goal', e.target.value)}
                  placeholder="np. Schudnąć 5 kg, poprawić postawę..."
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
              </div>
            </div>
          )}

          {/* ── Step 5: Podsumowanie ── */}
          {step === 5 && (
            <div className="rounded-2xl p-5 space-y-3"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <SummaryRow label="Dystans"
                value={DISTANCES.find(d => d.id === form.race_distance)?.label ?? '—'} />
              {form.race_goal_time && <SummaryRow label="Cel czasowy" value={form.race_goal_time} />}
              {form.race_date && <SummaryRow label="Data zawodów" value={form.race_date} />}
              {form.pb_5k     && <SummaryRow label="Rekord 5 km"       value={form.pb_5k} />}
              {form.pb_10k    && <SummaryRow label="Rekord 10 km"      value={form.pb_10k} />}
              {form.pb_half   && <SummaryRow label="Rekord półmaraton" value={form.pb_half} />}
              {form.pb_marathon && <SummaryRow label="Rekord maraton"  value={form.pb_marathon} />}
              {form.weekly_km && <SummaryRow label="Km / tydzień"      value={`${form.weekly_km} km`} />}
              <SummaryRow label="Dni treningowe"
                value={form.available_days.map(d => DAYS.find(x => x.id === d)?.label).join(', ') || '—'} />
              <SummaryRow label="Max sesja"
                value={SESSION_DURATIONS.find(d => d.id === form.max_session_minutes)?.label ?? '—'} />
              {form.injury_history   && <SummaryRow label="Kontuzje"       value={form.injury_history} />}
              {form.additional_goal  && <SummaryRow label="Cel dodatkowy"  value={form.additional_goal} />}
            </div>
          )}

          {error && (
            <p className="mt-4 text-sm rounded-xl px-4 py-3"
              style={{ background: 'var(--orange-dim)', color: 'var(--orange)' }}>
              {error}
            </p>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-8">
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)}
                className="press flex-1 rounded-xl py-3 text-sm font-semibold transition-all"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                Wstecz
              </button>
            )}

            {step < STEPS.length - 1 ? (
              <button
                onClick={() => { if (!pbErr) setStep(s => s + 1) }}
                disabled={
                  (step === 1 && !form.race_distance) ||
                  (step === 2 && !!pbErr) ||
                  (step === 3 && form.available_days.length === 0)
                }
                className="press flex-1 rounded-xl py-3 text-sm font-black uppercase tracking-widest transition-all"
                style={{
                  fontFamily: 'var(--font-barlow-condensed), sans-serif',
                  background: (
                    (step === 1 && !form.race_distance) ||
                    (step === 2 && !!pbErr) ||
                    (step === 3 && form.available_days.length === 0)
                  ) ? 'var(--surface3)' : 'var(--green)',
                  color: (
                    (step === 1 && !form.race_distance) ||
                    (step === 2 && !!pbErr) ||
                    (step === 3 && form.available_days.length === 0)
                  ) ? 'var(--text-3)' : '#000',
                  cursor: (
                    (step === 1 && !form.race_distance) ||
                    (step === 2 && !!pbErr) ||
                    (step === 3 && form.available_days.length === 0)
                  ) ? 'not-allowed' : 'pointer',
                }}>
                {step === 0 ? 'Zaczynamy →' : 'Dalej →'}
              </button>
            ) : (
              <button onClick={finish}
                className="press flex-1 rounded-xl py-3 text-sm font-black uppercase tracking-widest transition-all hover:-translate-y-0.5"
                style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif', background: 'var(--green)', color: '#000' }}>
                🤖 Zbuduj mój plan →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-xs font-semibold uppercase tracking-widest shrink-0"
        style={{ color: 'var(--text-3)' }}>
        {label}
      </span>
      <span className="text-sm text-right" style={{ color: 'var(--text)' }}>
        {value}
      </span>
    </div>
  )
}
