import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { predictRaceTime, formatTime } from '@/lib/pace-calculator'

// POST /api/profile/calibrate
// Body {} → returns a proposal (weekly_km + estimated pb_5k) computed from the
// last 28 days of activities. Body { apply: true } → writes it to the profile.
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const apply = body?.apply === true

    const monthAgo = new Date(Date.now() - 28 * 24 * 3600 * 1000).toISOString()
    const { data: acts } = await supabase
      .from('activities')
      .select('distance_m, moving_time_s, start_date')
      .eq('user_id', user.id).eq('hidden', false)
      .gte('start_date', monthAgo)

    const runs = (acts ?? []).filter(a => a.distance_m && a.moving_time_s)
    if (runs.length < 3) {
      return NextResponse.json({ error: 'Za mało biegów z ostatnich 4 tygodni (min. 3)' }, { status: 400 })
    }

    const totalKm = runs.reduce((s, a) => s + (a.distance_m ?? 0) / 1000, 0)
    const weeklyKm = Math.round((totalKm / 4) * 10) / 10

    let best5k: number | null = null
    for (const a of runs) {
      const distKm = (a.distance_m ?? 0) / 1000
      if (distKm < 5) continue
      const sec = predictRaceTime(a.moving_time_s!, distKm, 5)
      if (sec > 0 && (best5k === null || sec < best5k)) best5k = sec
    }
    const pb5k = best5k !== null ? formatTime(Math.round(best5k)) : null

    if (!apply) {
      return NextResponse.json({ weekly_km: weeklyKm, pb_5k: pb5k, runs: runs.length })
    }

    const update: { weekly_km: number; pb_5k?: string } = { weekly_km: weeklyKm }
    if (pb5k) update.pb_5k = pb5k

    const { error } = await supabase.from('runner_profiles').update(update).eq('id', user.id)
    if (error) return NextResponse.json({ error: 'Błąd zapisu profilu' }, { status: 500 })

    return NextResponse.json({ applied: true, weekly_km: weeklyKm, pb_5k: pb5k })
  } catch (err) {
    console.error('[calibrate] error:', err)
    return NextResponse.json({ error: 'Błąd kalibracji' }, { status: 500 })
  }
}
