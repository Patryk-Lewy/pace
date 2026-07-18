import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 30

type ChatMessage = { role: 'user' | 'assistant'; content: string }

const DISTANCE_LABELS: Record<string, string> = {
  '5km': '5 km', '10km': '10 km', half: 'półmaraton', marathon: 'maraton',
}

// POST /api/coach — contextual chat with the PACE AI coach.
// Client sends the running conversation; the server grounds Claude in the
// user's profile, active plan, and recent training data.
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const incoming: ChatMessage[] = Array.isArray(body?.messages) ? body.messages : []
    const messages = incoming
      .filter(m => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string')
      .slice(-12)
      .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }))

    if (!messages.length || messages[messages.length - 1].role !== 'user') {
      return NextResponse.json({ error: 'Brak wiadomości' }, { status: 400 })
    }

    // ── Context ────────────────────────────────────────────────────────────
    const [{ data: profile }, { data: plan }] = await Promise.all([
      supabase.from('runner_profiles')
        .select('race_distance, race_date, race_goal_time, weekly_km, pb_5k, pb_10k, pb_half, pb_marathon, injury_history, additional_goal')
        .eq('id', user.id).maybeSingle(),
      supabase.from('training_plans').select('id, plan_name, total_weeks, race_date')
        .eq('user_id', user.id).eq('status', 'active')
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ])

    const [{ data: recentWorkouts }, { data: recentActivities }] = await Promise.all([
      plan
        ? supabase.from('workouts')
            .select('title, workout_type, week_number, day_of_week, status, distance_km, target_pace, rpe, user_notes')
            .eq('plan_id', plan.id).order('week_number').limit(60)
        : Promise.resolve({ data: null }),
      supabase.from('activities')
        .select('name, start_date, distance_m, avg_pace_s_per_km, avg_heartrate')
        .eq('user_id', user.id).eq('hidden', false)
        .order('start_date', { ascending: false }).limit(8),
    ])

    const fmtPace = (s: number | null) => s ? `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}` : '—'

    const workoutLines = (recentWorkouts ?? [])
      .filter(w => w.workout_type !== 'rest')
      .map(w => {
        const extras = [
          w.status === 'completed' ? '✓ ukończony' : w.status === 'skipped' ? 'pominięty' : 'zaplanowany',
          w.rpe != null && `RPE ${w.rpe}/10`,
          w.user_notes && `notatka: "${w.user_notes.slice(0, 150)}"`,
        ].filter(Boolean).join(', ')
        return `- T${w.week_number}/${w.day_of_week}: ${w.title} (${w.distance_km ?? '?'} km @ ${w.target_pace ?? '—'}) — ${extras}`
      }).join('\n')

    const activityLines = (recentActivities ?? []).map(a =>
      `- ${new Date(a.start_date).toLocaleDateString('pl-PL')}: ${a.name}, ${((a.distance_m ?? 0) / 1000).toFixed(1)} km @ ${fmtPace(a.avg_pace_s_per_km)}/km${a.avg_heartrate ? `, HR ${Math.round(a.avg_heartrate)}` : ''}`
    ).join('\n')

    const pbs = [
      profile?.pb_5k && `5k ${profile.pb_5k}`,
      profile?.pb_10k && `10k ${profile.pb_10k}`,
      profile?.pb_half && `półmaraton ${profile.pb_half}`,
      profile?.pb_marathon && `maraton ${profile.pb_marathon}`,
    ].filter(Boolean).join(', ') || 'brak'

    const system = `Jesteś PACE — osobistym AI trenerem biegowym użytkownika. Odpowiadasz po polsku, konkretnie i krótko (2-5 zdań, chyba że pytanie wymaga więcej). Jesteś merytoryczny (metodologia Danielsa, strefy tętna, zasada 80/20), wspierający, ale bez lania wody. Przy sygnałach bólu/kontuzji priorytetem jest bezpieczeństwo — doradź odpoczynek lub konsultację, nie forsowanie.

Dziś jest ${new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.

## Profil biegacza
- Cel: ${DISTANCE_LABELS[profile?.race_distance ?? ''] ?? 'brak'}${profile?.race_goal_time ? `, cel czasowy ${profile.race_goal_time}` : ''}${profile?.race_date ? `, zawody ${profile.race_date}` : ''}
- Rekordy: ${pbs}
- Kilometraż: ${profile?.weekly_km ?? '?'} km/tydz.
- Kontuzje: ${profile?.injury_history || 'brak'}
- Cel dodatkowy: ${profile?.additional_goal || 'brak'}

## Aktywny plan
${plan ? `${plan.plan_name} (${plan.total_weeks} tyg.)` : 'BRAK — użytkownik nie ma planu; możesz zasugerować wygenerowanie w zakładce Plan.'}

## Treningi z planu
${workoutLines || 'brak'}

## Ostatnie biegi (Strava/GPS)
${activityLines || 'brak'}

Jeśli użytkownik prosi o zmianę planu, wyjaśnij co zmienić i wspomnij, że tempa może skorygować automatycznie baner adaptacji na Dziś albo przebudowa planu w zakładce Plan (zachowuje ukończone treningi). Nie wymyślaj danych, których nie ma w kontekście.`

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
    const resp = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 600,
      system,
      messages,
    })

    const reply = resp.content[0]?.type === 'text' ? resp.content[0].text : ''
    return NextResponse.json({ reply })
  } catch (err) {
    console.error('[coach] error:', err)
    return NextResponse.json({ error: 'Trener chwilowo niedostępny' }, { status: 500 })
  }
}
