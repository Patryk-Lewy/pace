import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { analyzeAndAdapt } from '@/lib/plan-adaptation'
import { findWorkoutForActivityDate, generateWorkoutComment, MIN_RUN_DISTANCE_M } from '@/lib/workout-matching'

export const maxDuration = 60

// POST /api/run/save — persist an in-app GPS-recorded run into `activities`
// (source = 'manual') and run the same match → AI comment → adapt pipeline
// that the Strava webhook uses.
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const distanceM = Number(body?.distance_m)
    const movingS = Number(body?.moving_time_s)
    if (!Number.isFinite(distanceM) || distanceM <= 0 || !Number.isFinite(movingS) || movingS <= 0) {
      return NextResponse.json({ error: 'Brak poprawnych danych biegu' }, { status: 400 })
    }

    const startDate = typeof body?.start_date === 'string' ? body.start_date : new Date().toISOString()
    const elapsedS = Number.isFinite(Number(body?.elapsed_time_s)) ? Number(body.elapsed_time_s) : Math.round(movingS)
    const pace = Number.isFinite(Number(body?.avg_pace_s_per_km))
      ? Math.round(Number(body.avg_pace_s_per_km))
      : Math.round(movingS / (distanceM / 1000))

    const { data: saved, error: insertErr } = await supabase
      .from('activities')
      .insert({
        user_id: user.id,
        source: 'manual',
        strava_type: 'Run',
        name: typeof body?.name === 'string' && body.name.trim() ? body.name.trim() : 'Bieg PACE',
        start_date: startDate,
        distance_m: distanceM,
        moving_time_s: Math.round(movingS),
        elapsed_time_s: elapsedS,
        avg_pace_s_per_km: pace,
      })
      .select()
      .single()

    if (insertErr || !saved) {
      console.error('[run/save] insert error:', insertErr)
      return NextResponse.json({ error: 'Nie udało się zapisać biegu' }, { status: 500 })
    }

    // Too short → saved but not matched or commented (GPS noise threshold)
    if (distanceM < MIN_RUN_DISTANCE_M) {
      return NextResponse.json({ activity_id: saved.id, matched: false })
    }

    // Match to the planned workout on this calendar day
    const matched = await findWorkoutForActivityDate(supabase, user.id, startDate)
    if (!matched) {
      return NextResponse.json({ activity_id: saved.id, matched: false })
    }

    await supabase.from('workouts')
      .update({ status: 'completed', completed_at: startDate })
      .eq('id', matched.id)

    await supabase.from('activities')
      .update({ matched_workout_id: matched.id })
      .eq('id', saved.id)

    const comment = await generateWorkoutComment({
      workoutTitle: matched.title,
      plannedDistanceKm: matched.distance_km,
      plannedPace: matched.target_pace,
      actualDistanceM: distanceM,
      actualPaceSecPerKm: pace,
    })

    await supabase.from('activities')
      .update({ ai_comment: comment, ai_analyzed_at: new Date().toISOString() })
      .eq('id', saved.id)

    // Fire-and-forget plan adaptation
    const { data: activePlan } = await supabase
      .from('training_plans').select('id').eq('user_id', user.id).eq('status', 'active')
      .order('created_at', { ascending: false }).limit(1).maybeSingle()

    if (activePlan) {
      await analyzeAndAdapt(supabase, user.id, activePlan.id).catch(err =>
        console.error('[run/save] adaptation failed:', err))
    }

    return NextResponse.json({
      activity_id: saved.id,
      matched: true,
      workout_id: matched.id,
      workout_title: matched.title,
      comment,
    })
  } catch (err) {
    console.error('[run/save] error:', err)
    return NextResponse.json({ error: 'Błąd zapisu biegu' }, { status: 500 })
  }
}
