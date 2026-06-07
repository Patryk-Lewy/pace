import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import type { PlanJson, PlanWorkout } from '@/types/database'

export const maxDuration = 60 // Vercel: max 60s na Hobby, potrzebne dla Claude

function getAnthropic() {
  const key = process.env.ANTHROPIC_API_KEY
  console.log('[generate-plan] ANTHROPIC_API_KEY present:', !!key, 'length:', key?.length)
  if (!key) throw new Error('ANTHROPIC_API_KEY nie jest ustawiony')
  return new Anthropic({ apiKey: key })
}

/** Normalize any day representation Claude might return to the canonical
 *  short form (mon/tue/.../sun) used everywhere else in the app. */
function normalizeDay(raw: string): string {
  const d = (raw ?? '').trim().toLowerCase()
  const map: Record<string, string> = {
    monday: 'mon', mon: 'mon', poniedzialek: 'mon', 'poniedziałek': 'mon',
    tuesday: 'tue', tue: 'tue', wtorek: 'tue',
    wednesday: 'wed', wed: 'wed', sroda: 'wed', 'środa': 'wed',
    thursday: 'thu', thu: 'thu', czwartek: 'thu',
    friday: 'fri', fri: 'fri', piatek: 'fri', 'piątek': 'fri',
    saturday: 'sat', sat: 'sat', sobota: 'sat',
    sunday: 'sun', sun: 'sun', niedziela: 'sun',
  }
  return map[d] ?? d.slice(0, 3)
}

const DISTANCE_WEEKS: Record<string, number> = {
  '5km': 6,
  '10km': 8,
  'half': 8,
  'marathon': 8,
}

const DISTANCE_LABELS: Record<string, string> = {
  '5km': '5 km',
  '10km': '10 km',
  'half': 'półmaraton',
  'marathon': 'maraton',
}

function buildPrompt(profile: {
  race_distance: string
  race_date: string | null
  race_goal_time: string | null
  weekly_km: number | null
  best_5k_pace: string | null
  pb_5k: string | null
  pb_10k: string | null
  pb_half: string | null
  pb_marathon: string | null
  available_days: string[] | null
  max_session_minutes: number | null
  injury_history: string | null
  additional_goal: string | null
}): string {
  const weeks = DISTANCE_WEEKS[profile.race_distance] ?? 12
  const distanceLabel = DISTANCE_LABELS[profile.race_distance] ?? profile.race_distance
  const days = (profile.available_days ?? []).join(', ') || 'pon, śr, pt, ndz'

  // Build personal bests section
  const pbs = [
    profile.pb_5k       && `5 km: ${profile.pb_5k}`,
    profile.pb_10k      && `10 km: ${profile.pb_10k}`,
    profile.pb_half     && `Półmaraton: ${profile.pb_half}`,
    profile.pb_marathon && `Maraton: ${profile.pb_marathon}`,
  ].filter(Boolean)

  const pbSection = pbs.length > 0
    ? pbs.join(', ')
    : profile.best_5k_pace
      ? `Tempo na 5 km: ${profile.best_5k_pace} min/km (brak rekordów czasowych)`
      : 'nie podano — przyjmij poziom początkujący'

  const goalTimeSection = profile.race_goal_time
    ? `**CEL CZASOWY: ${profile.race_goal_time}** na ${distanceLabel}

## Jak użyć celu czasowego
1. Oblicz docelowe tempo wyścigu z celu czasowego (czas ÷ dystans w km).
2. Porównaj z obecną formą z rekordów życiowych (metoda VDOT).
3. Jeśli cel jest ambitny (szybszy niż wynikałoby z PB) — buduj plan progresywnie:
   pierwsze tygodnie (Baza) bazują na OBECNEJ formie, a kolejne fazy stopniowo
   przesuwają tempa w kierunku celu.
4. Jeśli cel jest realistyczny lub zachowawczy — trenuj bezpośrednio pod cel.
5. Zawsze podaj w opisie treningu konkretne tempo (min:sek/km) powiązane z celem.`
    : `## Jak używać rekordów życiowych
Na podstawie rekordów życiowych oblicz strefy treningowe metodą VDOT (Jack Daniels):
- Easy/Long run: ~70–75% VO2max tempo (ok. 60–90s wolniej niż tempo maratońskie)
- Tempo run: ~85–88% VO2max (tempo półmaratońskie lub wolniej)
- Interwały: ~95–100% VO2max (tempo 5 km lub szybciej)`

  return `Jesteś doświadczonym trenerem biegowym. Wygeneruj spersonalizowany plan treningowy w formacie JSON.

## Profil biegacza
- Dystans docelowy: ${distanceLabel}
- Data zawodów: ${profile.race_date ?? 'nie podano'}
- Rekordy życiowe (obecna forma): ${pbSection}
- Obecny kilometraż tygodniowy: ${profile.weekly_km ?? 'nie podano'} km/tydzień
- Dostępne dni: ${days}
- Max czas sesji: ${profile.max_session_minutes ?? 60} minut
- Historia kontuzji: ${profile.injury_history ?? 'brak'}
- Cel dodatkowy: ${profile.additional_goal ?? 'brak'}

${goalTimeSection}

Podaj konkretne tempa (min:sek/km) dopasowane do poziomu biegacza.

## Wymagania planu
- Długość: ${weeks} tygodni
- Fazy: Baza (25%), Budowanie (37%), Szczyt (25%), Tapering (13%)
- Typy treningów: easy_run, long_run, tempo, intervals, rest
- Stopniowe zwiększanie objętości (zasada 10%/tydzień)
- Uwzględnij kontuzje w doborze treningów

## Format JSON (zwróć WYŁĄCZNIE poprawny JSON, bez komentarzy):
{
  "plan_name": "16-tygodniowy plan maratoński",
  "total_weeks": ${weeks},
  "weeks": [
    {
      "week_number": 1,
      "phase": "Baza",
      "focus": "Budowanie bazy kilometrażowej",
      "total_km": 32,
      "workouts": [
        {
          "day": "mon",
          "workout_type": "easy_run",
          "title": "Bieg regeneracyjny",
          "distance_km": 8,
          "target_pace": "6:30",
          "duration_minutes": 55,
          "description": "Spokojny bieg w strefie Z1-Z2. Tempo konwersacyjne — powinieneś móc swobodnie rozmawiać."
        },
        {
          "day": "wed",
          "workout_type": "rest",
          "title": "Odpoczynek",
          "distance_km": null,
          "target_pace": null,
          "duration_minutes": null,
          "description": "Aktywna regeneracja: rozciąganie, rolowanie, spacer."
        }
      ]
    }
  ]
}

Wygeneruj plan dla wszystkich ${weeks} tygodni. Każdy tydzień ma treningi tylko w dniach: ${days}. Zwróć wyłącznie JSON.`
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // rebuild=true → keep completed/skipped workouts (and their linked Strava
    // activities), regenerate only the remaining planned ones in place.
    let rebuild = false
    try {
      const body = await request.json()
      rebuild = body?.rebuild === true
    } catch { /* no body → fresh generation */ }

    // Fetch runner profile
    const { data: profile, error: profileError } = await supabase
      .from('runner_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || !profile.race_distance) {
      return NextResponse.json({ error: 'Profil biegacza niekompletny' }, { status: 400 })
    }

    const safeProfile = {
      race_distance:    profile.race_distance as string,
      race_date:        profile.race_date,
      race_goal_time:   profile.race_goal_time ?? null,
      weekly_km:        profile.weekly_km,
      best_5k_pace:     profile.best_5k_pace,
      pb_5k:            profile.pb_5k,
      pb_10k:           profile.pb_10k,
      pb_half:          profile.pb_half,
      pb_marathon:      profile.pb_marathon,
      available_days:   profile.available_days,
      max_session_minutes: profile.max_session_minutes,
      injury_history:   profile.injury_history,
      additional_goal:  profile.additional_goal,
    }

    // Identify the existing active plan (needed for rebuild)
    const { data: existingPlan } = await supabase
      .from('training_plans')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Workouts the user already engaged with — preserved on rebuild
    let lockedCount = 0
    if (rebuild && existingPlan) {
      const { count } = await supabase
        .from('workouts')
        .select('id', { count: 'exact', head: true })
        .eq('plan_id', existingPlan.id)
        .in('status', ['completed', 'skipped'])
      lockedCount = count ?? 0
    }

    // Call Claude (Haiku — szybszy, mieści się w 60s limicie Vercel Hobby)
    const message = await getAnthropic().messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 8192,
      messages: [{ role: 'user', content: buildPrompt(safeProfile) }],
    })

    const rawText = message.content[0].type === 'text' ? message.content[0].text : ''

    // Extract JSON (Claude sometimes adds markdown fences)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Claude nie zwrócił poprawnego JSON' }, { status: 500 })
    }

    const planJson: PlanJson = JSON.parse(jsonMatch[0])

    // ── REBUILD: keep completed/skipped workouts, replace only the planned ──
    if (rebuild && existingPlan) {
      // Which (week, day) slots are locked by user progress?
      const { data: keep } = await supabase
        .from('workouts')
        .select('week_number, day_of_week')
        .eq('plan_id', existingPlan.id)
        .in('status', ['completed', 'skipped'])

      const lockedSlots = new Set((keep ?? []).map(w => `${w.week_number}:${w.day_of_week}`))

      // Remove only the still-planned workouts (preserves completed + their
      // matched_workout_id links from activities).
      await supabase
        .from('workouts')
        .delete()
        .eq('plan_id', existingPlan.id)
        .eq('status', 'planned')

      // Insert freshly generated workouts, skipping any locked slot
      const newRows = planJson.weeks.flatMap(week =>
        week.workouts
          .filter(w => !lockedSlots.has(`${week.week_number}:${normalizeDay(w.day)}`))
          .map((w: PlanWorkout) => ({
            plan_id: existingPlan.id,
            user_id: user.id,
            week_number: week.week_number,
            day_of_week: normalizeDay(w.day),
            workout_type: w.workout_type,
            title: w.title,
            description: w.description,
            distance_km: w.distance_km ?? null,
            target_pace: w.target_pace ?? null,
            duration_minutes: w.duration_minutes ?? null,
            phase: week.phase,
            status: 'planned',
          }))
      )

      if (newRows.length > 0) await supabase.from('workouts').insert(newRows)

      // Refresh plan metadata + name
      await supabase
        .from('training_plans')
        .update({
          plan_name: planJson.plan_name,
          race_distance: profile.race_distance,
          race_date: profile.race_date ?? null,
          total_weeks: planJson.total_weeks,
          plan_json: planJson as unknown as import('@/types/database').Json,
        })
        .eq('id', existingPlan.id)

      return NextResponse.json({
        plan_id: existingPlan.id,
        plan_name: planJson.plan_name,
        total_weeks: planJson.total_weeks,
        rebuilt: true,
        kept_workouts: lockedCount,
      })
    }

    // ── FRESH: archive old plan, create a brand new one ────────────────────
    await supabase
      .from('training_plans')
      .update({ status: 'archived' })
      .eq('user_id', user.id)
      .eq('status', 'active')

    // Save training plan
    const { data: savedPlan, error: planError } = await supabase
      .from('training_plans')
      .insert({
        user_id: user.id,
        plan_name: planJson.plan_name,
        race_distance: profile.race_distance,
        race_date: profile.race_date ?? null,
        total_weeks: planJson.total_weeks,
        status: 'active',
        plan_json: planJson as unknown as import('@/types/database').Json,
      })
      .select()
      .single()

    if (planError || !savedPlan) {
      return NextResponse.json({ error: 'Błąd zapisu planu' }, { status: 500 })
    }

    // Save individual workouts
    const workoutRows = planJson.weeks.flatMap(week =>
      week.workouts.map((w: PlanWorkout) => ({
        plan_id: savedPlan.id,
        user_id: user.id,
        week_number: week.week_number,
        day_of_week: normalizeDay(w.day),
        workout_type: w.workout_type,
        title: w.title,
        description: w.description,
        distance_km: w.distance_km ?? null,
        target_pace: w.target_pace ?? null,
        duration_minutes: w.duration_minutes ?? null,
        phase: week.phase,
        status: 'planned',
      }))
    )

    await supabase.from('workouts').insert(workoutRows)

    return NextResponse.json({ plan_id: savedPlan.id, plan_name: planJson.plan_name, total_weeks: planJson.total_weeks })
  } catch (err) {
    console.error('generate-plan error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Błąd generowania planu', detail: message }, { status: 500 })
  }
}
