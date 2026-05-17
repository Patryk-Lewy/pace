export type Strategy = 'even' | 'negative' | 'progressive'

export type Checkpoint = {
  km: number
  label: string
  paceSecPerKm: number
  cumulativeSeconds: number
  note?: string
  isKey?: boolean
}

const DISTANCE_KM: Record<string, number> = {
  '5km': 5,
  '10km': 10,
  'half': 21.0975,
  'marathon': 42.195,
}

// Parse "H:MM:SS" or "MM:SS" to total seconds
export function parseTimeToSeconds(time: string): number {
  const parts = time.split(':').map(Number)
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return 0
}

// Format seconds → "H:MM:SS" or "M:SS"
export function formatTime(totalSec: number): string {
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = Math.round(totalSec % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

// Format pace seconds/km → "M:SS"
export function formatPace(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function getCheckpoints(distance: string): { km: number; label: string; note?: string; isKey?: boolean }[] {
  switch (distance) {
    case '5km':
      return [
        { km: 1,  label: '1 km' },
        { km: 2,  label: '2 km' },
        { km: 3,  label: '3 km', note: 'Połowa za Tobą', isKey: true },
        { km: 4,  label: '4 km' },
        { km: 5,  label: '🏁 META', note: 'Wszystko co masz', isKey: true },
      ]
    case '10km':
      return [
        { km: 2,  label: '2 km' },
        { km: 4,  label: '4 km' },
        { km: 5,  label: 'Połowa', note: 'Oceń formę — decyzja o drugiej połowie', isKey: true },
        { km: 6,  label: '6 km' },
        { km: 8,  label: '8 km', note: 'Ostatnie 2 km — czas na atak' },
        { km: 10, label: '🏁 META', note: 'Zostaw wszystko na trasie', isKey: true },
      ]
    case 'half':
      return [
        { km: 5,       label: '5 km',    note: 'Spokojnie — za wcześnie na heroizm' },
        { km: 10,      label: '10 km',   note: 'Oceń formę — decyzja o tempie drugiej połowy', isKey: true },
        { km: 15,      label: '15 km',   note: 'Ostatnie 6 km — zacznij budować' },
        { km: 21.0975, label: '🏁 META', note: 'Zostaw wszystko na trasie', isKey: true },
      ]
    case 'marathon':
      return [
        { km: 5,       label: '5 km',     note: 'Spokojnie — za wcześnie na heroizm' },
        { km: 10,      label: '10 km' },
        { km: 15,      label: '15 km' },
        { km: 21.0975, label: 'Półmeta',  note: 'Oceń formę — decyzja o tempie drugiej połowy', isKey: true },
        { km: 25,      label: '25 km' },
        { km: 30,      label: '30 km',    note: '★ Tu zaczyna się prawdziwy maraton', isKey: true },
        { km: 35,      label: '35 km',    note: 'Ostatnie wielkie wyzwanie' },
        { km: 40,      label: '40 km',    note: 'Finalny sprint — wszystko co zostało' },
        { km: 42.195,  label: '🏁 META',  note: 'Zostaw wszystko na trasie', isKey: true },
      ]
    default:
      return []
  }
}

export function calculatePacePlan(
  goalTime: string,
  distance: string,
  strategy: Strategy,
): Checkpoint[] {
  const totalSec = parseTimeToSeconds(goalTime)
  const distKm = DISTANCE_KM[distance]
  if (!distKm || !totalSec) return []

  const evenPace = totalSec / distKm
  const checkpoints = getCheckpoints(distance)

  return checkpoints.map(({ km, label, note, isKey }) => {
    let paceSecPerKm: number
    let cumulativeSec: number

    switch (strategy) {
      case 'negative': {
        // First half 3% slower, second half 3% faster — total time unchanged
        const half = distKm / 2
        if (km <= half) {
          paceSecPerKm  = evenPace * 1.03
          cumulativeSec = km * evenPace * 1.03
        } else {
          paceSecPerKm  = evenPace * 0.97
          cumulativeSec = half * evenPace * 1.03 + (km - half) * evenPace * 0.97
        }
        break
      }
      case 'progressive': {
        // Linear: +5% at km 0, −5% at last km; integral = total time ✓
        paceSecPerKm  = evenPace * (1.05 - (km / distKm) * 0.10)
        cumulativeSec = evenPace * (1.05 * km - (km * km) / (2 * distKm) * 0.10)
        break
      }
      default: // even
        paceSecPerKm  = evenPace
        cumulativeSec = km * evenPace
    }

    return { km, label, paceSecPerKm, cumulativeSeconds: cumulativeSec, note, isKey }
  })
}

export function getDistanceKm(distance: string): number {
  return DISTANCE_KM[distance] ?? 0
}
