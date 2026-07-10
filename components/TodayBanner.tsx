import Link from 'next/link'

// Pure presentational banner for today's planned workout. The dashboard page
// (server component) finds today's workout from data it already fetched and
// passes it in — this component does no fetching of its own.

const TYPE_EMOJI: Record<string, string> = {
  easy_run: '🏃', long_run: '🏃', tempo: '⚡', intervals: '🔥', rest: '😴',
}

export type TodayWorkout = {
  id: string
  title: string
  workout_type: string
  distance_km: number | null
  target_pace: string | null
  duration_minutes: number | null
}

export default function TodayBanner({ workout }: { workout: TodayWorkout | null }) {
  if (!workout || workout.workout_type === 'rest') return null

  const emoji = TYPE_EMOJI[workout.workout_type] ?? '🏃'

  return (
    <Link href={`/calendar/${workout.id}`} className="block" style={{ textDecoration: 'none' }}>
      <div
        className="rounded-2xl p-4 mb-6 flex items-center justify-between cursor-pointer transition-all hover:scale-[1.01] pulse-green"
        style={{
          background: 'var(--green-dim)',
          border: '1px solid var(--green)',
        }}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{emoji}</span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--green)' }}>
              Dziś masz trening!
            </p>
            <p className="text-base font-black" style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif' }}>
              {workout.title}
            </p>
            <div className="flex gap-3 text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>
              {workout.distance_km && <span>{workout.distance_km} km</span>}
              {workout.target_pace && <span>@ {workout.target_pace}/km</span>}
              {workout.duration_minutes && <span>~{workout.duration_minutes} min</span>}
            </div>
          </div>
        </div>
        <span className="text-lg" style={{ color: 'var(--green)' }}>→</span>
      </div>
    </Link>
  )
}
