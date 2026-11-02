import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getValidGarminToken, fetchGarminRuns, garminToActivityRow } from '@/lib/garmin'
import { analyzeAndAdapt } from '@/lib/plan-adaptation'
import { findWorkoutForActivityDate, generateWorkoutComment, MIN_RUN_DISTANCE_M } from '@/lib/workout-matching'

export const maxDuration = 60

// POST /api/garmin/sync — pull recent Garmin runs into `activities` and run the
// same match → AI comment → plan adaptation pipeline as the Strava import.
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = await getValidGarminToken(supabase, user.id)
    if (!token) {
      return NextResponse.json({ error: 'Garmin niepołączony lub klucz wygasł' }, { status: 400 })
    }

    const runs = await fetchGarminRuns(token, { limit: 30 })
    if (runs.length === 0) {
      await supabase.from('garmin_tokens').update({ last_sync: new Date().toISOString() }).eq('user_id', user.id)
      return NextResponse.json({ synced: 0 })
    }

    // Skip ones we already have (dedup by garmin_id)
    const ids = runs.map(r => r.activityId).filter(Boolean)
    const { data: existing } = await supabase
      .from('activities')
      .select('garmin_id')
      .eq('user_id', user.id)
      .in('garmin_id', ids)
    const have = new Set((existing ?? []).map(e => e.garmin_id))

    const fresh = runs.filter(r => r.activityId && !have.has(r.activityId))
    let synced = 0
    let matchedAny = false

    for (const run of fresh) {
      const row = garminToActivityRow(run, user.id)
      const { data: saved } = await supabase.from('activities').insert(row).select().single()
      if (!saved) continue
      synced++

      // Match to the planned workout on that day (skip GPS-noise-length runs)
      if ((row.distance_m ?? 0) < MIN_RUN_DISTANCE_M) continue
      const matched = await findWorkoutForActivityDate(supabase, user.id, row.start_date)
      if (!matched) continue

      await supabase.from('workouts')
        .update({ status: 'completed', completed_at: row.start_date })
        .eq('id', matched.id)
      await supabase.from('activities')
        .update({ matched_workout_id: matched.id })
        .eq('id', saved.id)

      const comment = await generateWorkoutComment({
        workoutTitle: matched.title,
        plannedDistanceKm: matched.distance_km,
        plannedPace: matched.target_pace,
        actualDistanceM: row.distance_m ?? 0,
        actualPaceSecPerKm: row.avg_pace_s_per_km ?? 0,
        heartrate: row.avg_heartrate,
      })
      await supabase.from('activities')
        .update({ ai_comment: comment, ai_analyzed_at: new Date().toISOString() })
        .eq('id', saved.id)
      matchedAny = true
    }

    await supabase.from('garmin_tokens').update({ last_sync: new Date().toISOString() }).eq('user_id', user.id)

    // One adaptation pass after ingesting
    if (matchedAny) {
      const { data: activePlan } = await supabase
        .from('training_plans').select('id').eq('user_id', user.id).eq('status', 'active')
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (activePlan) {
        await analyzeAndAdapt(supabase, user.id, activePlan.id).catch(err =>
          console.error('[garmin/sync] adaptation failed:', err))
      }
    }

    return NextResponse.json({ synced })
  } catch (err) {
    console.error('[garmin/sync] error:', err)
    return NextResponse.json({ error: 'Błąd synchronizacji z Garminem' }, { status: 500 })
  }
}
