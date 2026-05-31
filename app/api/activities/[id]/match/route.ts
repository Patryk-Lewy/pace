import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateWorkoutComment } from '@/lib/workout-matching'
import type { Database } from '@/types/database'

type Workout = Database['public']['Tables']['workouts']['Row']

/**
 * PATCH /api/activities/[id]/match
 * Body: { workout_id: string | null }
 *
 * Manually (re)assign a synced Strava activity to a planned workout — or
 * detach it (workout_id: null → the run becomes a "luźny bieg").
 *
 * Side effects:
 *  - Previous workout (if any) reverts to 'planned'
 *  - Any other activity linked to the target workout is detached (1:1)
 *  - Target workout becomes 'completed'
 *  - AI comparison comment is regenerated for the new target (or cleared)
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { workout_id?: string | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const workoutId = body.workout_id ?? null

  // Load the activity (RLS ensures ownership)
  const { data: activity } = await supabase
    .from('activities')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!activity) return NextResponse.json({ error: 'Nie znaleziono biegu' }, { status: 404 })

  const previousWorkoutId = activity.matched_workout_id

  // Validate the target BEFORE mutating anything — avoids leaving the previous
  // workout reverted while the activity still points at it on an error path.
  let workout: Workout | null = null
  if (workoutId !== null) {
    const { data } = await supabase
      .from('workouts')
      .select('*')
      .eq('id', workoutId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!data) return NextResponse.json({ error: 'Nie znaleziono treningu' }, { status: 404 })
    workout = data
  }

  // Revert the previously-linked workout back to planned
  if (previousWorkoutId && previousWorkoutId !== workoutId) {
    await supabase
      .from('workouts')
      .update({ status: 'planned', completed_at: null })
      .eq('id', previousWorkoutId)
      .eq('user_id', user.id)
  }

  // ── Detach (luźny bieg) ──────────────────────────────────────────────
  if (workoutId === null || !workout) {
    await supabase
      .from('activities')
      .update({ matched_workout_id: null, ai_comment: null, ai_analyzed_at: null })
      .eq('id', id)
    return NextResponse.json({ ok: true, matched_workout_id: null })
  }

  // Detach any other activity currently linked to this workout (keep 1:1)
  await supabase
    .from('activities')
    .update({ matched_workout_id: null, ai_comment: null, ai_analyzed_at: null })
    .eq('matched_workout_id', workoutId)
    .eq('user_id', user.id)
    .neq('id', id)

  // Mark workout completed + link activity
  await supabase
    .from('workouts')
    .update({ status: 'completed', completed_at: activity.start_date })
    .eq('id', workoutId)

  await supabase
    .from('activities')
    .update({ matched_workout_id: workoutId })
    .eq('id', id)

  // Regenerate AI comparison for the new target
  let comment = ''
  try {
    if (activity.avg_pace_s_per_km) {
      comment = await generateWorkoutComment({
        workoutTitle: workout.title,
        plannedDistanceKm: workout.distance_km,
        plannedPace: workout.target_pace,
        actualDistanceM: activity.distance_m ?? 0,
        actualPaceSecPerKm: activity.avg_pace_s_per_km,
        heartrate: activity.avg_heartrate,
      })
    }
  } catch (err) {
    console.error('[MATCH] Comment generation failed:', err)
  }

  await supabase
    .from('activities')
    .update({ ai_comment: comment || null, ai_analyzed_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ ok: true, matched_workout_id: workoutId })
}
