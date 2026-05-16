'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Workout } from '@/types/database'

const DAY_MAP: Record<number, string> = { 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat', 0: 'sun' }

const TYPE_EMOJI: Record<string, string> = {
  easy_run: '🏃', long_run: '🏃', tempo: '⚡', intervals: '🔥', rest: '😴',
}

export default function TodayBanner() {
  const router = useRouter()
  const [workout, setWorkout] = useState<Workout | null | undefined>(undefined)

  useEffect(() => {
    async function check() {
      const today = DAY_MAP[new Date().getDay()]
      const supabase = createClient()

      // Get active plan
      const { data: plan } = await supabase
        .from('training_plans')
        .select('id')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!plan) { setWorkout(null); return }

      // Find today's workout in the earliest unstarted week
      const { data: w } = await supabase
        .from('workouts')
        .select('*')
        .eq('plan_id', plan.id)
        .eq('day_of_week', today)
        .in('status', ['planned'])
        .order('week_number')
        .limit(1)
        .maybeSingle()

      setWorkout(w ?? null)
    }
    check()
  }, [])

  if (workout === undefined || workout === null) return null
  if (workout.workout_type === 'rest') return null

  const emoji = TYPE_EMOJI[workout.workout_type] ?? '🏃'
  const isCompleted = workout.status === 'completed'

  return (
    <div
      className="rounded-2xl p-4 mb-6 flex items-center justify-between cursor-pointer transition-all hover:scale-[1.01] pulse-green"
      style={{
        background: 'var(--green-dim)',
        border: '1px solid var(--green)',
      }}
      onClick={() => router.push(`/calendar/${workout.id}`)}
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
  )
}
