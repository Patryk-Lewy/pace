'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatPace, formatDuration } from '@/lib/strava'
import { KmBarChart, PaceLineChart } from '@/components/ProgressCharts'
import { estimateMaxHR, getZoneRanges, buildZoneDistribution, HR_ZONES } from '@/lib/heart-rate-zones'
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

const DAY_IDX: Record<string, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 }
const DAY_SHORT: Record<string, string> = { mon: 'Pn', tue: 'Wt', wed: 'Śr', thu: 'Cz', fri: 'Pt', sat: 'Sb', sun: 'Nd' }

export default function StatsPage() {
  const [token, setToken] = useState<StravaToken | null | undefined>(undefined)
  const [activities, setActivities] = useState<Activity[]>([])
  const [planWorkouts, setPlanWorkouts] = useState<PlanWorkoutLite[]>([])
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const supabase = createClient()
    const [{ data: tok }, { data: acts }, { data: plan }] = await Promise.all([
      supabase.from('strava_tokens').select('*').maybeSingle(),
      supabase.from('activities').select('*').eq('hidden', false).order('start_date', { ascending: false }).limit(500),
      supabase.from('training_plans').select('id').eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ])

    let wk: PlanWorkoutLite[] = []
    if (plan) {
      const { data } = await supabase
        .from('workouts')
        .select('id, title, week_number, day_of_week')
        .eq('plan_id', plan.id)
        .neq('workout_type', 'rest')
      wk = (data ?? []).sort((a, b) =>
        a.week_number - b.week_number || (DAY_IDX[a.day_of_week] ?? 0) - (DAY_IDX[b.day_of_week] ?? 0)
      )
    }

    setToken(tok)
    setActivities(acts ?? [])
    setPlanWorkouts(wk)
    setLoading(false)
  }

  async function handleSync() {
    setSyncing(true)
    setSyncMsg(null)
    const res = await fetch('/api/strava/sync', { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      setSyncMsg(`Zsynchronizowano ${data.synced} nowych biegów`)
      await loadData()
    } else {
      setSyncMsg(data.error ?? 'Błąd synca')
    }
    setSyncing(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-sm" style={{ color: 'var(--text-3)' }}>Ładowanie...</p>
    </div>
  )

  const weeks = groupByWeek(activities)
  const totalKm = activities.reduce((s, a) => s + (a.distance_m ?? 0) / 1000, 0)
  const totalRuns = activities.length

  return (
    <div className="max-w-4xl animate-fade-up">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-5xl font-black mb-1" style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif' }}>
            Statystyki
          </h1>
          <p className="text-sm flex items-center gap-2" style={{ color: 'var(--text-2)' }}>
            Historia biegów · <PoweredByStrava />
          </p>
        </div>

        {token ? (
          <div className="flex items-center gap-3">
            {token.athlete_photo && (
              <img src={token.athlete_photo} alt="avatar" className="w-9 h-9 rounded-full" />
            )}
            <div className="text-right">
              <p className="text-sm font-semibold">{token.athlete_name}</p>
              <p className="text-xs" style={{ color: 'var(--green)' }}>● Strava połączona</p>
            </div>
          </div>
        ) : (
          <a href="/api/strava/connect"
            className="rounded-xl px-5 py-2.5 text-sm font-black uppercase tracking-widest transition-all hover:-translate-y-0.5 flex items-center gap-2"
            style={{ background: '#FC4C02', color: '#fff', fontFamily: 'var(--font-barlow-condensed), sans-serif' }}>
            🔗 Połącz Stravę
          </a>
        )}
      </div>

      {/* Not connected */}
      {!token && (
        <div className="rounded-2xl p-10 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="text-5xl mb-4">🏃</div>
          <h2 className="text-2xl font-black mb-2" style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif' }}>
            Połącz Stravę
          </h2>
          <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: 'var(--text-2)' }}>
            Po połączeniu PACE automatycznie pobiera Twoje biegi i analizuje je przez Claude AI.
          </p>
          <a href="/api/strava/connect"
            className="inline-block rounded-xl px-8 py-3 text-sm font-black uppercase tracking-widest"
            style={{ background: '#FC4C02', color: '#fff', fontFamily: 'var(--font-barlow-condensed), sans-serif' }}>
            Połącz konto Strava →
          </a>
        </div>
      )}

      {/* Connected */}
      {token && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
            <BigStat label="Łączny dystans" value={totalKm.toFixed(0)} unit="km" accent />
            <BigStat label="Liczba biegów" value={String(totalRuns)} unit="biegów" />
            <BigStat label="Ostatni bieg"
              value={activities[0] ? new Date(activities[0].start_date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' }) : '—'}
              unit="" />
            <BigStat label="Śr. tempo"
              value={(() => {
                const paces = activities.filter(a => a.avg_pace_s_per_km).map(a => a.avg_pace_s_per_km!)
                return paces.length ? formatPace(Math.round(paces.reduce((s, p) => s + p, 0) / paces.length)) : '—'
              })()}
              unit="/km" />
          </div>

          {/* Charts */}
          {activities.length >= 2 && (
            <div className="grid grid-cols-1 gap-4 mb-6 lg:grid-cols-2">
              <KmBarChart activities={activities} />
              <PaceLineChart activities={activities} />
            </div>
          )}

          {/* Sync button */}
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
                    <ActivityRow key={act.id} activity={act} workouts={planWorkouts} onChanged={loadData} />
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

function BigStat({ label, value, unit, accent }: { label: string; value: string; unit: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-3)' }}>{label}</p>
      <p className="text-3xl font-black" style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif', color: accent ? 'var(--green)' : 'var(--text)' }}>
        {value}
      </p>
      {unit && <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{unit}</p>}
    </div>
  )
}

function HRZonesSection({ activities }: { activities: Activity[] }) {
  const maxHR = estimateMaxHR(activities)
  const zones = getZoneRanges(maxHR)
  const distribution = buildZoneDistribution(activities, maxHR)
  const totalWithHR = activities.filter(a => a.avg_heartrate).length
  const totalDist = Object.values(distribution).reduce((s, v) => s + v, 0)

  return (
    <div className="rounded-2xl overflow-hidden mb-6"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      {/* Header */}
      <div className="px-5 py-3 flex items-center justify-between"
        style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
          ♥ Strefy tętna
        </span>
        <span className="text-xs" style={{ color: 'var(--text-3)' }}>
          Max HR: {maxHR} bpm (na podstawie {activities.filter(a => a.max_heartrate).length} biegów)
        </span>
      </div>

      <div className="p-5 space-y-3">
        {zones.map(z => {
          const count = distribution[z.name] ?? 0
          const pct = totalDist > 0 ? (count / totalDist) * 100 : 0

          return (
            <div key={z.name}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold w-6" style={{ color: z.color }}>{z.name}</span>
                  <span className="text-xs" style={{ color: 'var(--text-2)' }}>{z.label}</span>
                  <span className="text-xs" style={{ color: 'var(--text-3)' }}>{z.minBpm}–{z.maxBpm} bpm</span>
                </div>
                <span className="text-xs font-semibold" style={{ color: 'var(--text-2)' }}>
                  {count > 0 ? `${count} bieg${count === 1 ? '' : 'ów'} · ${Math.round(pct)}%` : '—'}
                </span>
              </div>
              <div className="h-1.5 rounded-full" style={{ background: 'var(--surface3)' }}>
                <div
                  className="h-1.5 rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: z.color }}
                />
              </div>
            </div>
          )
        })}

        {totalWithHR < 3 && (
          <p className="text-xs pt-2" style={{ color: 'var(--text-3)' }}>
            Dane tętna z {totalWithHR} biegu/biegów. Więcej danych pozwoli dokładniej określić strefy.
          </p>
        )}
      </div>

      {/* Zone legend */}
      <div className="px-5 pb-4">
        <div className="flex flex-wrap gap-2">
          {HR_ZONES.map(z => (
            <span key={z.name}
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: `${z.color}22`, color: z.color, border: `1px solid ${z.color}44` }}>
              {z.name} · {z.description.split(',')[0]}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
