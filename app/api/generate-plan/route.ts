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
  race_goal: string | null
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
    profile.pb_5k      && `5 km: ${profile.pb_5k}`,
    profile.pb_10k     && `10 km: ${profile.pb_10k}`,
    profile.pb_half    && `Półmaraton: ${profile.pb_half}`,
    profile.pb_marathon && `Maraton: ${profile.pb_marathon}`,
  ].filter(Boolean)

  const pbSection = pbs.length > 0
    ? pbs.join(', ')
    : profile.best_5k_pace
      ? `Tempo na 5 km: ${profile.best_5k_pace} min/km (brak rekordów czasowych)`
      : 'nie podano — przyjmij poziom początkujący'

  return `Jesteś doświadczonym trenerem biegowym. Wygeneruj spersonalizowany plan treningowy w formacie JSON.

## Profil biegacza
- Cel startowy: ${distanceLabel}${profile.race_goal ? ` — "${profile.race_goal}"` : ''}
- Data zawodów: ${profile.race_date ?? 'nie podano'}
- Rekordy życiowe (użyj do obliczenia stref i temp treningowych): ${pbSection}
- Obecny kilometraż tygodniowy: ${profile.weekly_km ?? 'nie podano'} km/tydzień
- Dostępne dni: ${days}
- Max czas sesji: ${profile.max_session_minutes ?? 60} minut
- Historia kontuzji: ${profile.injury_history ?? 'brak'}
- Cel dodatkowy: ${profile.additional_goal ?? 'brak'}

## Jak używać rekordów życiowych
Na podstawie rekordów życiowych oblicz strefy treningowe metodą VDOT (Jack Daniels):
- Easy/Long run: ~70–75% VO2max tempo (ok. 60–90s wolniej niż tempo maratońskie)
- Tempo run: ~85–88% VO2max (tempo półmaratońskie lub wolniej)
- Interwały: ~95–100% VO2max (tempo 5 km lub szybciej)
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
      race_goal:        profile.race_goal,
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

    // Archive existing active plan
    await supabase
      .from('training_plans')
      .update({ status: 'archived' })
      .eq('user_id', user.id)
      .eq('status', 'active')

    // Call Claude (Haiku — szybszy, mieści się w 60s limicie Vercel Hobby)
    const message = await getAnthropic().messages.create({
      model: 'claude-3-5-haiku-20241022',
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
        day_of_week: w.day,
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
