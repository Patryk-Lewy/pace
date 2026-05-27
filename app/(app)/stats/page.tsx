'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatPace, formatDuration } from '@/lib/strava'
import { KmBarChart, PaceLineChart } from '@/components/ProgressCharts'
import { estimateMaxHR, getZoneRanges, buildZoneDistribution, HR_ZONES } from '@/lib/heart-rate-zones'
import { PoweredByStrava } from '@/components/PoweredByStrava'
import type { Activity, StravaToken } from '@/types/database'

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

export default function StatsPage() {
  const [token, setToken] = useState<StravaToken | null | undefined>(undefined)
  const [activities, setActivities] = useState<Activity[]>([])
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const supabase = createClient()
    const [{ data: tok }, { data: acts }] = await Promise.all([
      supabase.from('strava_tokens').select('*').maybeSingle(),
      supabase.from('activities').select('*').order('start_date', { ascending: false }).limit(500),
    ])
    setToken(tok)
    setActivities(acts ?? [])
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
                    <ActivityRow key={act.id} activity={act} />
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

function ActivityRow({ activity: a }: { activity: Activity }) {
  const distKm = ((a.distance_m ?? 0) / 1000).toFixed(2)
  const date = new Date(a.start_date).toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' })

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
