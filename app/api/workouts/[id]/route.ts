import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

type WorkoutUpdate = Database['public']['Tables']['workouts']['Update']

const PACE_RE = /^\d{1,2}:[0-5]\d$/

/**
 * PATCH /api/workouts/[id]
 *
 * Allows the user to edit their own workout. Supported fields:
 *  - distance_km     (number)
 *  - target_pace     (string "M:SS")
 *  - duration_minutes (number)
 *  - scheduled_date  (ISO date string)
 *  - user_notes      (string)
 *
 * RLS guarantees we can only update workouts owned by the caller.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const updates: WorkoutUpdate = {}

  // distance_km
  if (body.distance_km !== undefined) {
    if (body.distance_km === null || body.distance_km === '') {
      updates.distance_km = null
    } else {
      const km = Number(body.distance_km)
      if (Number.isNaN(km) || km < 0 || km > 200) {
        return NextResponse.json({ error: 'distance_km musi być liczbą 0–200' }, { status: 400 })
      }
      updates.distance_km = km
    }
  }

  // target_pace — "M:SS" format
  if (body.target_pace !== undefined) {
    if (body.target_pace === null || body.target_pace === '') {
      updates.target_pace = null
    } else if (typeof body.target_pace !== 'string' || !PACE_RE.test(body.target_pace.trim())) {
      return NextResponse.json({ error: 'target_pace musi być w formacie M:SS' }, { status: 400 })
    } else {
      updates.target_pace = body.target_pace.trim()
    }
  }

  // duration_minutes
  if (body.duration_minutes !== undefined) {
    if (body.duration_minutes === null || body.duration_minutes === '') {
      updates.duration_minutes = null
    } else {
      const m = Number(body.duration_minutes)
      if (!Number.isInteger(m) || m < 0 || m > 600) {
        return NextResponse.json({ error: 'duration_minutes musi być liczbą całkowitą 0–600' }, { status: 400 })
      }
      updates.duration_minutes = m
    }
  }

  // scheduled_date — ISO date
  if (body.scheduled_date !== undefined) {
    if (body.scheduled_date === null || body.scheduled_date === '') {
      updates.scheduled_date = null
    } else if (typeof body.scheduled_date !== 'string' || Number.isNaN(Date.parse(body.scheduled_date))) {
      return NextResponse.json({ error: 'scheduled_date musi być poprawną datą' }, { status: 400 })
    } else {
      updates.scheduled_date = body.scheduled_date
    }
  }

  // rpe — Rate of Perceived Exertion 1-10
  if (body.rpe !== undefined) {
    if (body.rpe === null) {
      updates.rpe = null
    } else {
      const r = Number(body.rpe)
      if (!Number.isInteger(r) || r < 1 || r > 10) {
        return NextResponse.json({ error: 'RPE musi być liczbą 1–10' }, { status: 400 })
      }
      updates.rpe = r
    }
  }

  // user_notes — free-form text, capped at 2000 chars
  if (body.user_notes !== undefined) {
    if (body.user_notes === null || body.user_notes === '') {
      updates.user_notes = null
    } else if (typeof body.user_notes !== 'string') {
      return NextResponse.json({ error: 'user_notes musi być tekstem' }, { status: 400 })
    } else {
      const trimmed = body.user_notes.trim()
      if (trimmed.length > 2000) {
        return NextResponse.json({ error: 'Notatka nie może mieć więcej niż 2000 znaków' }, { status: 400 })
      }
      updates.user_notes = trimmed
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Brak pól do aktualizacji' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('workouts')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Nie udało się zaktualizować' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, workout: data })
}
