// Heart-rate zone calculations for PACE AI Running Coach

export interface HRZone {
  number: 1 | 2 | 3 | 4 | 5
  name: string
  label: string
  /** Lower boundary as % of max HR (inclusive) */
  minPct: number
  /** Upper boundary as % of max HR (exclusive, except Z5) */
  maxPct: number
  color: string
  description: string
}

export const HR_ZONES: HRZone[] = [
  { number: 1, name: 'Z1', label: 'Regeneracja',  minPct: 50, maxPct: 60, color: '#60a5fa', description: 'Bardzo lekki wysiłek, aktywna regeneracja' },
  { number: 2, name: 'Z2', label: 'Tlenowa',      minPct: 60, maxPct: 70, color: '#4ade80', description: 'Baza tlenowa, długie biegi w komforcie' },
  { number: 3, name: 'Z3', label: 'Aerobowa',     minPct: 70, maxPct: 80, color: '#facc15', description: 'Próg tlenowy, tempo biegów' },
  { number: 4, name: 'Z4', label: 'Anaerobowa',   minPct: 80, maxPct: 90, color: '#f97316', description: 'Próg mleczanowy, interwały' },
  { number: 5, name: 'Z5', label: 'Maksymalna',   minPct: 90, maxPct: 100, color: '#ef4444', description: 'Wysiłek maksymalny, krótkie powtórzenia' },
]

/** Derive max HR from recorded activities, falling back to 190 bpm */
export function estimateMaxHR(activities: { max_heartrate?: number | null }[]): number {
  const candidates = activities.map(a => a.max_heartrate ?? 0).filter(h => h > 100)
  if (candidates.length === 0) return 190
  return Math.max(...candidates)
}

/** Return the HR zone for a given heart rate */
export function classifyHR(hr: number, maxHR: number): HRZone {
  const pct = (hr / maxHR) * 100
  return (
    HR_ZONES.find(z => pct >= z.minPct && pct < z.maxPct) ??
    (pct >= 90 ? HR_ZONES[4] : HR_ZONES[0])
  )
}

/** Return each zone with concrete BPM ranges for a given maxHR */
export function getZoneRanges(maxHR: number) {
  return HR_ZONES.map(z => ({
    ...z,
    minBpm: Math.round(maxHR * z.minPct / 100),
    maxBpm: Math.round(maxHR * z.maxPct / 100),
  }))
}

/** Count how many activities fall into each zone (by avg_heartrate) */
export function buildZoneDistribution(
  activities: { avg_heartrate?: number | null }[],
  maxHR: number
): Record<string, number> {
  const counts: Record<string, number> = { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 }
  for (const a of activities) {
    if (!a.avg_heartrate) continue
    const zone = classifyHR(a.avg_heartrate, maxHR)
    counts[zone.name] = (counts[zone.name] ?? 0) + 1
  }
  return counts
}

/** Map workout_type to the target HR zone name(s), e.g. "Z1-Z2" */
export const WORKOUT_TARGET_ZONE: Record<string, string> = {
  easy_run:  'Z1–Z2',
  long_run:  'Z2',
  tempo:     'Z3',
  intervals: 'Z4–Z5',
  rest:      '—',
}
