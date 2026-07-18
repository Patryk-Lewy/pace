import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StatsView from '@/components/StatsView'
import type { Activity } from '@/types/database'

const DAY_IDX: Record<string, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 }

export default async function StatsPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  const user = session.user

  const [{ data: token }, { data: acts }, { data: plan }, { data: profile }] = await Promise.all([
    supabase.from('strava_tokens').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('activities')
      .select('id, name, start_date, distance_m, moving_time_s, avg_pace_s_per_km, avg_heartrate, max_heartrate, total_elevation, ai_comment, matched_workout_id')
      .eq('user_id', user.id).eq('hidden', false).order('start_date', { ascending: false }).limit(200),
    supabase.from('training_plans').select('id').eq('user_id', user.id).eq('status', 'active')
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('runner_profiles').select('race_distance, race_goal_time, max_hr, hr_zones').eq('id', user.id).maybeSingle(),
  ])

  let planWorkouts: { id: string; title: string; week_number: number; day_of_week: string }[] = []
  if (plan) {
    const { data } = await supabase
      .from('workouts').select('id, title, week_number, day_of_week')
      .eq('plan_id', plan.id).neq('workout_type', 'rest')
    planWorkouts = (data ?? []).sort((a, b) =>
      a.week_number - b.week_number || (DAY_IDX[a.day_of_week] ?? 0) - (DAY_IDX[b.day_of_week] ?? 0)
    )
  }

  return (
    <StatsView
      token={token ?? null}
      activities={(acts ?? []) as unknown as Activity[]}
      planWorkouts={planWorkouts}
      raceDistance={profile?.race_distance ?? null}
      raceGoalTime={profile?.race_goal_time ?? null}
      maxHr={profile?.max_hr ?? null}
      hrZones={profile?.hr_zones ?? null}
    />
  )
}
