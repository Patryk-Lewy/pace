import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getValidAccessToken, speedToSecPerKm } from '@/lib/strava'
import { analyzeAndAdapt } from '@/lib/plan-adaptation'
import Anthropic from '@anthropic-ai/sdk'

const getAnthropic = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// GET — Strava webhook verification
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.STRAVA_WEBHOOK_VERIFY_TOKEN) {
    return NextResponse.json({ 'hub.challenge': challenge })
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// POST — Strava sends activity events
export async function POST(request: NextRequest) {
  const event = await request.json()

  // Only handle new activities
  if (event.object_type !== 'activity' || event.aspect_type !== 'create') {
    return NextResponse.json({ ok: true })
  }

  const stravaAthleteId = event.owner_id
  const stravaActivityId = event.object_id

  try {
    const supabase = await createClient()

    // Find user by strava athlete id
    const { data: tokenRow } = await supabase
      .from('strava_tokens')
      .select('user_id')
      .eq('strava_athlete_id', stravaAthleteId)
      .single()

    if (!tokenRow) return NextResponse.json({ ok: true })

    const accessToken = await getValidAccessToken(supabase, tokenRow.user_id)
    if (!accessToken) return NextResponse.json({ ok: true })

    // Fetch full activity from Strava
    const actRes = await fetch(
      `https://www.strava.com/api/v3/activities/${stravaActivityId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!actRes.ok) return NextResponse.json({ ok: true })
    const act = await actRes.json()

    if (act.type !== 'Run') return NextResponse.json({ ok: true })

    const paceSecPerKm = speedToSecPerKm(act.average_speed)

    // Save activity
    const { data: savedActivity } = await supabase
      .from('activities')
      .upsert({
        user_id: tokenRow.user_id,
        strava_id: act.id,
        strava_type: act.type,
        name: act.name,
        start_date: act.start_date,
        distance_m: act.distance,
        moving_time_s: act.moving_time,
        elapsed_time_s: act.elapsed_time,
        avg_pace_s_per_km: paceSecPerKm,
        avg_heartrate: act.average_heartrate ?? null,
        max_heartrate: act.max_heartrate ?? null,
        total_elevation: act.total_elevation_gain,
      })
      .select()
      .single()

    if (!savedActivity) return NextResponse.json({ ok: true })

    // Match with planned workout (closest unfinished run same week)
    const { data: matchedWorkout } = await supabase
      .from('workouts')
      .select('*')
      .eq('user_id', tokenRow.user_id)
      .eq('status', 'planned')
      .neq('workout_type', 'rest')
      .order('week_number')
      .limit(1)
      .maybeSingle()

    if (matchedWorkout) {
      await supabase.from('workouts').update({ status: 'completed', completed_at: act.start_date }).eq('id', matchedWorkout.id)
      await supabase.from('activities').update({ matched_workout_id: matchedWorkout.id }).eq('id', savedActivity.id)

      // Claude analysis
      const distKm = (act.distance / 1000).toFixed(2)
      const paceStr = `${Math.floor(paceSecPerKm / 60)}:${(paceSecPerKm % 60).toString().padStart(2, '0')}`
      const plannedPace = matchedWorkout.target_pace ?? '—'
      const plannedDist = matchedWorkout.distance_km ?? '—'

      const msg = await getAnthropic().messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `Jesteś AI trenerem biegowym PACE. Skomentuj krótko (2-3 zdania, po polsku) wynik treningu biegacza.

Zaplanowany trening: ${matchedWorkout.title} — ${plannedDist} km @ ${plannedPace}/km
Wykonany trening: ${distKm} km @ ${paceStr}/km${act.average_heartrate ? `, śr. tętno ${act.average_heartrate} bpm` : ''}

Bądź konkretny, motywujący i merytoryczny.`,
        }],
      })

      const comment = msg.content[0].type === 'text' ? msg.content[0].text : ''

      await supabase.from('activities').update({
        ai_comment: comment,
        ai_analyzed_at: new Date().toISOString(),
      }).eq('id', savedActivity.id)

      // Trigger plan adaptation analysis (fire-and-forget — doesn't block webhook response)
      const { data: activePlan } = await supabase
        .from('training_plans')
        .select('id')
        .eq('user_id', tokenRow.user_id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .maybeSingle()

      if (activePlan) {
        analyzeAndAdapt(supabase, tokenRow.user_id, activePlan.id).catch(err =>
          console.error('[ADAPTATION] Background analysis failed:', err)
        )
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Webhook error:', err)
    return NextResponse.json({ ok: true })
  }
}
