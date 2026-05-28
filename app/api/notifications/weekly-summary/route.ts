import { NextResponse, type NextRequest } from 'next/server'
import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/service'
import { formatPace } from '@/lib/strava'

export const maxDuration = 60

// POST /api/notifications/weekly-summary
// Called by Vercel Cron every Sunday at 08:00 UTC.
// Sends each user a summary of the past week and preview of the next.
export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.NOTIFICATIONS_SECRET}`) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return NextResponse.json({ ok: true, skipped: true })

  const supabase = createServiceClient()
  const resend = new Resend(resendKey)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pace-murex.vercel.app'

  const fromAddress = process.env.RESEND_DOMAIN === 'resend.dev'
    ? 'PACE <onboarding@resend.dev>'
    : `PACE <hello@${process.env.RESEND_DOMAIN}>`

  // Date range: last 7 days
  const now = new Date()
  const weekAgo = new Date(now)
  weekAgo.setDate(now.getDate() - 7)
  const weekAgoISO = weekAgo.toISOString()

  // Next 7 days
  const nextWeekISO = new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString()

  // Fetch all users with active plans
  const { data: plans, error: plansError } = await supabase
    .from('training_plans')
    .select('user_id')
    .eq('status', 'active')

  if (plansError || !plans?.length) {
    return NextResponse.json({
      sent: 0,
      debug: {
        plansError: plansError?.message ?? null,
        plansCount: plans?.length ?? 0,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        hasResendKey: !!process.env.RESEND_API_KEY,
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      },
    })
  }

  const userIds = [...new Set(plans.map(p => p.user_id))]

  // Fetch emails from auth
  let sent = 0
  let failed = 0

  for (const userId of userIds) {
    try {
      // Get user email
      const { data: { user: authUser } } = await supabase.auth.admin.getUserById(userId)
      if (!authUser?.email) continue

      // Activities this week
      const { data: activities } = await supabase
        .from('activities')
        .select('distance_m, moving_time_s, avg_pace_s_per_km')
        .eq('user_id', userId)
        .gte('start_date', weekAgoISO)
        .order('start_date', { ascending: false })

      const runs = activities ?? []
      const totalKm = runs.reduce((s, a) => s + (a.distance_m ?? 0) / 1000, 0)
      const totalTime = runs.reduce((s, a) => s + (a.moving_time_s ?? 0), 0)
      const paces = runs.filter(a => a.avg_pace_s_per_km).map(a => a.avg_pace_s_per_km!)
      const avgPace = paces.length ? Math.round(paces.reduce((s, p) => s + p, 0) / paces.length) : null

      // Planned workouts next week
      const { data: nextWorkouts } = await supabase
        .from('workouts')
        .select('title, distance_km, target_pace, day_of_week, workout_type')
        .eq('user_id', userId)
        .eq('status', 'planned')
        .neq('workout_type', 'rest')
        .limit(5)

      const upcoming = nextWorkouts ?? []

      // Don't send if user had zero activity AND zero upcoming — nothing useful to say
      if (runs.length === 0 && upcoming.length === 0) continue

      const html = buildWeeklySummaryEmail({
        appUrl,
        runs: runs.length,
        totalKm,
        totalTime,
        avgPace,
        upcoming,
      })

      await resend.emails.send({
        from: fromAddress,
        to: authUser.email,
        subject: `PACE — Twoje podsumowanie tygodnia 📊`,
        html,
      })

      sent++
    } catch (err) {
      console.error(`[WEEKLY SUMMARY] Failed for user ${userId}:`, err)
      failed++
    }
  }

  return NextResponse.json({ sent, failed })
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}min`
  return `${m} min`
}

const DAY_LABELS: Record<string, string> = {
  mon: 'Pn', tue: 'Wt', wed: 'Śr', thu: 'Cz', fri: 'Pt', sat: 'Sb', sun: 'Nd',
}

function buildWeeklySummaryEmail({
  appUrl, runs, totalKm, totalTime, avgPace, upcoming,
}: {
  appUrl: string
  runs: number
  totalKm: number
  totalTime: number
  avgPace: number | null
  upcoming: { title: string; distance_km?: number | null; target_pace?: string | null; day_of_week?: string | null }[]
}): string {
  const hadActivity = runs > 0

  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Podsumowanie tygodnia — PACE</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e5e5e5;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">

    <!-- Logo -->
    <div style="margin-bottom:32px;">
      <span style="font-size:24px;font-weight:900;letter-spacing:0.15em;text-transform:uppercase;color:#00e676;">PACE</span>
    </div>

    <!-- Heading -->
    <h1 style="font-size:32px;font-weight:900;line-height:1.1;margin:0 0 8px;color:#fff;">
      ${hadActivity ? 'Świetny tydzień! 💪' : 'Nowy tydzień, nowe możliwości 🏃'}
    </h1>
    <p style="font-size:14px;color:#737373;margin:0 0 32px;">
      Twoje podsumowanie z ostatnich 7 dni
    </p>

    ${hadActivity ? `
    <!-- Stats grid -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:32px;">
      ${[
        ['Biegi', String(runs), ''],
        ['Dystans', totalKm.toFixed(1), 'km'],
        ['Śr. tempo', avgPace ? formatPace(avgPace) : '—', avgPace ? '/km' : ''],
      ].map(([label, value, unit]) => `
      <div style="background:#141414;border:1px solid #262626;border-radius:12px;padding:16px;text-align:center;">
        <p style="font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#525252;margin:0 0 6px;">${label}</p>
        <p style="font-size:26px;font-weight:900;color:#00e676;margin:0;line-height:1;">${value}</p>
        ${unit ? `<p style="font-size:11px;color:#737373;margin:4px 0 0;">${unit}</p>` : ''}
      </div>`).join('')}
    </div>
    ${totalTime > 0 ? `<p style="font-size:13px;color:#737373;margin:-16px 0 32px;text-align:center;">Łączny czas w ruchu: <strong style="color:#a3a3a3;">${formatDuration(totalTime)}</strong></p>` : ''}
    ` : `
    <!-- No activity message -->
    <div style="background:#141414;border:1px solid #262626;border-radius:12px;padding:24px;margin-bottom:32px;text-align:center;">
      <p style="font-size:14px;color:#737373;margin:0;">W tym tygodniu nie masz jeszcze żadnego biegu. Plan na nowy tydzień czeka!</p>
    </div>
    `}

    ${upcoming.length > 0 ? `
    <!-- Next workouts -->
    <div style="background:#141414;border:1px solid #262626;border-radius:16px;overflow:hidden;margin-bottom:32px;">
      <div style="background:#1a1a1a;padding:14px 20px;border-bottom:1px solid #262626;">
        <p style="font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#525252;margin:0;">
          Najbliższe treningi
        </p>
      </div>
      ${upcoming.map(w => `
      <div style="padding:14px 20px;border-bottom:1px solid #1a1a1a;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            ${w.day_of_week ? `<span style="font-size:11px;font-weight:600;color:#525252;text-transform:uppercase;letter-spacing:0.08em;">${DAY_LABELS[w.day_of_week] ?? w.day_of_week} · </span>` : ''}
            <span style="font-size:14px;font-weight:600;color:#e5e5e5;">${w.title}</span>
          </div>
          <div style="text-align:right;">
            ${w.distance_km ? `<span style="font-size:14px;font-weight:700;color:#00e676;">${w.distance_km} km</span>` : ''}
            ${w.target_pace ? `<span style="font-size:12px;color:#737373;display:block;">${w.target_pace?.match(/^\d+:\d{2}/)?.[0] ?? w.target_pace}/km</span>` : ''}
          </div>
        </div>
      </div>`).join('')}
    </div>
    ` : ''}

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:40px;">
      <a href="${appUrl}/dashboard"
        style="display:inline-block;background:#00e676;color:#000;font-weight:900;font-size:13px;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none;padding:14px 32px;border-radius:12px;">
        Otwórz PACE →
      </a>
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid #1f1f1f;padding-top:20px;">
      <p style="font-size:12px;color:#525252;margin:0;">
        PACE · AI trener biegowy · Powered by Claude
      </p>
      <p style="font-size:12px;color:#3a3a3a;margin:6px 0 0;">
        Wysyłamy to podsumowanie co niedzielę dla użytkowników z aktywnym planem.
      </p>
    </div>

  </div>
</body>
</html>`
}
