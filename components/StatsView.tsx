'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatPace, formatDuration } from '@/lib/strava'
import { KmBarChart, PaceLineChart } from '@/components/ProgressCharts'
import { estimateMaxHR, getZoneRanges, buildZoneDistribution } from '@/lib/heart-rate-zones'
import { PoweredByStrava } from '@/components/PoweredByStrava'
import ShareWorkoutButton, { type ShareCardData } from '@/components/ShareWorkoutButton'
import type { Activity, StravaToken } from '@/types/database'

const RUN_EMOJI = '🏃'

/** Build share-card data straight from a Strava activity (no plan workout). */
function activityShareData(a: Activity, matchedTitle?: string): ShareCardData {
  return {
    title: matchedTitle ?? a.name ?? 'Bieg',
    typeLabel: 'Bieg',
    emoji: RUN_EMOJI,
    distanceText: ((a.distance_m ?? 0) / 1000).toFixed(2),
    pace: a.avg_pace_s_per_km ? formatPace(a.avg_pace_s_per_km) : null,
    duration: a.moving_time_s ? formatDuration(a.moving_time_s) : null,
    heartrate: a.avg_heartrate ? Math.round(a.avg_heartrate) : null,
    maxHeartrate: a.max_heartrate ? Math.round(a.max_heartrate) : null,
    elevation: a.total_elevation ?? null,
    dateLabel: new Date(a.start_date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' }),
    weekLabel: null,
    accentColor: '#00e676',
    fromStrava: true,
  }
}

type WeekGroup = { label: string; activities: Activity[]; totalKm: number; totalTime: number; avgPace: number }

function groupByWeek(activities: Activity[]): WeekGroup[] {
  const map = new Map<string, Activity[]>()
  activities.forEach(a => {
    const d = new Date(a.start_date)
    const monday = new Date(d)
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    const key = monday.toISOString().split('T')[0]
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(a)
  })

  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, acts]) => {
      const d = new Date(key)
      const label = d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })
      const totalKm = acts.reduce((s, a) => s + (a.distance_m ?? 0) / 1000, 0)
      const totalTime = acts.reduce((s, a) => s + (a.moving_time_s ?? 0), 0)
      const paces = acts.filter(a => a.avg_pace_s_per_km).map(a => a.avg_pace_s_per_km!)
      const avgPace = paces.length ? Math.round(paces.reduce((s, p) => s + p, 0) / paces.length) : 0
      return { label: `Tydzień od ${label}`, activities: acts, totalKm, totalTime, avgPace }
    })
}

type PlanWorkoutLite = { id: string; title: string; week_number: number; day_of_week: string }

const DAY_SHORT: Record<string, string> = { mon: 'Pn', tue: 'Wt', wed: 'Śr', thu: 'Cz', fri: 'Pt', sat: 'Sb', sun: 'Nd' }

export default function StatsView({ token, activities, planWorkouts }: {
  token: StravaToken | null
  activities: Activity[]
  planWorkouts: PlanWorkoutLite[]
}) {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  async function handleSync() {
    setSyncing(true)
    setSyncMsg(null)
    const res = await fetch('/api/strava/sync', { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      setSyncMsg(`Zsynchronizowano ${data.synced} nowych biegów`)
      router.refresh()
    } else {
      setSyncMsg(data.error ?? 'Błąd synca')
    }
    setSyncing(false)
  }

  const weeks = groupByWeek(activities)
  const totalRuns = activities.length
  const cutoff30 = Date.now() - 30 * 86_400_000
  const km30 = activities
    .filter(a => new Date(a.start_date).getTime() >= cutoff30)
    .reduce((s, a) => s + (a.distance_m ?? 0) / 1000, 0)

  return (
    <div className="animate-fade-up">
      <div className="flex items-end justify-between" style={{ gap: 12, padding: '20px 0 14px' }}>
        <div>
          <div className="cond" style={{ fontSize: 30 }}>Statystyki</div>
          <div className="flex items-center" style={{ gap: 6, marginTop: 2 }}>
            <span style={{ font: '500 12px var(--font-barlow)', color: 'var(--text-3)' }}>Dane ze Stravy</span>
            <PoweredByStrava />
          </div>
        </div>

        {token ? (
          <div className="flex items-center" style={{ gap: 10 }}>
            {token.athlete_photo && (
              <img src={token.athlete_photo} alt="avatar" style={{ width: 36, height: 36, borderRadius: '50%' }} />
            )}
            <div className="text-right">
              <p style={{ font: '600 13px var(--font-barlow)' }}>{token.athlete_name}</p>
              <p style={{ font: '500 11px var(--font-barlow)', color: 'var(--green)' }}>● Połączona</p>
            </div>
          </div>
        ) : (
          <a href="/api/strava/connect" className="press flex items-center" style={{
            gap: 6, borderRadius: 12, padding: '10px 14px', background: '#FC4C02', color: '#fff',
            font: '800 12px var(--font-barlow-condensed)', letterSpacing: 1, textTransform: 'uppercase', textDecoration: 'none',
          }}>🔗 Strava</a>
        )}
      </div>

      {/* Not connected */}
      {!token && activities.length === 0 && (
        <div className="rounded-2xl p-10 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="text-5xl mb-4">🏃</div>
          <h2 className="text-2xl font-black mb-2" style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif' }}>
            Brak biegów
          </h2>
          <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: 'var(--text-2)' }}>
            Nagraj bieg przyciskiem ▶ na dole, albo połącz Stravę — PACE pobierze biegi i przeanalizuje je przez Claude AI.
          </p>
          <a href="/api/strava/connect"
            className="inline-block rounded-xl px-8 py-3 text-sm font-black uppercase tracking-widest"
            style={{ background: '#FC4C02', color: '#fff', fontFamily: 'var(--font-barlow-condensed), sans-serif' }}>
            Połącz konto Strava →
          </a>
        </div>
      )}

      {/* Has data (Strava connected or manual GPS runs) */}
      {(token || activities.length > 0) && (
        <>
          {/* Two big totals */}
          <div className="flex" style={{ gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1, borderRadius: 18, padding: 16, background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="kick" style={{ fontSize: 9, color: 'var(--text-3)' }}>Dystans / 30 dni</div>
              <div className="cond" style={{ fontSize: 34, marginTop: 4, color: 'var(--green)' }}>
                {km30.toFixed(0)}<span style={{ fontSize: 15, color: 'var(--text-2)' }}> km</span>
              </div>
            </div>
            <div style={{ flex: 1, borderRadius: 18, padding: 16, background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="kick" style={{ fontSize: 9, color: 'var(--text-3)' }}>Biegi</div>
              <div className="cond" style={{ fontSize: 34, marginTop: 4 }}>{totalRuns}</div>
            </div>
          </div>

          {/* Charts */}
          {activities.length >= 2 && (
            <div className="grid grid-cols-1 gap-4 mb-6 lg:grid-cols-2">
              <KmBarChart activities={activities} />
              <PaceLineChart activities={activities} />
            </div>
          )}

          {/* Sync button — Strava only */}
          {token && (
            <div className="mb-6 flex items-center gap-4">
              <button onClick={handleSync} disabled={syncing}
                className="rounded-xl px-5 py-2.5 text-sm font-bold transition-all"
                style={{
                  background: syncing ? 'var(--surface2)' : 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: syncing ? 'var(--text-3)' : 'var(--text-2)',
                }}>
                {syncing ? '⟳ Synchronizowanie...' : '⟳ Synchronizuj aktywności'}
              </button>
              {syncMsg && <p className="text-sm" style={{ color: 'var(--green)' }}>{syncMsg}</p>}
            </div>
          )}

          {/* HR Zones */}
          {activities.some(a => a.avg_heartrate) && (
            <HRZonesSection activities={activities} />
          )}

          {/* Weekly groups */}
          {weeks.length === 0 && (
            <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                Brak biegów. Kliknij „Synchronizuj aktywności" aby pobrać dane ze Strava.
              </p>
            </div>
          )}

          <div className="space-y-4">
            {weeks.map((week, i) => (
              <div key={i} className="rounded-2xl overflow-hidden"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                {/* Week header */}
                <div className="px-5 py-3 flex items-center justify-between"
                  style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                  <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
                    {week.label}
                  </span>
                  <div className="flex gap-4 text-xs" style={{ color: 'var(--text-2)' }}>
                    <span><b style={{ color: 'var(--green)' }}>{week.totalKm.toFixed(1)}</b> km</span>
                    <span><b>{formatDuration(week.totalTime)}</b></span>
                    {week.avgPace > 0 && <span>śr. <b>{formatPace(week.avgPace)}</b>/km</span>}
                  </div>
                </div>

                {/* Activities */}
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {week.activities.map(act => (
                    <ActivityRow key={act.id} activity={act} workouts={planWorkouts} onChanged={() => router.refresh()} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ActivityRow({ activity: a, workouts, onChanged }: {
  activity: Activity
  workouts: PlanWorkoutLite[]
  onChanged: () => void
}) {
  const [manageOpen, setManageOpen] = useState(false)
  const distKm = ((a.distance_m ?? 0) / 1000).toFixed(2)
  const date = new Date(a.start_date).toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' })
  const matched = workouts.find(w => w.id === a.matched_workout_id)

  return (
    <div className="px-5 py-4">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <p className="text-sm font-semibold">{a.name}</p>
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>{date}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xl font-black" style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif', color: 'var(--green)' }}>
            {distKm} km
          </p>
          <div className="flex gap-3 text-xs justify-end" style={{ color: 'var(--text-3)' }}>
            {a.moving_time_s && <span>{formatDuration(a.moving_time_s)}</span>}
            {a.avg_pace_s_per_km && <span>{formatPace(a.avg_pace_s_per_km)}/km</span>}
            {a.avg_heartrate && <span>♥ {Math.round(a.avg_heartrate)}</span>}
          </div>
        </div>
      </div>

      {/* AI comment */}
      {a.ai_comment && (
        <div className="rounded-xl px-4 py-3 mt-2"
          style={{ background: 'var(--green-dim)', border: '1px solid rgba(0,230,118,0.2)' }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--green)' }}>
            🤖 PACE AI
          </p>
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>{a.ai_comment}</p>
        </div>
      )}

      {/* Assignment + actions */}
      <div className="flex items-center justify-between gap-3 mt-2">
        <p className="text-xs" style={{ color: matched ? 'var(--green)' : 'var(--text-3)' }}>
          {matched
            ? `📋 ${matched.title} (T${matched.week_number} · ${DAY_SHORT[matched.day_of_week] ?? ''})`
            : '○ Nieprzypisany do planu'}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <ShareWorkoutButton data={activityShareData(a, matched?.title)} compact />
          <button onClick={() => setManageOpen(true)}
            className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-all"
            style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-3)' }}>
            Zarządzaj
          </button>
        </div>
      </div>

      {manageOpen && (
        <ManageActivityModal
          activity={a}
          workouts={workouts}
          onClose={() => setManageOpen(false)}
          onChanged={() => { setManageOpen(false); onChanged() }}
        />
      )}
    </div>
  )
}

function ManageActivityModal({ activity: a, workouts, onClose, onChanged }: {
  activity: Activity
  workouts: PlanWorkoutLite[]
  onClose: () => void
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)

  async function assign(workoutId: string | null) {
    setBusy(true)
    const res = await fetch(`/api/activities/${a.id}/match`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workout_id: workoutId }),
    })
    setBusy(false)
    if (res.ok) onChanged()
    else {
      const data = await res.json().catch(() => ({}))
      alert(data.error ?? 'Nie udało się zmienić przypisania. Spróbuj ponownie.')
    }
  }

  async function remove() {
    if (!confirm('Usunąć ten bieg z historii? Nie wróci przy kolejnej synchronizacji.')) return
    setBusy(true)
    const res = await fetch(`/api/activities/${a.id}`, { method: 'DELETE' })
    setBusy(false)
    if (res.ok) onChanged()
    else {
      const data = await res.json().catch(() => ({}))
      alert(data.error ?? 'Nie udało się usunąć biegu. Spróbuj ponownie.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col animate-fade-up"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h2 className="text-xl font-black" style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif' }}>
              {a.name}
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>
              {((a.distance_m ?? 0) / 1000).toFixed(2)} km · {new Date(a.start_date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}
            </p>
          </div>
          <button onClick={onClose} className="text-2xl" style={{ color: 'var(--text-3)' }}>×</button>
        </div>

        <div className="overflow-y-auto p-3">
          <p className="text-xs font-semibold uppercase tracking-widest px-2 mb-2" style={{ color: 'var(--text-3)' }}>
            Przypisz do treningu
          </p>
          {workouts.length === 0 && (
            <p className="text-sm px-2 py-4" style={{ color: 'var(--text-3)' }}>Brak aktywnego planu.</p>
          )}
          {workouts.map(w => {
            const isCurrent = w.id === a.matched_workout_id
            return (
              <button key={w.id} onClick={() => assign(w.id)} disabled={busy}
                className="w-full text-left rounded-xl px-3 py-2.5 mb-1.5 transition-all hover:opacity-80"
                style={{
                  background: isCurrent ? 'var(--green-dim)' : 'var(--surface2)',
                  border: `1px solid ${isCurrent ? 'var(--green)' : 'var(--border)'}`,
                }}>
                <span className="text-xs font-semibold mr-2" style={{ color: 'var(--text-3)' }}>
                  T{w.week_number}·{DAY_SHORT[w.day_of_week] ?? ''}
                </span>
                <span className="text-sm" style={{ color: isCurrent ? 'var(--green)' : 'var(--text)' }}>{w.title}</span>
                {isCurrent && <span className="text-xs ml-2" style={{ color: 'var(--green)' }}>✓ obecny</span>}
              </button>
            )
          })}
        </div>

        <div className="flex gap-2 p-3 border-t" style={{ borderColor: 'var(--border)' }}>
          {a.matched_workout_id && (
            <button onClick={() => assign(null)} disabled={busy}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
              Odepnij
            </button>
          )}
          <button onClick={remove} disabled={busy}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all"
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444' }}>
            {busy ? '...' : 'Usuń bieg'}
          </button>
        </div>
      </div>
    </div>
  )
}

function HRZonesSection({ activities }: { activities: Activity[] }) {
  const maxHR = estimateMaxHR(activities)
  const zones = getZoneRanges(maxHR)
  const distribution = buildZoneDistribution(activities, maxHR)
  const total = Object.values(distribution).reduce((s, v) => s + v, 0)

  const pct = (name: string) => (total > 0 ? ((distribution[name] ?? 0) / total) * 100 : 0)
  const colorOf = (name: string) => zones.find(z => z.name === name)?.color ?? 'var(--text-3)'

  // Grouped legend buckets (matches design: Z1-2 / Z3 / Z4-5)
  const g12 = pct('Z1') + pct('Z2')
  const g3 = pct('Z3')
  const g45 = pct('Z4') + pct('Z5')

  return (
    <div style={{ borderRadius: 20, padding: 18, background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 12 }}>
      <div className="kick" style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 14 }}>Rozkład stref tętna</div>

      {/* Segmented bar */}
      <div className="flex" style={{ height: 12, borderRadius: 6, overflow: 'hidden', gap: 2 }}>
        {zones.map(z => {
          const w = pct(z.name)
          if (w <= 0) return null
          return <div key={z.name} style={{ width: `${w}%`, background: z.color }} />
        })}
      </div>

      {/* Grouped legend */}
      <div className="flex justify-between" style={{ marginTop: 10, font: '600 11px var(--font-barlow)' }}>
        <span style={{ color: colorOf('Z1') }}>Z1-2 {Math.round(g12)}%</span>
        <span style={{ color: colorOf('Z3') }}>Z3 {Math.round(g3)}%</span>
        <span style={{ color: colorOf('Z5') }}>Z4-5 {Math.round(g45)}%</span>
      </div>

      <p style={{ font: '500 10px var(--font-barlow)', color: 'var(--text-3)', marginTop: 10 }}>
        Max HR: {maxHR} bpm
      </p>
    </div>
  )
}
