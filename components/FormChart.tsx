'use client'

// Form trend chart: for each of the last ~12 weeks, take the week's best run
// and project it to the goal race distance with Riegel's formula. Shows
// whether the runner is converging on their goal time.

import { predictRaceTime, parseTimeToSeconds, formatTime, getDistanceKm } from '@/lib/pace-calculator'
import type { Activity } from '@/types/database'

const DISTANCE_LABELS: Record<string, string> = {
  '5km': '5 km', '10km': '10 km', half: 'półmaraton', marathon: 'maraton',
}

const MIN_RUN_KM = 3 // shorter runs are poor predictors

function mondayKey(dateStr: string): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  d.setHours(0, 0, 0, 0)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function FormChart({ activities, raceDistance, raceGoalTime }: {
  activities: Activity[]
  raceDistance: string | null
  raceGoalTime: string | null
}) {
  if (!raceDistance) return null
  const goalKm = getDistanceKm(raceDistance)
  if (!goalKm) return null

  // Best (fastest projected) run per week
  const byWeek = new Map<string, number>()
  for (const a of activities) {
    if (!a.distance_m || !a.moving_time_s) continue
    const distKm = a.distance_m / 1000
    if (distKm < MIN_RUN_KM) continue
    const predicted = predictRaceTime(a.moving_time_s, distKm, goalKm)
    if (predicted <= 0) continue
    const key = mondayKey(a.start_date)
    const cur = byWeek.get(key)
    if (cur === undefined || predicted < cur) byWeek.set(key, predicted)
  }

  const weeks = Array.from(byWeek.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-12)
  if (weeks.length < 2) return null

  const values = weeks.map(([, v]) => v)
  const goalSec = raceGoalTime ? parseTimeToSeconds(raceGoalTime) : 0
  const allVals = goalSec > 0 ? [...values, goalSec] : values
  const min = Math.min(...allVals)
  const max = Math.max(...allVals)
  const span = Math.max(max - min, 60)

  const W = 300, H = 110, PAD = 8
  const x = (i: number) => PAD + (i / (weeks.length - 1)) * (W - PAD * 2)
  const y = (v: number) => PAD + ((v - min) / span) * (H - PAD * 2) // lower time = higher on chart

  const linePts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const delta = values[values.length - 1] - values[0] // negative = improvement
  const goalY = goalSec > 0 ? y(goalSec) : null

  const firstLabel = new Date(weeks[0][0]).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })
  const lastLabel = new Date(weeks[weeks.length - 1][0]).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })

  return (
    <div style={{ borderRadius: 20, padding: 18, background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 12 }}>
      <div className="flex justify-between items-baseline" style={{ marginBottom: 4 }}>
        <div className="kick" style={{ fontSize: 10, color: 'var(--text-3)' }}>
          Forma · prognoza na {DISTANCE_LABELS[raceDistance] ?? raceDistance}
        </div>
        <div style={{ font: '600 12px var(--font-barlow)', color: delta <= 0 ? 'var(--green)' : 'var(--orange)' }}>
          {delta <= 0 ? '↓' : '↑'} {formatTime(Math.abs(Math.round(delta)))}
        </div>
      </div>
      <div className="flex justify-between" style={{ marginBottom: 10 }}>
        <span className="cond" style={{ fontSize: 26, color: 'var(--green)' }}>
          {formatTime(Math.round(values[values.length - 1]))}
        </span>
        {goalSec > 0 && (
          <span style={{ font: '600 11px var(--font-barlow)', color: 'var(--text-3)', alignSelf: 'flex-end' }}>
            cel {raceGoalTime}
          </span>
        )}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="110" preserveAspectRatio="none">
        {goalY !== null && (
          <>
            <line x1={0} y1={goalY} x2={W} y2={goalY} stroke="var(--text-3)" strokeWidth="1" strokeDasharray="4 4" />
          </>
        )}
        <polyline points={`${linePts} ${x(weeks.length - 1).toFixed(1)},${H} ${x(0).toFixed(1)},${H}`}
          fill="var(--green)" opacity=".10" stroke="none" />
        <polyline points={linePts} fill="none" stroke="var(--green)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {values.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r="3" fill="var(--green)" />
        ))}
      </svg>
      <div className="flex justify-between" style={{ marginTop: 6, font: '600 10px var(--font-barlow)', color: 'var(--text-3)' }}>
        <span>{firstLabel}</span>
        <span>{lastLabel}</span>
      </div>
      <p style={{ font: '500 10px var(--font-barlow)', color: 'var(--text-3)', marginTop: 8 }}>
        Najlepszy bieg tygodnia przeliczony wzorem Riegla. Linia przerywana = Twój cel.
      </p>
    </div>
  )
}
