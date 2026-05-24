'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  calculatePacePlan,
  formatTime,
  formatPace,
  parseTimeToSeconds,
  getDistanceKm,
  type Strategy,
  type Checkpoint,
} from '@/lib/pace-calculator'

const DISTANCE_LABELS: Record<string, string> = {
  '5km': '5 km', '10km': '10 km', half: 'Półmaraton', marathon: 'Maraton',
}

const STRATEGIES: { id: Strategy; label: string; desc: string }[] = [
  { id: 'even',        label: 'Even Split',      desc: 'Stałe tempo od startu do mety' },
  { id: 'negative',    label: 'Negative Split ⭐', desc: 'Pierwsza połowa 3% wolniej, druga 3% szybciej' },
  { id: 'progressive', label: 'Progresywny',      desc: 'Linearne przyspieszenie przez cały bieg' },
]

export default function RacePage() {
  const [profile, setProfile] = useState<{
    race_distance: string | null
    race_goal_time: string | null
    race_date: string | null
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [strategy, setStrategy] = useState<Strategy>('negative')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('runner_profiles')
        .select('race_distance, race_goal_time, race_date')
        .maybeSingle()
      setProfile(data)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-sm" style={{ color: 'var(--text-3)' }}>Ładowanie...</p>
    </div>
  )

  // No race configured
  if (!profile?.race_goal_time || !profile?.race_distance) {
    return (
      <div className="max-w-lg animate-fade-up">
        <h1 className="text-5xl font-black mb-1"
          style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif' }}>
          Strategia startowa
        </h1>
        <p className="text-sm mb-8" style={{ color: 'var(--text-2)' }}>
          Plan tempa na dzień zawodów
        </p>
        <div className="rounded-2xl p-8 flex flex-col items-center text-center"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="text-4xl mb-4">🏁</div>
          <h2 className="text-2xl font-black mb-2"
            style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif' }}>
            Brak celu czasowego
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-2)' }}>
            Ustaw cel czasowy w ustawieniach — PACE wyliczy plan tempa dla każdego punktu trasy.
          </p>
          <Link href="/settings">
            <button className="rounded-xl px-6 py-3 text-sm font-black uppercase tracking-widest"
              style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif', background: 'var(--green)', color: '#000' }}>
              Ustaw cel →
            </button>
          </Link>
        </div>
      </div>
    )
  }

  const { race_distance, race_goal_time, race_date } = profile
  const checkpoints = calculatePacePlan(race_goal_time, race_distance, strategy)
  const distKm = getDistanceKm(race_distance)
  const totalSec = parseTimeToSeconds(race_goal_time)
  const evenPace = formatPace(totalSec / distKm)

  // Days until race
  let daysUntil: number | null = null
  if (race_date) {
    const diff = new Date(race_date).getTime() - new Date().getTime()
    daysUntil = Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  return (
    <div className="max-w-2xl animate-fade-up">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-5xl font-black mb-1"
            style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif' }}>
            Strategia startowa
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>
            {DISTANCE_LABELS[race_distance]} · cel {race_goal_time}
            {daysUntil !== null && daysUntil > 0 && (
              <span style={{ color: 'var(--green)' }}> · za {daysUntil} dni</span>
            )}
            {daysUntil !== null && daysUntil <= 0 && (
              <span style={{ color: 'var(--orange)' }}> · dziś startujesz! 🏁</span>
            )}
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="rounded-xl px-4 py-2 text-sm font-semibold flex items-center gap-2 flex-shrink-0 transition-all hover:opacity-80 print:hidden"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
          🖨️ Drukuj
        </button>
      </div>

      {/* Strategy selector */}
      <div className="rounded-2xl p-4 mb-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-3"
          style={{ color: 'var(--text-3)' }}>
          Strategia biegu
        </p>
        <div className="flex flex-col gap-2">
          {STRATEGIES.map(s => (
            <button key={s.id} onClick={() => setStrategy(s.id)}
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all"
              style={{
                background: strategy === s.id ? 'var(--green-dim)' : 'var(--surface2)',
                border: `1px solid ${strategy === s.id ? 'var(--green)' : 'var(--border)'}`,
              }}>
              <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                style={{ borderColor: strategy === s.id ? 'var(--green)' : 'var(--text-3)' }}>
                {strategy === s.id && (
                  <div className="w-2 h-2 rounded-full" style={{ background: 'var(--green)' }} />
                )}
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: strategy === s.id ? 'var(--green)' : 'var(--text)' }}>
                  {s.label}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>{s.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Base pace info */}
      <div className="rounded-2xl p-4 mb-4 flex items-center gap-6"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--text-3)' }}>
            Cel
          </p>
          <p className="text-2xl font-black" style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif', color: 'var(--green)' }}>
            {race_goal_time}
          </p>
        </div>
        <div className="w-px h-10" style={{ background: 'var(--border)' }} />
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--text-3)' }}>
            Tempo bazowe
          </p>
          <p className="text-2xl font-black" style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif', color: 'var(--text)' }}>
            {evenPace}<span className="text-sm font-normal">/km</span>
          </p>
        </div>
        <div className="w-px h-10" style={{ background: 'var(--border)' }} />
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--text-3)' }}>
            Dystans
          </p>
          <p className="text-2xl font-black" style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif', color: 'var(--text)' }}>
            {distKm % 1 === 0 ? distKm : distKm.toFixed(1)}<span className="text-sm font-normal"> km</span>
          </p>
        </div>
      </div>

      {/* Checkpoint table */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>

        {/* Table header */}
        <div className="grid grid-cols-3 px-5 py-3 border-b"
          style={{ borderColor: 'var(--border)', background: 'var(--surface2)' }}>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
            Punkt
          </p>
          <p className="text-xs font-semibold uppercase tracking-widest text-center" style={{ color: 'var(--text-3)' }}>
            Tempo
          </p>
          <p className="text-xs font-semibold uppercase tracking-widest text-right" style={{ color: 'var(--text-3)' }}>
            Czas
          </p>
        </div>

        {/* Rows */}
        {checkpoints.map((cp, i) => (
          <CheckpointRow key={i} cp={cp} isLast={i === checkpoints.length - 1} />
        ))}
      </div>

      <p className="mt-4 text-xs text-center" style={{ color: 'var(--text-3)' }}>
        Czasy orientacyjne — GPS może się różnić o ±100 m. Ufaj odczuciom.
      </p>
    </div>
  )
}

function CheckpointRow({ cp, isLast }: { cp: Checkpoint; isLast: boolean }) {
  const isMeta = isLast
  const accentColor = isMeta ? 'var(--green)' : cp.isKey ? 'var(--orange)' : 'var(--text)'

  return (
    <div>
      <div
        className="grid grid-cols-3 px-5 py-4 border-b"
        style={{
          borderColor: 'var(--border)',
          background: isMeta ? 'var(--green-dim)' : cp.isKey ? 'var(--orange-dim)' : 'transparent',
          borderBottomWidth: isLast ? 0 : 1,
        }}>
        {/* Point label */}
        <div>
          <p className="text-sm font-bold" style={{ color: accentColor }}>
            {cp.label}
          </p>
        </div>

        {/* Pace */}
        <div className="text-center">
          <p className="text-sm font-black"
            style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif', color: accentColor }}>
            {isMeta ? '—' : `${formatPace(cp.paceSecPerKm)}/km`}
          </p>
        </div>

        {/* Cumulative time */}
        <div className="text-right">
          <p className="text-sm font-black"
            style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif', color: accentColor }}>
            {formatTime(cp.cumulativeSeconds)}
          </p>
        </div>
      </div>

      {/* Note */}
      {cp.note && (
        <div className="px-5 py-2 border-b"
          style={{
            borderColor: 'var(--border)',
            background: isMeta ? 'var(--green-dim)' : cp.isKey ? 'var(--orange-dim)' : 'var(--surface2)',
            borderBottomWidth: isLast ? 0 : 1,
          }}>
          <p className="text-xs" style={{ color: isMeta ? 'var(--green)' : cp.isKey ? 'var(--orange)' : 'var(--text-3)' }}>
            {cp.note}
          </p>
        </div>
      )}
    </div>
  )
}
