import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const PACE_RE = /^\d+:[0-5]\d$/  // M:SS or MM:SS

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  // Validate
  if (body.best_5k_pace && !PACE_RE.test(body.best_5k_pace.trim())) {
    return NextResponse.json({ error: 'Tempo musi być w formacie M:SS (np. 5:30)' }, { status: 400 })
  }
  if (body.weekly_km !== undefined && (isNaN(body.weekly_km) || body.weekly_km < 0)) {
    return NextResponse.json({ error: 'Km/tydzień musi być liczbą dodatnią' }, { status: 400 })
  }
  if (body.race_date) {
    const d = new Date(body.race_date)
    if (isNaN(d.getTime())) {
      return NextResponse.json({ error: 'Nieprawidłowa data zawodów' }, { status: 400 })
    }
  }

  const update = {
    race_goal:            body.race_goal            ?? null,
    race_distance:        body.race_distance         ?? null,
    race_date:            body.race_date             ?? null,
    weekly_km:            body.weekly_km != null ? Number(body.weekly_km) : null,
    best_5k_pace:         body.best_5k_pace?.trim()  ?? null,
    pb_5k:                body.pb_5k?.trim()         ?? null,
    pb_10k:               body.pb_10k?.trim()        ?? null,
    pb_half:              body.pb_half?.trim()       ?? null,
    pb_marathon:          body.pb_marathon?.trim()   ?? null,
    available_days:       body.available_days        ?? null,
    max_session_minutes:  body.max_session_minutes != null ? Number(body.max_session_minutes) : null,
    injury_history:       body.injury_history        ?? null,
    additional_goal:      body.additional_goal       ?? null,
    updated_at:           new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('runner_profiles')
    .update(update)
    .eq('id', user.id)
    .select()
    .single()

  if (error) {
    console.error('[PROFILE UPDATE]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ profile: data })
}
