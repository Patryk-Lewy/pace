'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { TrainingPlan } from '@/types/database'

const DISTANCE_LABELS: Record<string, string> = {
  '5km': '5 km', '10km': '10 km', half: 'Półmaraton', marathon: 'Maraton',
}

const PHASE_COLORS: Record<string, string> = {
  'Baza': 'var(--blue)',
  'Budowanie': 'var(--orange)',
  'Szczyt': 'var(--green)',
  'Tapering': 'var(--text-3)',
}

export default function PlanPage() {
  const router = useRouter()
  const [plan, setPlan] = useState<TrainingPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState('')

  useEffect(() => {
    loadPlan()
  }, [])

  async function loadPlan() {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('training_plans')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setPlan(data)
    setLoading(false)
  }

  async function generatePlan() {
    setGenerating(true)
    setError(null)
    setProgress('Claude analizuje Twój profil...')

    const messages = [
      'Claude analizuje Twój profil...',
      'Projektowanie tygodni treningowych...',
      'Budowanie faz: Baza → Budowanie → Szczyt → Tapering...',
      'Dopasowywanie tempa i dystansów...',
      'Finalizowanie planu...',
    ]
    let i = 0
    const interval = setInterval(() => {
      i = (i + 1) % messages.length
      setProgress(messages[i])
    }, 3000)

    try {
      const res = await fetch('/api/generate-plan', { method: 'POST' })
      const data = await res.json()
      clearInterval(interval)

      if (!res.ok) {
        setError(data.error ?? 'Błąd generowania planu')
        setGenerating(false)
        return
      }

      await loadPlan()
      setGenerating(false)
      setProgress('')
    } catch {
      clearInterval(interval)
      setError('Błąd połączenia z serwerem')
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm" style={{ color: 'var(--text-3)' }}>Ładowanie...</div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl animate-fade-up">
      <div className="mb-8">
        <h1 className="text-5xl font-black mb-1" style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif' }}>
          Plan treningowy
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-2)' }}>
          Wygenerowany przez Claude AI na podstawie Twojego profilu
        </p>
      </div>

      {/* No plan yet */}
      {!plan && !generating && (
        <div className="rounded-2xl p-10 flex flex-col items-center text-center"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="text-5xl mb-6">🤖</div>
          <h2 className="text-3xl font-black mb-3" style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif' }}>
            Brak aktywnego planu
          </h2>
          <p className="text-sm mb-8 max-w-sm" style={{ color: 'var(--text-2)' }}>
            Claude przeanalizuje Twój profil biegacza i wygeneruje spersonalizowany plan treningowy.
          </p>
          {error && (
            <p className="text-sm rounded-xl px-4 py-3 mb-4 w-full max-w-sm"
              style={{ background: 'var(--orange-dim)', color: 'var(--orange)' }}>
              {error}
            </p>
          )}
          <button onClick={generatePlan}
            className="rounded-xl px-8 py-4 text-base font-black uppercase tracking-widest transition-all hover:-translate-y-0.5"
            style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif', background: 'var(--green)', color: '#000' }}>
            Wygeneruj mój plan →
          </button>
        </div>
      )}

      {/* Generating */}
      {generating && (
        <div className="rounded-2xl p-10 flex flex-col items-center text-center"
          style={{ background: 'var(--surface)', border: '1px solid var(--green)' }}>
          <div className="text-5xl mb-6 animate-pulse">⚡</div>
          <h2 className="text-3xl font-black mb-3" style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif', color: 'var(--green)' }}>
            Generowanie planu...
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>{progress}</p>
          <div className="mt-6 w-48 h-1 rounded-full overflow-hidden" style={{ background: 'var(--surface3)' }}>
            <div className="h-1 rounded-full animate-pulse" style={{ background: 'var(--green)', width: '60%' }} />
          </div>
        </div>
      )}

      {/* Plan exists */}
      {plan && !generating && (
        <PlanView plan={plan} onRegenerate={generatePlan} onCalendar={() => router.push('/calendar')} />
      )}
    </div>
  )
}

// ─── Plan View ────────────────────────────────────────────────────────────────

type PlanJson = {
  plan_name: string
  total_weeks: number
  weeks: Array<{
    week_number: number
    phase: string
    focus: string
    total_km: number
    workouts: Array<{
      day: string
      workout_type: string
      title: string
      distance_km: number | null
      target_pace: string | null
      duration_minutes: number | null
      description: string
    }>
  }>
}

// ─── Garmin Sync Modal ────────────────────────────────────────────────────────

function getTokenExpiry(token: string): Date | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return new Date(payload.exp * 1000)
  } catch { return null }
}

function GarminSyncModal({ planId, onClose }: { planId: string; onClose: () => void }) {
  const [token, setToken] = useState<string | null>(null)
  const [script, setScript] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showFallback, setShowFallback] = useState(false)
  const [copied, setCopied] = useState(false)
  const textRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token ?? null
      setToken(accessToken)

      // Also pre-fetch the script (for fallback console method)
      try {
        const r = await fetch('/api/garmin/sync-script')
        setScript(await r.text())
      } catch { setScript(null) }

      setLoading(false)
    }
    init()
  }, [planId])

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const bookmarkletHref = token
    ? `javascript:(function(){var t='${token}';fetch('${origin}/api/garmin/sync-script',{headers:{'Authorization':'Bearer '+t}}).then(function(r){return r.text()}).then(eval).catch(function(e){alert('PACE Sync Error: '+e.message)})})();`
    : null

  const expiry = token ? getTokenExpiry(token) : null
  const expiryStr = expiry ? expiry.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : null

  async function copyScript() {
    if (!script) return
    try { await navigator.clipboard.writeText(script) }
    catch { textRef.current?.select(); document.execCommand('copy') }
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-2xl rounded-2xl p-6 flex flex-col gap-5"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', maxHeight: '90vh', overflow: 'auto' }}>

        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black" style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif' }}>
            ⌚ Sync z Garmin Connect
          </h2>
          <button onClick={onClose} className="text-xl" style={{ color: 'var(--text-3)' }}>✕</button>
        </div>

        {/* ── BOOKMARKLET (primary) ── */}
        <div className="rounded-2xl p-5 flex flex-col gap-4"
          style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>

          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{ background: 'var(--green)', color: '#000' }}>Zalecane</span>
            <span className="text-sm font-bold">Zakładka przeglądarki</span>
          </div>

          {/* Steps */}
          <div className="space-y-2">
            {[
              'Przeciągnij przycisk poniżej do paska zakładek',
              'Otwórz connect.garmin.com i zaloguj się',
              'Kliknij zakładkę „PACE Sync" — gotowe!',
            ].map((text, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-black"
                  style={{ background: 'var(--green)', color: '#000' }}>{i + 1}</span>
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>{text}</p>
              </div>
            ))}
          </div>

          {/* Draggable bookmarklet */}
          {loading ? (
            <div className="rounded-xl py-3 text-sm text-center" style={{ background: 'var(--surface3)', color: 'var(--text-3)' }}>
              Generowanie linku...
            </div>
          ) : bookmarkletHref ? (
            <div className="flex flex-col items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a
                href={bookmarkletHref}
                draggable
                onClick={e => { e.preventDefault(); alert('Przeciągnij ten przycisk do paska zakładek przeglądarki 👆') }}
                className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-black uppercase tracking-widest cursor-grab transition-all hover:-translate-y-0.5 select-none"
                style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif', background: 'var(--orange)', color: '#000', border: '2px dashed rgba(0,0,0,0.2)' }}>
                ⌚ PACE Sync
              </a>
              {expiryStr && (
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                  Link ważny do {expiryStr} · odśwież stronę po wygaśnięciu
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-center" style={{ color: 'var(--orange)' }}>Błąd generowania linku — odśwież stronę</p>
          )}
        </div>

        {/* ── FALLBACK toggle ── */}
        <button onClick={() => setShowFallback(v => !v)}
          className="text-xs text-left transition-all"
          style={{ color: 'var(--text-3)' }}>
          {showFallback ? '▲' : '▼'} Alternatywnie: konsola przeglądarki (F12)
        </button>

        {showFallback && (
          <div className="flex flex-col gap-3">
            <div className="space-y-2">
              {[
                'Otwórz connect.garmin.com → zaloguj się',
                'Naciśnij F12 → zakładka „Console"',
                'Wklej skrypt poniżej i naciśnij Enter',
              ].map((text, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-black"
                    style={{ background: 'var(--surface3)', color: 'var(--text-2)' }}>{i + 1}</span>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>{text}</p>
                </div>
              ))}
            </div>
            <textarea
              ref={textRef}
              readOnly
              value={script ?? 'Błąd pobierania skryptu'}
              rows={6}
              className="w-full rounded-xl p-3 text-xs font-mono resize-none"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
            />
            <div className="flex gap-3">
              <button onClick={copyScript} disabled={!script}
                className="flex-1 rounded-xl py-3 text-sm font-black uppercase tracking-widest transition-all hover:-translate-y-0.5"
                style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif', background: copied ? 'var(--green)' : 'var(--surface3)', color: copied ? '#000' : 'var(--text-2)' }}>
                {copied ? '✓ Skopiowano!' : '📋 Kopiuj skrypt'}
              </button>
              <a href="https://connect.garmin.com" target="_blank" rel="noopener noreferrer"
                className="rounded-xl px-5 py-3 text-sm font-semibold flex items-center gap-1.5 transition-all"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                Otwórz Garmin →
              </a>
            </div>
          </div>
        )}

        <p className="text-xs text-center" style={{ color: 'var(--text-3)' }}>
          Dane trafiają wyłącznie na Twoje konto Garmin Connect.
        </p>
      </div>
    </div>
  )
}

// ─── Plan View ────────────────────────────────────────────────────────────────

function PlanView({ plan, onRegenerate, onCalendar }: {
  plan: TrainingPlan
  onRegenerate: () => void
  onCalendar: () => void
}) {
  const [showGarminSync, setShowGarminSync] = useState(false)
  const planJson = plan.plan_json as unknown as PlanJson

  // Group weeks by phase
  const phases: Record<string, typeof planJson.weeks> = {}
  planJson.weeks.forEach(w => {
    if (!phases[w.phase]) phases[w.phase] = []
    phases[w.phase].push(w)
  })

  return (
    <div className="space-y-6">
      {showGarminSync && <GarminSyncModal planId={plan.id} onClose={() => setShowGarminSync(false)} />}

      {/* Header card */}
      <div className="rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div>
          <h2 className="text-2xl font-black" style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif' }}>
            {planJson.plan_name}
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>
            {planJson.total_weeks} tygodni · {DISTANCE_LABELS[plan.race_distance] ?? plan.race_distance}
            {plan.race_date && ` · Cel: ${plan.race_date}`}
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <button onClick={onCalendar}
            className="rounded-xl px-5 py-2.5 text-sm font-bold transition-all"
            style={{ background: 'var(--green)', color: '#000', fontFamily: 'var(--font-barlow-condensed), sans-serif' }}>
            Kalendarz →
          </button>
          <button onClick={() => setShowGarminSync(true)}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold transition-all flex items-center gap-1.5 hover:-translate-y-0.5"
            style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
            ⌚ Sync Garmin
          </button>
          <button onClick={onRegenerate}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold transition-all"
            style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
            Regeneruj
          </button>
        </div>
      </div>

      {/* Phase overview */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Object.entries(phases).map(([phase, weeks]) => (
          <div key={phase} className="rounded-2xl p-4"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="w-2 h-2 rounded-full mb-3" style={{ background: PHASE_COLORS[phase] ?? 'var(--text-3)' }} />
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--text-3)' }}>
              {phase}
            </p>
            <p className="text-2xl font-black" style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif' }}>
              {weeks.length} tyg.
            </p>
          </div>
        ))}
      </div>

      {/* Weekly breakdown */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
          Tygodnie
        </h3>
        {planJson.weeks.map(week => (
          <div key={week.week_number} className="rounded-2xl p-5"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full"
                  style={{ background: 'var(--surface2)', color: 'var(--text-3)' }}>
                  Tyg. {week.week_number}
                </span>
                <span className="text-xs font-semibold px-3 py-1 rounded-full"
                  style={{ color: PHASE_COLORS[week.phase] ?? 'var(--text-3)', background: 'var(--surface2)' }}>
                  {week.phase}
                </span>
              </div>
              <span className="text-xl font-black" style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif', color: 'var(--green)' }}>
                {week.total_km} km
              </span>
            </div>
            <p className="text-xs mb-3" style={{ color: 'var(--text-2)' }}>{week.focus}</p>
            <div className="flex flex-wrap gap-2">
              {week.workouts.filter(w => w.workout_type !== 'rest').map((w, i) => (
                <WorkoutChip key={i} workout={w} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function WorkoutChip({ workout }: { workout: { workout_type: string; title: string; distance_km: number | null; target_pace: string | null } }) {
  const COLOR: Record<string, string> = {
    easy_run: 'var(--blue)',
    long_run: 'var(--blue)',
    tempo: 'var(--orange)',
    intervals: 'var(--orange)',
    rest: 'var(--text-3)',
  }
  const BG: Record<string, string> = {
    easy_run: 'var(--blue-dim)',
    long_run: 'var(--blue-dim)',
    tempo: 'var(--orange-dim)',
    intervals: 'var(--orange-dim)',
    rest: 'var(--surface3)',
  }
  return (
    <div className="rounded-xl px-3 py-1.5 text-xs font-semibold"
      style={{ background: BG[workout.workout_type] ?? 'var(--surface2)', color: COLOR[workout.workout_type] ?? 'var(--text-2)' }}>
      {workout.title}
      {workout.distance_km && ` · ${workout.distance_km} km`}
    </div>
  )
}
