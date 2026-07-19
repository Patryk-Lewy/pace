'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PlanParamsEditor from '@/components/PlanParamsEditor'
import { metaFor } from '@/lib/workout-meta'
import { planStartMonday } from '@/lib/workout-matching'
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

/** 1-based training week that "now" falls into, based on the shared plan anchor. */
function currentWeekNumber(createdAt: string, totalWeeks: number): number {
  const start = planStartMonday(createdAt)
  const weeks = Math.floor((Date.now() - start.getTime()) / (7 * 86_400_000)) + 1
  return Math.min(Math.max(weeks, 1), totalWeeks)
}

export default function PlanClient({ plan, archivedPlans }: {
  plan: TrainingPlan | null
  archivedPlans: TrainingPlan[]
}) {
  const router = useRouter()
  const [showArchive, setShowArchive] = useState(false)
  const loadPlan = () => router.refresh()

  return (
    <div className="animate-fade-up">
      {/* No plan yet */}
      {!plan && (
        <div className="flex flex-col" style={{ gap: 16, paddingTop: 20 }}>
          <div className="kick" style={{ fontSize: 10, color: 'var(--green)' }}>Plan treningowy</div>
          <div className="flex flex-col items-center text-center"
            style={{ borderRadius: 26, padding: 32, background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🤖</div>
            <div className="cond" style={{ fontSize: 26, marginBottom: 8 }}>Brak aktywnego planu</div>
            <p style={{ font: '500 13px var(--font-barlow)', color: 'var(--text-2)' }}>
              Ustaw parametry poniżej i wygeneruj spersonalizowany plan treningowy.
            </p>
          </div>
          <PlanParamsEditor hasPlan={false} onRebuilt={loadPlan} />
        </div>
      )}

      {/* Plan exists */}
      {plan && (
        <div className="flex flex-col" style={{ gap: 24 }}>
          <PlanView plan={plan} onCalendar={() => router.push('/calendar')} />
          <CollapsibleEditor onRebuilt={loadPlan} />
        </div>
      )}

      {/* Archived plans */}
      {archivedPlans.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <button
            onClick={() => setShowArchive(v => !v)}
            className="flex items-center press"
            style={{ gap: 8, font: '600 13px var(--font-barlow)', color: 'var(--text-3)', marginBottom: 12, background: 'none', border: 'none' }}>
            {showArchive ? '▲' : '▼'} Archiwum planów ({archivedPlans.length})
          </button>

          {showArchive && (
            <div className="flex flex-col" style={{ gap: 8 }}>
              {archivedPlans.map(p => (
                <div key={p.id} className="flex items-center justify-between"
                  style={{ borderRadius: 18, padding: '14px 18px', background: 'var(--surface)', border: '1px solid var(--border)', opacity: 0.7 }}>
                  <div>
                    <p style={{ font: '700 14px var(--font-barlow)' }}>{p.plan_name}</p>
                    <p style={{ font: '500 11px var(--font-barlow)', color: 'var(--text-3)', marginTop: 2 }}>
                      {DISTANCE_LABELS[p.race_distance] ?? p.race_distance} · {p.total_weeks} tygodni
                      {p.race_date && ` · ${p.race_date}`}
                    </p>
                  </div>
                  <span style={{ font: '600 11px var(--font-barlow)', padding: '4px 10px', borderRadius: 20, background: 'var(--surface2)', color: 'var(--text-3)' }}>
                    Archiwalny
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
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

/** Plan params form tucked behind a toggle — it's a rarely-used, tall form. */
function CollapsibleEditor({ onRebuilt }: { onRebuilt: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button onClick={() => setOpen(o => !o)} className="press flex items-center justify-between"
        style={{ width: '100%', borderRadius: 18, padding: '15px 18px', background: 'var(--surface)', border: '1px solid var(--border)', textAlign: 'left' }}>
        <div>
          <div style={{ font: '700 14px var(--font-barlow)', color: 'var(--text)' }}>⚙️ Parametry planu</div>
          <div style={{ font: '500 12px var(--font-barlow)', color: 'var(--text-3)' }}>Cel, dni, rekordy · przebudowa zachowuje ukończone treningi</div>
        </div>
        <span style={{ color: 'var(--text-3)', fontSize: 11 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ marginTop: 12 }}>
          <PlanParamsEditor hasPlan={true} onRebuilt={onRebuilt} />
        </div>
      )}
    </div>
  )
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

function PlanView({ plan, onCalendar }: {
  plan: TrainingPlan
  onCalendar: () => void
}) {
  const [showGarminSync, setShowGarminSync] = useState(false)
  const planJson = plan.plan_json as unknown as PlanJson

  const curWeek = currentWeekNumber(plan.created_at, planJson.total_weeks)
  const currentPhase = planJson.weeks.find(w => w.week_number === curWeek)?.phase ?? null

  // Group weeks by phase (insertion order preserves Baza→Budowanie→…)
  const phases: Record<string, typeof planJson.weeks> = {}
  planJson.weeks.forEach(w => {
    if (!phases[w.phase]) phases[w.phase] = []
    phases[w.phase].push(w)
  })

  const raceDateLabel = plan.race_date
    ? new Date(plan.race_date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })
    : null

  return (
    <div className="flex flex-col" style={{ gap: 22 }}>
      {showGarminSync && <GarminSyncModal planId={plan.id} onClose={() => setShowGarminSync(false)} />}

      {/* Header */}
      <div style={{ paddingTop: 20 }}>
        <div className="kick" style={{ fontSize: 10, color: 'var(--green)' }}>Wygenerowany przez Claude AI</div>
        <div className="cond" style={{ fontSize: 34, marginTop: 4 }}>{planJson.plan_name}</div>
        <div style={{ font: '500 13px var(--font-barlow)', color: 'var(--text-2)', marginTop: 2 }}>
          {planJson.total_weeks} tygodni · {DISTANCE_LABELS[plan.race_distance] ?? plan.race_distance}
          {raceDateLabel && ` · Cel: ${raceDateLabel}`}
        </div>
      </div>

      {/* Phase grid 2×2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {Object.entries(phases).map(([phase, weeks]) => {
          const isCurrent = phase === currentPhase
          return (
            <div key={phase}
              style={{ borderRadius: 16, padding: 14, background: 'var(--surface)', border: `1px solid ${isCurrent ? 'rgba(0,230,118,.3)' : 'var(--border)'}` }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: PHASE_COLORS[phase] ?? 'var(--text-3)', marginBottom: 10 }} />
              <div className="kick" style={{ fontSize: 9, color: 'var(--text-3)' }}>{phase}{isCurrent ? ' · teraz' : ''}</div>
              <div className="cond" style={{ fontSize: 24, marginTop: 2 }}>{weeks.length} tyg.</div>
            </div>
          )
        })}
      </div>

      {/* Actions */}
      <div className="flex" style={{ gap: 10 }}>
        <button onClick={onCalendar} className="press" style={{
          flex: 2, background: 'var(--green)', color: '#000', borderRadius: 16, padding: 14, textAlign: 'center',
          font: '800 14px var(--font-barlow-condensed)', letterSpacing: 1.5, textTransform: 'uppercase', border: 'none',
        }}>Kalendarz →</button>
        <button onClick={() => setShowGarminSync(true)} className="press" style={{
          flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-2)',
          borderRadius: 16, font: '700 12px var(--font-barlow)',
        }}>⌚ Garmin</button>
      </div>

      {/* Weekly breakdown */}
      <div>
        <div className="kick" style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 12 }}>Tygodnie</div>
        <div className="flex flex-col" style={{ gap: 10 }}>
          {planJson.weeks.map(week => {
            const isCurrent = week.week_number === curWeek
            const isPast = week.week_number < curWeek

            // Past weeks collapse to a slim one-liner — done, no need for detail
            if (isPast) {
              return (
                <button key={week.week_number} onClick={onCalendar} className="press flex items-center justify-between text-left"
                  style={{ width: '100%', borderRadius: 14, padding: '10px 16px', background: 'var(--surface)', border: '1px solid var(--border)', opacity: 0.55 }}>
                  <span className="flex items-center" style={{ gap: 8 }}>
                    <span style={{ font: '700 10px var(--font-barlow)', color: 'var(--text-3)' }}>TYG. {week.week_number}</span>
                    <span style={{ font: '600 11px var(--font-barlow)', color: PHASE_COLORS[week.phase] ?? 'var(--text-3)' }}>{week.phase}</span>
                    <span style={{ font: '500 11px var(--font-barlow)', color: 'var(--text-3)' }}>✓ za Tobą</span>
                  </span>
                  <span className="cond" style={{ fontSize: 16, color: 'var(--text-2)' }}>{week.total_km} km</span>
                </button>
              )
            }

            return (
              <button key={week.week_number} onClick={onCalendar} className="press text-left"
                style={{ width: '100%', borderRadius: 20, padding: 16, background: 'var(--surface)', border: `1px solid ${isCurrent ? 'rgba(0,230,118,.3)' : 'var(--border)'}` }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                  <div className="flex" style={{ gap: 8 }}>
                    <span style={{ font: '700 10px var(--font-barlow)', padding: '4px 10px', borderRadius: 20, background: 'var(--surface2)', color: 'var(--text-3)' }}>
                      TYG. {week.week_number}
                    </span>
                    <span style={{ font: '700 10px var(--font-barlow)', padding: '4px 10px', borderRadius: 20, background: metaBgForPhase(week.phase), color: PHASE_COLORS[week.phase] ?? 'var(--text-3)' }}>
                      {week.phase}{isCurrent ? ' · teraz' : ''}
                    </span>
                  </div>
                  <span className="cond" style={{ fontSize: 20, color: 'var(--green)' }}>{week.total_km} km</span>
                </div>
                <div className="flex flex-wrap" style={{ gap: 6 }}>
                  {week.workouts.filter(w => w.workout_type !== 'rest').map((w, i) => (
                    <WorkoutChip key={i} workout={w} />
                  ))}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function metaBgForPhase(phase: string): string {
  const map: Record<string, string> = {
    'Baza': 'var(--blue-dim)', 'Budowanie': 'var(--orange-dim)',
    'Szczyt': 'var(--green-dim)', 'Tapering': 'var(--surface2)',
  }
  return map[phase] ?? 'var(--surface2)'
}

function WorkoutChip({ workout }: { workout: { workout_type: string; title: string; distance_km: number | null; target_pace: string | null } }) {
  const meta = metaFor(workout.workout_type)
  return (
    <span style={{ font: '600 11px var(--font-barlow)', padding: '6px 11px', borderRadius: 12, background: meta.bg, color: meta.color }}>
      {meta.short}
      {workout.distance_km ? ` · ${workout.distance_km} km` : ''}
    </span>
  )
}
