import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import StravaToast from '@/components/StravaToast'
import TodayBanner from '@/components/TodayBanner'
import AdaptationBanner from '@/components/AdaptationBanner'
import type { AdaptationResult } from '@/lib/plan-adaptation'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ strava?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams

  const [
    { data: profile },
    { data: activePlan },
    { data: nextWorkout },
    { data: stravaToken },
    { data: recentActivity },
    { data: adaptationComment },
  ] = await Promise.all([
    supabase.from('runner_profiles').select('*').eq('id', user.id).single(),
    supabase.from('training_plans').select('*').eq('user_id', user.id).eq('status', 'active').order('created_at', { ascending: false }).maybeSingle(),
    supabase.from('workouts').select('*').eq('user_id', user.id).eq('status', 'planned').order('week_number').order('day_of_week').maybeSingle(),
    supabase.from('strava_tokens').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('activities').select('*').eq('user_id', user.id).order('start_date', { ascending: false }).maybeSingle(),
    supabase.from('ai_comments').select('id, content').eq('user_id', user.id).eq('comment_type', 'plan_adaptation').order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  // Parse pending adaptation suggestion (skip if applied or dismissed)
  let pendingAdaptation: { id: string; result: AdaptationResult } | null = null
  if (adaptationComment) {
    try {
      const parsed = JSON.parse(adaptationComment.content) as AdaptationResult
      if (!parsed.dismissed && !parsed.applied) {
        pendingAdaptation = { id: adaptationComment.id, result: parsed }
      }
    } catch { /* ignore */ }
  }

  if (profile && !profile.onboarding_completed) redirect('/onboarding')

  const distanceLabels: Record<string, string> = {
    '5km': '5 km', '10km': '10 km', half: 'Półmaraton', marathon: 'Maraton',
  }

  const completedCount = activePlan
    ? (await supabase.from('workouts').select('id', { count: 'exact' }).eq('plan_id', activePlan.id).eq('status', 'completed')).count ?? 0
    : 0

  const totalCount = activePlan
    ? (await supabase.from('workouts').select('id', { count: 'exact' }).eq('plan_id', activePlan.id).neq('workout_type', 'rest')).count ?? 0
    : 0

  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return (
    <div className="max-w-4xl animate-fade-up">
      {params.strava && <StravaToast status={params.strava} />}

      <div className="mb-8">
        <h1 className="text-5xl font-black mb-1" style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif' }}>
          Dashboard
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-2)' }}>{user.email}</p>
      </div>

      <TodayBanner />

      {/* Race day banner — visible when race is ≤14 days away */}
      {profile?.race_date && profile?.race_goal_time && (() => {
        const daysLeft = Math.ceil(
          (new Date(profile.race_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        )
        if (daysLeft > 14 || daysLeft < 0) return null
        return (
          <Link href="/race" className="block mb-4">
            <div className="rounded-2xl px-5 py-4 flex items-center justify-between transition-all hover:scale-[1.01]"
              style={{ background: 'var(--green-dim)', border: '1px solid var(--green)' }}>
              <div>
                <p className="text-sm font-black" style={{ color: 'var(--green)' }}>
                  🏁 Zawody za {daysLeft === 0 ? 'dziś!' : `${daysLeft} ${daysLeft === 1 ? 'dzień' : 'dni'}`}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>
                  Sprawdź strategię startową — plan tempa co 5 km
                </p>
              </div>
              <span className="text-lg" style={{ color: 'var(--green)' }}>→</span>
            </div>
          </Link>
        )
      })()}

      {/* AI plan adaptation suggestion */}
      {pendingAdaptation && (
        <AdaptationBanner
          commentId={pendingAdaptation.id}
          result={pendingAdaptation.result}
        />
      )}

      {/* Profile stats — compact horizontal strip */}
      {profile && (
        <div className="rounded-2xl mb-6 overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="grid grid-cols-3">
            <StatItem label="Cel" value={distanceLabels[profile.race_distance ?? ''] ?? '—'} />
            <StatItem label="Km / tydz." value={profile.weekly_km ? `${profile.weekly_km} km` : '—'} />
            <StatItem label="Rekord 5 km" value={profile.pb_5k ?? profile.best_5k_pace ?? '—'} />
          </div>
        </div>
      )}

      {/* Active plan */}
      {activePlan ? (
        <div className="space-y-4 mb-6">
          <div className="rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--text-3)' }}>Aktywny plan</p>
                <h2 className="text-xl font-black" style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif' }}>
                  {activePlan.plan_name}
                </h2>
              </div>
              <p className="text-4xl font-black" style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif', color: 'var(--green)' }}>
                {progressPct}%
              </p>
            </div>
            <div className="h-1.5 rounded-full mb-2" style={{ background: 'var(--surface3)' }}>
              <div className="h-1.5 rounded-full transition-all duration-1000"
                style={{ width: `${progressPct}%`, background: 'var(--green)' }} />
            </div>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>
              {completedCount} / {totalCount} treningów ukończonych
            </p>
          </div>

          {nextWorkout && (
            <Link href={`/calendar/${nextWorkout.id}`}>
              <div className="rounded-2xl p-5 cursor-pointer transition-all hover:scale-[1.01]"
                style={{ background: 'var(--surface)', border: '1px solid var(--green)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'var(--green)' }} />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--green)' }}>
                      Następny trening · Tydzień {nextWorkout.week_number}
                    </p>
                    <p className="text-lg font-black" style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif' }}>
                      {nextWorkout.title}
                    </p>
                    <div className="flex gap-3 mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                      {nextWorkout.distance_km && <span>{nextWorkout.distance_km} km</span>}
                      {nextWorkout.target_pace && <span>@ {nextWorkout.target_pace.match(/^\d+:\d{2}/)?.[0] ?? nextWorkout.target_pace}/km</span>}
                      {nextWorkout.duration_minutes && <span>~{nextWorkout.duration_minutes} min</span>}
                    </div>
                  </div>
                  <span className="text-2xl">→</span>
                </div>
              </div>
            </Link>
          )}

          <div className="flex gap-3">
            <Link href="/plan" className="flex-1">
              <div className="rounded-xl py-3 text-sm font-bold text-center transition-all hover:opacity-80"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                Plan →
              </div>
            </Link>
            <Link href="/calendar" className="flex-1">
              <div className="rounded-xl py-3 text-sm font-bold text-center transition-all hover:opacity-80"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                Kalendarz →
              </div>
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl p-8 flex flex-col items-center text-center mb-6"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="text-4xl mb-4">🤖</div>
          <h2 className="text-2xl font-black mb-2" style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif' }}>
            Brak aktywnego planu
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-2)' }}>Claude wygeneruje plan skrojony pod Ciebie.</p>
          <Link href="/plan">
            <button className="rounded-xl px-8 py-3 text-sm font-black uppercase tracking-widest transition-all hover:-translate-y-0.5"
              style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif', background: 'var(--green)', color: '#000' }}>
              Wygeneruj plan →
            </button>
          </Link>
        </div>
      )}

      {/* Strava section */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {stravaToken ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {stravaToken.athlete_photo && (
                <img src={stravaToken.athlete_photo} alt="strava" className="w-10 h-10 rounded-full" />
              )}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--green)' }}>
                  ● Strava połączona
                </p>
                <p className="text-sm font-bold">{stravaToken.athlete_name}</p>
              </div>
            </div>
            {recentActivity && (
              <div className="text-right">
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>Ostatni bieg</p>
                <p className="text-sm font-semibold">{((recentActivity.distance_m ?? 0) / 1000).toFixed(2)} km</p>
              </div>
            )}
            <Link href="/stats" className="text-sm font-semibold" style={{ color: 'var(--text-2)' }}>
              Statystyki →
            </Link>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold mb-0.5">Połącz Stravę</p>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>Automatyczna analiza AI po każdym biegu</p>
            </div>
            <a href="/api/strava/connect"
              className="rounded-xl px-4 py-2 text-sm font-black uppercase tracking-widest"
              style={{ background: '#FC4C02', color: '#fff', fontFamily: 'var(--font-barlow-condensed), sans-serif' }}>
              Połącz →
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 text-center border-r last:border-r-0" style={{ borderColor: 'var(--border)' }}>
      <p className="text-xs font-semibold uppercase tracking-widest mb-1 truncate" style={{ color: 'var(--text-3)' }}>{label}</p>
      <p className="text-xl font-black leading-tight" style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif', color: 'var(--green)' }}>
        {value}
      </p>
    </div>
  )
}
