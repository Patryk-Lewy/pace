'use client'

import { formatPace } from '@/lib/strava'
import type { Activity } from '@/types/database'

// ─── helpers ────────────────────────────────────────────────────────────────

function getMonday(date: Date): string {
  const d = new Date(date)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.toISOString().split('T')[0]
}

type WeekStat = { label: string; km: number; avgPace: number }

function buildWeekStats(activities: Activity[], maxWeeks = 8): WeekStat[] {
  const map = new Map<string, Activity[]>()
  activities.forEach(a => {
    const key = getMonday(new Date(a.start_date))
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(a)
  })

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-maxWeeks)
    .map(([key, acts]) => {
      const d = new Date(key)
      const label = d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })
      const km = acts.reduce((s, a) => s + (a.distance_m ?? 0) / 1000, 0)
      const paces = acts.filter(a => a.avg_pace_s_per_km).map(a => a.avg_pace_s_per_km!)
      const avgPace = paces.length ? Math.round(paces.reduce((s, p) => s + p, 0) / paces.length) : 0
      return { label, km, avgPace }
    })
}

// ─── Bar Chart (km/week) ────────────────────────────────────────────────────

export function KmBarChart({ activities }: { activities: Activity[] }) {
  const weeks = buildWeekStats(activities)
  if (weeks.length === 0) return null

  const maxKm = Math.max(...weeks.map(w => w.km), 1)
  const W = 500
  const H = 160
  const barW = Math.floor((W - (weeks.length - 1) * 8) / weeks.length)
  const labelH = 28

  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--text-3)' }}>
        Kilometry / tydzień
      </p>
      <svg viewBox={`0 0 ${W} ${H + labelH}`} className="w-full" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--green)" stopOpacity="1" />
            <stop offset="100%" stopColor="var(--green)" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {weeks.map((week, i) => {
          const barH = Math.max(4, (week.km / maxKm) * H)
          const x = i * (barW + 8)
          const y = H - barH
          const isLast = i === weeks.length - 1
          return (
            <g key={i}>
              <rect
                x={x} y={y} width={barW} height={barH}
                rx={4}
                fill={isLast ? 'url(#barGrad)' : 'var(--surface3)'}
              />
              {week.km > 0 && (
                <text
                  x={x + barW / 2} y={y - 6}
                  textAnchor="middle"
                  fontSize={10}
                  fill={isLast ? 'var(--green)' : 'var(--text-3)'}
                  fontWeight="700"
                >
                  {week.km.toFixed(0)}
                </text>
              )}
              <text
                x={x + barW / 2} y={H + labelH - 4}
                textAnchor="middle"
                fontSize={9}
                fill="var(--text-3)"
              >
                {week.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ─── Line Chart (pace trend) ────────────────────────────────────────────────

export function PaceLineChart({ activities }: { activities: Activity[] }) {
  const weeks = buildWeekStats(activities).filter(w => w.avgPace > 0)
  if (weeks.length < 2) return null

  const W = 500
  const H = 140
  const labelH = 28
  const PAD = 16

  const paces = weeks.map(w => w.avgPace)
  const minP = Math.min(...paces) * 0.97
  const maxP = Math.max(...paces) * 1.03

  const xStep = (W - PAD * 2) / (weeks.length - 1)

  const pts = weeks.map((w, i) => ({
    x: PAD + i * xStep,
    y: PAD + ((w.avgPace - minP) / (maxP - minP)) * (H - PAD * 2),
    // NOTE: slower pace = higher y value (inverted: faster is "better" = lower on chart)
    pace: w.avgPace,
    label: w.label,
  }))

  const polyline = pts.map(p => `${p.x},${p.y}`).join(' ')
  const area = `M${pts[0].x},${H} ` + pts.map(p => `L${p.x},${p.y}`).join(' ') + ` L${pts[pts.length - 1].x},${H} Z`

  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--text-3)' }}>
        Trend tempa (min/km)
      </p>
      <svg viewBox={`0 0 ${W} ${H + labelH}`} className="w-full" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--green)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--green)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 0.5, 1].map((t, i) => (
          <line
            key={i}
            x1={PAD} y1={PAD + t * (H - PAD * 2)}
            x2={W - PAD} y2={PAD + t * (H - PAD * 2)}
            stroke="rgba(255,255,255,0.04)" strokeWidth={1}
          />
        ))}

        {/* Area fill */}
        <path d={area} fill="url(#areaGrad)" />

        {/* Line */}
        <polyline
          points={polyline}
          fill="none"
          stroke="var(--green)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Points + labels */}
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={4} fill="var(--green)" />
            <text
              x={p.x} y={p.y - 10}
              textAnchor="middle"
              fontSize={10}
              fill="var(--green)"
              fontWeight="700"
            >
              {formatPace(p.pace)}
            </text>
            <text
              x={p.x} y={H + labelH - 4}
              textAnchor="middle"
              fontSize={9}
              fill="var(--text-3)"
            >
              {p.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}
