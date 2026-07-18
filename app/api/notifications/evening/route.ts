import { NextResponse, type NextRequest } from 'next/server'
import webpush from 'web-push'
import { createServiceClient } from '@/lib/supabase/service'
import { computeWorkoutDate } from '@/lib/workout-matching'
import type { PushSubscriptionRow } from '@/types/database'

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
)

const DAY_MAP: Record<number, string> = {
  0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat',
}

// Only "hard" sessions warrant an evening heads-up
const HARD_TYPES = new Set(['tempo', 'intervals', 'long_run'])

const HARD_LABEL: Record<string, string> = {
  tempo: 'tempo', intervals: 'interwały', long_run: 'długie wybieganie',
}

// POST /api/notifications/evening
// Vercel Cron daily at 18:00 UTC. If TOMORROW holds a hard workout
// (tempo / intervals / long run), nudge the runner the evening before.
export async function POST(request: NextRequest) {
  // Vercel Cron invokes GET with Authorization: Bearer ${CRON_SECRET};
  // manual/legacy calls use NOTIFICATIONS_SECRET. Accept either.
  const auth = request.headers.get('authorization')
  const ok = [process.env.NOTIFICATIONS_SECRET, process.env.CRON_SECRET]
    .filter(Boolean)
    .some(s => auth === `Bearer ${s}`)
  if (!ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createServiceClient()

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowDow = DAY_MAP[tomorrow.getDay()]
  const tomorrowKey = dateKey(tomorrow)

  const { data: activePlans } = await supabase
    .from('training_plans')
    .select('id, created_at')
    .eq('status', 'active')

  if (!activePlans?.length) {
    return NextResponse.json({ sent: 0, message: 'No active plans' })
  }
  const planCreatedById = new Map(activePlans.map(p => [p.id, p.created_at]))

  const { data: allWorkouts } = await supabase
    .from('workouts')
    .select('id, user_id, plan_id, week_number, day_of_week, title, workout_type, distance_km, target_pace')
    .in('plan_id', activePlans.map(p => p.id))
    .eq('day_of_week', tomorrowDow)
    .eq('status', 'planned')

  const workouts = (allWorkouts ?? []).filter(w => {
    if (!HARD_TYPES.has(w.workout_type)) return false
    const created = planCreatedById.get(w.plan_id)
    if (!created) return false
    return dateKey(computeWorkoutDate(created, w.week_number, w.day_of_week)) === tomorrowKey
  })

  if (!workouts.length) {
    return NextResponse.json({ sent: 0, message: 'No hard workouts tomorrow' })
  }

  const userIds = [...new Set(workouts.map(w => w.user_id))]
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*')
    .in('user_id', userIds)

  const subList = (subs ?? []) as PushSubscriptionRow[]
  if (!subList.length) {
    return NextResponse.json({ sent: 0, message: 'No subscriptions' })
  }

  const workoutByUser = new Map(workouts.map(w => [w.user_id, w]))

  let sent = 0
  let failed = 0
  const staleEndpoints: string[] = []

  await Promise.allSettled(
    subList.map(async sub => {
      const workout = workoutByUser.get(sub.user_id)
      if (!workout) return

      const details = [
        workout.distance_km ? `${workout.distance_km} km` : null,
        workout.target_pace ? `@ ${workout.target_pace}/km` : null,
      ].filter(Boolean).join(' · ')

      const payload = JSON.stringify({
        title: `PACE — jutro ${HARD_LABEL[workout.workout_type] ?? 'ciężki trening'} 💪`,
        body: `${workout.title}${details ? ` (${details})` : ''}. Zjedz porządnie i wyśpij się!`,
        tag: `pace-evening-${workout.id}`,
        url: `/calendar/${workout.id}`,
      })

      try {
        await webpush.sendNotification(sub.subscription as unknown as webpush.PushSubscription, payload)
        sent++
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode
        if (statusCode === 410 || statusCode === 404) {
          staleEndpoints.push(sub.endpoint)
        } else {
          console.error('[PUSH] Evening send error:', err)
        }
        failed++
      }
    })
  )

  if (staleEndpoints.length) {
    await supabase.from('push_subscriptions').delete().in('endpoint', staleEndpoints)
  }

  return NextResponse.json({ sent, failed, stale: staleEndpoints.length })
}

// Vercel Cron sends GET
export { POST as GET }
