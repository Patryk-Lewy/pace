import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import StravaToast from '@/components/StravaToast'
import TodayBanner from '@/components/TodayBanner'
import AdaptationBanner from '@/components/AdaptationBanner'
import { formatPace } from '@/lib/strava'
import { computeWorkoutDate } from '@/lib/workout-matching'
import { metaFor, shortPace } from '@/lib/workout-meta'
import type { AdaptationResult } from '@/lib/plan-adaptation'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ strava?: string }>
}) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  const user = session.user

  const params = await searchParams
  const weekAgoISO = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()

  const [
    { data: profile },
    { data: activePlan },
    { data: adaptationComment },
    { data: weekActivities },
  ] = await Promise.all([
    supabase.from('runner_profiles').select('*').eq('id', user.id).single(),
    supabase.from('training_plans').select('*').eq('user_id', user.id).eq('status', 'active').order('created_at', { ascending: false }).maybeSingle(),
    supabase.from('ai_comments').select('id, content').eq('user_id', user.id).eq('comment_type', 'plan_adaptation').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('activities').select('distance_m, avg_pace_s_per_km').eq('user_id', user.id).eq('hidden', false).gte('start_date', weekAgoISO),
  ])

  if (profile && !profile.onboarding_completed) redirect('/onboarding')

  // Planned workouts — scoped to the ACTIVE plan only (not archived plans)
  // One fetch of the plan's workouts; planned list + progress counts derived below.
  const { data: allWorkouts } = activePlan
    ? await supabase.from('workouts')
        .select('id, title, week_number, day_of_week, status, workout_type, distance_km, target_pace, duration_minutes, phase')
        .eq('plan_id', activePlan.id)
    : { data: null }

  const plannedWorkouts = (allWorkouts ?? []).filter(w => w.status === 'planned' && w.workout_type !== 'rest')

  // Weekly summary stats (last 7 days)
  const weekRuns = weekActivities ?? []
  const weekKm = weekRuns.reduce((s, a) => s + (a.distance_m ?? 0) / 1000, 0)
  const weekPaces = weekRuns.filter(a => a.avg_pace_s_per_km).map(a => a.avg_pace_s_per_km!)
  const weekAvgPace = weekPaces.length ? Math.round(weekPaces.reduce((s, p) => s + p, 0) / weekPaces.length) : null

  // "Next workout" = nearest planned workout by actual date (prefer upcoming).
  let nextWorkout: NonNullable<typeof plannedWorkouts>[number] | null = null
  let todayWorkout: NonNullable<typeof plannedWorkouts>[number] | null = null
  if (activePlan && plannedWorkouts?.length) {
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const endOfToday = startOfToday.getTime() + 86_400_000
    const dated = plannedWorkouts
      .map(w => ({ w, date: computeWorkoutDate(activePlan.created_at, w.week_number, w.day_of_week) }))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
    const upcoming = dated.find(d => d.date.getTime() >= startOfToday.getTime())
    nextWorkout = (upcoming ?? dated[dated.length - 1]).w
    todayWorkout = dated.find(d =>
      d.date.getTime() >= startOfToday.getTime() && d.date.getTime() < endOfToday
    )?.w ?? null
  }

  // Pending AI adaptation (skip if applied/dismissed)
  let pendingAdaptation: { id: string; result: AdaptationResult } | null = null
  if (adaptationComment) {
    try {
      const parsed = JSON.parse(adaptationComment.content) as AdaptationResult
      if (!parsed.dismissed && !parsed.applied) pendingAdaptation = { id: adaptationComment.id, result: parsed }
    } catch { /* ignore */ }
  }

  // Plan progress — derived from the single workouts fetch above
  const completedCount = (allWorkouts ?? []).filter(w => w.status === 'completed').length
  const totalCount = (allWorkouts ?? []).filter(w => w.workout_type !== 'rest').length
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  // Days until race
  const daysToRace = profile?.race_date
    ? Math.ceil((new Date(profile.race_date).getTime() - Date.now()) / 86_400_000)
    : null

  const firstName = deriveName(user.email)
  const avatarInitial = firstName.charAt(0).toUpperCase()
  const dateLabel = capitalize(new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' }))

  return (
    <div className="animate-fade-up">
      {params.strava && <StravaToast status={params.strava} />}

      {/* Header */}
      <div className="flex items-center justify-between" style={{ padding: '18px 0 22px' }}>
        <div>
          <div style={{ font: '500 13px var(--font-barlow)', color: 'var(--text-2)' }}>{dateLabel}</div>
          <div className="cond" style={{ fontSize: 30, marginTop: 2 }}>Cześć, {firstName}</div>
        </div>
        <Link href="/settings" aria-label="Ustawienia"
          className="press flex items-center justify-center"
          style={{
            width: 42, height: 42, borderRadius: '50%', background: 'var(--surface2)',
            border: '1px solid rgba(255,255,255,.08)',
            fontFamily: 'var(--font-barlow-condensed)', fontWeight: 800, fontSize: 16, color: 'var(--green)',
          }}>
          {avatarInitial}
        </Link>
      </div>

      <TodayBanner workout={todayWorkout} />

      {pendingAdaptation && (
        <AdaptationBanner commentId={pendingAdaptation.id} result={pendingAdaptation.result} />
      )}

      {/* Hero — today's / next workout */}
      {activePlan && nextWorkout ? (
        <HeroWorkout workout={nextWorkout} />
      ) : !activePlan ? (
        <NoPlanCard />
      ) : (
        <div className="rounded-3xl p-6 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="cond" style={{ fontSize: 22 }}>Plan ukończony 🎉</div>
          <p style={{ font: '500 13px var(--font-barlow)', color: 'var(--text-2)', marginTop: 6 }}>
            Brak zaplanowanych treningów.
          </p>
        </div>
      )}

      {/* Race countdown banner (≤ 60 days) */}
      {daysToRace !== null && daysToRace >= 0 && daysToRace <= 60 && (
        <Link href="/race" className="press block" style={{ marginTop: 12, textDecoration: 'none' }}>
          <div className="flex items-center gap-3"
            style={{ borderRadius: 18, padding: '15px 18px', background: 'var(--green-dim)', border: '1px solid rgba(0,230,118,.25)' }}>
            <span style={{ fontSize: 20 }}>🏁</span>
            <div style={{ flex: 1 }}>
              <div style={{ font: '700 14px var(--font-barlow)', color: 'var(--green)' }}>
                {raceLabel(profile?.race_distance)} za {daysToRace === 0 ? 'dziś!' : `${daysToRace} ${daysToRace === 1 ? 'dzień' : 'dni'}`}
              </div>
              <div style={{ font: '500 12px var(--font-barlow)', color: 'var(--text-2)' }}>Zobacz strategię startową</div>
            </div>
            <span style={{ color: 'var(--green)' }}>›</span>
          </div>
        </Link>
      )}

      {/* Plan progress */}
      {activePlan && (
        <div style={{ borderRadius: 22, padding: '18px 20px', background: 'var(--surface)', border: '1px solid var(--border)', marginTop: 12 }}>
          <div className="flex justify-between items-baseline" style={{ marginBottom: 12 }}>
            <div>
              <div className="kick" style={{ fontSize: 10, color: 'var(--text-3)' }}>Faza: {nextWorkout?.phase ?? '—'}</div>
              <div style={{ font: '600 15px var(--font-barlow)', marginTop: 2 }}>
                Tydzień {nextWorkout?.week_number ?? 1} z {activePlan.total_weeks}
              </div>
            </div>
            <div className="cond" style={{ fontSize: 26, color: 'var(--green)' }}>{progressPct}<span style={{ fontSize: 14 }}>%</span></div>
          </div>
          <div style={{ height: 6, borderRadius: 6, background: 'var(--surface3)', overflow: 'hidden' }}>
            <div className="transition-all duration-1000" style={{ width: `${progressPct}%`, height: '100%', background: 'var(--green)', borderRadius: 6 }} />
          </div>
          <p style={{ font: '500 11px var(--font-barlow)', color: 'var(--text-3)', marginTop: 8 }}>
            {completedCount} / {totalCount} treningów ukończonych
          </p>
        </div>
      )}

      {/* Mini stats — last 7 days */}
      <div className="flex" style={{ gap: 10, marginTop: 12 }}>
        <MiniStat label="7 dni · km" value={weekKm > 0 ? weekKm.toFixed(1) : '—'} />
        <MiniStat label="Śr. tempo" value={weekAvgPace ? formatPace(weekAvgPace) : '—'} />
        <MiniStat label="Biegi" value={String(weekRuns.length)} accent />
      </div>
    </div>
  )
}

// ─── Components ───────────────────────────────────────────────────────────────

function HeroWorkout({ workout }: { workout: { id: string; title: string; workout_type: string; week_number: number; distance_km: number | null; target_pace: string | null; duration_minutes: number | null } }) {
  const meta = metaFor(workout.workout_type)
  const pace = shortPace(workout.target_pace)
  return (
    <div style={{
      borderRadius: 26, padding: 24, position: 'relative', overflow: 'hidden',
      background: 'linear-gradient(160deg, rgba(0,230,118,.14), rgba(0,230,118,.03))',
      border: '1px solid rgba(0,230,118,.35)',
    }}>
      <div style={{ position: 'absolute', right: -30, top: -30, width: 150, height: 150, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,230,118,.18), transparent 70%)' }} />
      <div className="kick" style={{ fontSize: 11, color: 'var(--green)' }}>Dziś · Tydzień {workout.week_number}</div>
      <div className="cond" style={{ fontSize: 40, margin: '8px 0 4px' }}>{workout.title}</div>
      <div className="inline-flex items-center" style={{ gap: 6, background: meta.bg, color: meta.color, borderRadius: 20, padding: '5px 12px', font: '700 11px var(--font-barlow)' }}>
        {meta.emoji} {meta.label.toUpperCase()} · STREFA {meta.zone}
      </div>
      <div className="flex" style={{ gap: 10, marginTop: 22 }}>
        <HeroMetric label="Dystans" value={workout.distance_km ?? '—'} unit="km" />
        <HeroMetric label="Tempo" value={pace ?? '—'} unit={pace ? '/km' : ''} />
        <HeroMetric label="Czas" value={workout.duration_minutes ?? '—'} unit={workout.duration_minutes ? 'min' : ''} />
      </div>
      <div className="flex" style={{ gap: 10, marginTop: 16 }}>
        <Link href="/run" className="press" style={{
          flex: 2, background: 'var(--green)', color: '#000', borderRadius: 16, padding: 16, textAlign: 'center',
          font: '800 15px var(--font-barlow-condensed)', letterSpacing: 1.5, textTransform: 'uppercase', textDecoration: 'none',
        }}>Zacznij trening →</Link>
        <Link href={`/calendar/${workout.id}`} className="press flex items-center justify-center" style={{
          flex: 1, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', color: 'var(--text)',
          borderRadius: 16, font: '700 12px var(--font-barlow)', textDecoration: 'none',
        }}>Szczegóły</Link>
      </div>
    </div>
  )
}

function HeroMetric({ label, value, unit }: { label: string; value: string | number; unit: string }) {
  return (
    <div style={{ flex: 1, background: 'rgba(255,255,255,.05)', borderRadius: 16, padding: '12px 8px', textAlign: 'center' }}>
      <div className="kick" style={{ fontSize: 9, color: 'var(--text-3)' }}>{label}</div>
      <div className="cond" style={{ fontSize: 26, marginTop: 3 }}>{value}<span style={{ fontSize: 13, fontWeight: 600 }}>{unit}</span></div>
    </div>
  )
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ flex: 1, borderRadius: 18, padding: '14px 12px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="kick" style={{ fontSize: 9, color: 'var(--text-3)' }}>{label}</div>
      <div className="cond" style={{ fontSize: 28, marginTop: 4, color: accent ? 'var(--green)' : 'var(--text)' }}>{value}</div>
    </div>
  )
}

function NoPlanCard() {
  return (
    <div className="flex flex-col items-center text-center" style={{ borderRadius: 26, padding: 32, background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>🤖</div>
      <div className="cond" style={{ fontSize: 24, marginBottom: 8 }}>Brak aktywnego planu</div>
      <p style={{ font: '500 13px var(--font-barlow)', color: 'var(--text-2)', marginBottom: 20 }}>Claude wygeneruje plan skrojony pod Ciebie.</p>
      <Link href="/plan" className="press" style={{
        background: 'var(--green)', color: '#000', borderRadius: 16, padding: '14px 28px',
        font: '800 14px var(--font-barlow-condensed)', letterSpacing: 1.5, textTransform: 'uppercase', textDecoration: 'none',
      }}>Wygeneruj plan →</Link>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveName(email: string | undefined): string {
  if (!email) return 'Biegaczu'
  const local = email.split('@')[0].split(/[._-]/)[0]
  return capitalize(local)
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function raceLabel(distance: string | null | undefined): string {
  const map: Record<string, string> = { '5km': 'Bieg 5 km', '10km': 'Bieg 10 km', half: 'Półmaraton', marathon: 'Maraton' }
  return map[distance ?? ''] ?? 'Zawody'
}
