import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getValidAccessToken, fetchRecentActivities, speedToSecPerKm } from '@/lib/strava'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

const getAnthropic = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const accessToken = await getValidAccessToken(supabase, user.id)
    if (!accessToken) return NextResponse.json({ error: 'Brak połączenia ze Stravą' }, { status: 400 })

    const stravaActivities = await fetchRecentActivities(accessToken, 20)
    const runs = stravaActivities.filter(a => a.type === 'Run')

    let synced = 0

    for (const act of runs) {
      const paceSecPerKm = speedToSecPerKm(act.average_speed)

      // Upsert — safe against race conditions with webhook
      // ignoreDuplicates: true → skip if already exists (no re-processing)
      const { data: savedActivity } = await supabase
        .from('activities')
        .upsert({
          user_id: user.id,
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
        }, { onConflict: 'strava_id', ignoreDuplicates: true })
        .select()
        .single()

      // null = activity already existed → skip processing
      if (!savedActivity) continue
      synced++

      // Match with planned workout
      const { data: matchedWorkout } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'planned')
        .neq('workout_type', 'rest')
        .order('week_number')
        .limit(1)
        .maybeSingle()

      if (matchedWorkout) {
        await supabase.from('workouts').update({ status: 'completed', completed_at: act.start_date }).eq('id', matchedWorkout.id)
        await supabase.from('activities').update({ matched_workout_id: matchedWorkout.id }).eq('id', savedActivity.id)

        const distKm = (act.distance / 1000).toFixed(2)
        const paceStr = `${Math.floor(paceSecPerKm / 60)}:${(paceSecPerKm % 60).toString().padStart(2, '0')}`

        const msg = await getAnthropic().messages.create({
          model: 'claude-haiku-4-5',
          max_tokens: 300,
          messages: [{
            role: 'user',
            content: `Jesteś AI trenerem biegowym PACE. Skomentuj krótko (2-3 zdania, po polsku) wynik treningu biegacza.

Zaplanowany trening: ${matchedWorkout.title} — ${matchedWorkout.distance_km ?? '—'} km @ ${matchedWorkout.target_pace ?? '—'}/km
Wykonany trening: ${distKm} km @ ${paceStr}/km${act.average_heartrate ? `, śr. tętno ${act.average_heartrate} bpm` : ''}

Bądź konkretny, motywujący i merytoryczny.`,
          }],
        })

        const comment = msg.content[0].type === 'text' ? msg.content[0].text : ''
        await supabase.from('activities').update({
          ai_comment: comment,
          ai_analyzed_at: new Date().toISOString(),
        }).eq('id', savedActivity.id)
      }
    }

    return NextResponse.json({ synced, total: runs.length })
  } catch (err) {
    console.error('Sync error:', err)
    return NextResponse.json({ error: 'Błąd synca' }, { status: 500 })
  }
}
