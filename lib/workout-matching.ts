import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/** Runs shorter than this are treated as GPS noise / accidental starts —
 *  they are saved but never auto-matched or AI-commented. */
export const MIN_RUN_DISTANCE_M = 1000

const DAY_INDEX: Record<string, number> = {
  mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6,
}

/** Monday (00:00) of the week containing the given date. */
function mondayOf(date: Date): Date {
  const x = new Date(date)
  x.setHours(0, 0, 0, 0)
  const diff = (x.getDay() + 6) % 7 // 0=Mon … 6=Sun
  x.setDate(x.getDate() - diff)
  return x
}

/**
 * Monday that week 1 of a plan starts on — the SINGLE source of truth for the
 * plan timeline. Plans created on Monday or Tuesday start the same week
 * (most of the week is still ahead); created Wednesday–Sunday they start the
 * NEXT Monday, so the user never begins mid-week with "missed" workouts.
 */
export function planStartMonday(planCreatedAt: string): Date {
  const created = new Date(planCreatedAt)
  const monday = mondayOf(created)
  const dow = (created.getDay() + 6) % 7 // 0=Mon … 6=Sun
  if (dow >= 2) monday.setDate(monday.getDate() + 7)
  return monday
}

/** Calendar date a planned workout falls on, derived from plan start + week/day. */
export function computeWorkoutDate(planCreatedAt: string, weekNumber: number, dayOfWeek: string): Date {
  const start = planStartMonday(planCreatedAt)
  const offset = (weekNumber - 1) * 7 + (DAY_INDEX[dayOfWeek] ?? 0)
  const d = new Date(start)
  d.setDate(d.getDate() + offset)
  return d
}

function dateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export type MatchableWorkout = {
  id: string
  title: string
  target_pace: string | null
  distance_km: number | null
}

/**
 * Find the planned (non-rest) workout in the user's active plan that is
 * scheduled for the same calendar day as the given activity.
 * Returns null when there's no plan or no workout on that day (→ "luźny bieg").
 */
export async function findWorkoutForActivityDate(
  supabase: SupabaseClient<Database>,
  userId: string,
  activityStartDate: string,
): Promise<MatchableWorkout | null> {
  const { data: plan } = await supabase
    .from('training_plans')
    .select('id, created_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!plan) return null

  const { data: workouts } = await supabase
    .from('workouts')
    .select('id, title, target_pace, distance_km, week_number, day_of_week')
    .eq('plan_id', plan.id)
    .eq('status', 'planned')
    .neq('workout_type', 'rest')

  if (!workouts?.length) return null

  const actKey = dateKey(new Date(activityStartDate))
  for (const w of workouts) {
    const wd = computeWorkoutDate(plan.created_at, w.week_number, w.day_of_week)
    if (dateKey(wd) === actKey) {
      return { id: w.id, title: w.title, target_pace: w.target_pace, distance_km: w.distance_km }
    }
  }
  return null
}

/** Generate the PACE AI comparison comment for a completed workout. */
export async function generateWorkoutComment(params: {
  workoutTitle: string
  plannedDistanceKm: number | null
  plannedPace: string | null
  actualDistanceM: number
  actualPaceSecPerKm: number
  heartrate?: number | null
}): Promise<string> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const distKm = (params.actualDistanceM / 1000).toFixed(2)
  const paceStr = `${Math.floor(params.actualPaceSecPerKm / 60)}:${(Math.round(params.actualPaceSecPerKm) % 60).toString().padStart(2, '0')}`

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `Jesteś AI trenerem biegowym PACE. Skomentuj krótko (2-3 zdania, po polsku) wynik treningu biegacza.

Zaplanowany trening: ${params.workoutTitle} — ${params.plannedDistanceKm ?? '—'} km @ ${params.plannedPace ?? '—'}/km
Wykonany trening: ${distKm} km @ ${paceStr}/km${params.heartrate ? `, śr. tętno ${Math.round(params.heartrate)} bpm` : ''}

Bądź konkretny, motywujący i merytoryczny.`,
    }],
  })

  return msg.content[0].type === 'text' ? msg.content[0].text : ''
}
