import { NextResponse, type NextRequest } from 'next/server'
import webpush from 'web-push'
import { createServiceClient } from '@/lib/supabase/service'
import type { PushSubscriptionRow } from '@/types/database'

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
)

const DAY_MAP: Record<number, string> = {
  0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat',
}

// POST /api/notifications/send
// Called by Vercel Cron daily at 07:00 UTC. Secret-protected.
export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.NOTIFICATIONS_SECRET}`) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Service client required — cron has no user session, anon key blocked by RLS
  const supabase = createServiceClient()
  const today = DAY_MAP[new Date().getDay()]

  const { data: workouts } = await supabase
    .from('workouts')
    .select('id, user_id, title, workout_type, distance_km, target_pace, duration_minutes')
    .eq('day_of_week', today)
    .eq('status', 'planned')
    .neq('workout_type', 'rest')

  if (!workouts?.length) {
    return NextResponse.json({ sent: 0, message: 'No workouts today' })
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
        workout.duration_minutes ? `~${workout.duration_minutes} min` : null,
      ].filter(Boolean).join(' · ')

      const payload = JSON.stringify({
        title: `PACE — Dziś masz trening! 🏃`,
        body: `${workout.title}${details ? `\n${details}` : ''}`,
        tag: `pace-workout-${workout.id}`,
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
          console.error('[PUSH] Send error:', err)
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
