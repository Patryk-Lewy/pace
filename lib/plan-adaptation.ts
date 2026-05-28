import { SupabaseClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import type { Database } from '@/types/database'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AdaptationResult {
  action: 'adjust_pace' | 'regenerate_week' | 'none'
  suggestion: string
  /** Seconds to add to every remaining workout's pace (negative = faster) */
  pace_adjustment_seconds?: number
  dismissed?: boolean
  applied?: boolean
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function paceToSeconds(pace: string): number | null {
  const m = pace.match(/^(\d+):(\d{2})$/)
  if (!m) return null
  return parseInt(m[1]) * 60 + parseInt(m[2])
}

function secondsToPace(secs: number): string {
  const s = Math.round(Math.max(60, secs))
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

// ─── Core analysis ──────────────────────────────────────────────────────────

/**
 * Fetches last 5 activities with matched workouts, calculates pace deviation,
 * and – if a significant pattern is found – asks Claude Haiku for a suggestion
 * which is then stored in ai_comments (comment_type = 'plan_adaptation').
 *
 * No-ops if:
 *  - fewer than 3 activities have target paces to compare
 *  - deviation < 15 s/km or mixed direction (inconsistent)
 *  - there's already an unactioned adaptation suggestion
 */
export async function analyzeAndAdapt(
  supabase: SupabaseClient<Database>,
  userId: string,
  planId: string
): Promise<void> {
  // 1. Last 5 completed activities that were matched to a workout
  const { data: activities } = await supabase
    .from('activities')
    .select('id, avg_pace_s_per_km, name, matched_workout_id')
    .eq('user_id', userId)
    .not('matched_workout_id', 'is', null)
    .order('start_date', { ascending: false })
    .limit(5)

  if (!activities || activities.length < 3) return

  // 2. Fetch the matched workouts in one shot
  const workoutIds = activities
    .map(a => a.matched_workout_id)
    .filter(Boolean) as string[]

  const { data: workouts } = await supabase
    .from('workouts')
    .select('id, title, target_pace, workout_type, rpe, user_notes')
    .in('id', workoutIds)

  const workoutMap = new Map((workouts ?? []).map(w => [w.id, w]))

  // 3. Calculate per-activity pace deviation (actual − target, seconds/km)
  type DeviationEntry = {
    deviation: number
    title: string
    targetPace: string
    actualPace: string
    rpe: number | null
    notes: string | null
  }
  const deviations: DeviationEntry[] = []

  for (const act of activities) {
    if (!act.matched_workout_id || !act.avg_pace_s_per_km) continue
    const workout = workoutMap.get(act.matched_workout_id)
    if (!workout?.target_pace) continue
    const targetSecs = paceToSeconds(workout.target_pace)
    if (!targetSecs) continue
    const deviation = Math.round(act.avg_pace_s_per_km) - targetSecs
    deviations.push({
      deviation,
      title: workout.title,
      targetPace: workout.target_pace,
      actualPace: secondsToPace(act.avg_pace_s_per_km),
      rpe: workout.rpe ?? null,
      notes: workout.user_notes ?? null,
    })
  }

  if (deviations.length < 3) return

  const avgDev = deviations.reduce((s, d) => s + d.deviation, 0) / deviations.length
  const allFaster = deviations.every(d => d.deviation < 0)
  const allSlower = deviations.every(d => d.deviation > 0)

  // Only trigger if consistent direction AND meaningful magnitude
  if ((!allFaster && !allSlower) || Math.abs(avgDev) < 15) return

  // 4. Skip if there's already an unactioned suggestion
  const { data: existing } = await supabase
    .from('ai_comments')
    .select('content')
    .eq('user_id', userId)
    .eq('comment_type', 'plan_adaptation')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) {
    try {
      const prev = JSON.parse(existing.content) as AdaptationResult
      if (!prev.dismissed && !prev.applied) return
    } catch { /* fall through */ }
  }

  // 5. Remaining planned workouts (context for Claude)
  const { data: remaining } = await supabase
    .from('workouts')
    .select('title, distance_km, target_pace')
    .eq('plan_id', planId)
    .eq('status', 'planned')
    .neq('workout_type', 'rest')

  const { data: profile } = await supabase
    .from('runner_profiles')
    .select('race_goal, race_distance, best_5k_pace')
    .eq('id', userId)
    .single()

  // 6. Build Claude prompt
  const deviationsStr = deviations.map(d => {
    const dir = d.deviation < 0
      ? `${Math.abs(d.deviation)}s szybciej niż plan`
      : `${d.deviation}s wolniej niż plan`
    const extras: string[] = []
    if (d.rpe !== null) extras.push(`RPE ${d.rpe}/10`)
    if (d.notes) extras.push(`notatka biegacza: "${d.notes.slice(0, 200)}"`)
    const extrasStr = extras.length ? ` [${extras.join(', ')}]` : ''
    return `  • ${d.title}: plan ${d.targetPace}/km, wykonane ${d.actualPace}/km (${dir})${extrasStr}`
  }).join('\n')

  // Collect any high-RPE or injury-related signal
  const hasHighRpe = deviations.some(d => d.rpe !== null && d.rpe >= 8)
  const hasInjurySignal = deviations.some(d => {
    if (!d.notes) return false
    const lower = d.notes.toLowerCase()
    return /bol|ból|kontuz|uraz|kolan|ścięgn|sciegn|sciagn|ściągn|ścięgn|stawy|miesien|mięśni|grypa|przeziebien|przeziębien/.test(lower)
  })

  const remainingStr = (remaining ?? [])
    .map(w => `  • ${w.title}: ${w.distance_km ?? '?'} km @ ${w.target_pace ?? 'brak tempa'}/km`)
    .join('\n') || '  (brak zaplanowanych treningów)'

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const resp = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `Jesteś AI trenerem biegowym PACE. Oceń ostatnie treningi i zdecyduj czy plan wymaga korekty tempa lub zmniejszenia obciążenia.

Profil biegacza: ${profile?.race_distance ?? '—'} (${profile?.race_goal ?? '—'}), najlepsze 5 km: ${profile?.best_5k_pace ?? '—'}/km

Ostatnie treningi (${allFaster ? 'konsekwentnie szybciej' : 'konsekwentnie wolniej'} niż plan, śr. odchyłka ${Math.round(Math.abs(avgDev))}s/km):
${deviationsStr}

${hasInjurySignal ? '⚠️ UWAGA: w notatkach biegacza są sygnały o bólu/kontuzji — priorytetem jest bezpieczeństwo, nie tempo. Zasugeruj lżejszy plan zamiast przyspieszenia.\n' : ''}${hasHighRpe ? '⚠️ UWAGA: biegacz ocenia treningi jako bardzo ciężkie (RPE ≥ 8) — nawet jeśli tempo jest zgodne, plan może być zbyt agresywny.\n' : ''}
Pozostałe zaplanowane treningi:
${remainingStr}

Odpowiedz TYLKO w formacie JSON (bez markdown, bez komentarzy):
{"action":"adjust_pace","suggestion":"...po polsku 1-2 zdania...","pace_adjustment_seconds":-10}
Lub: {"action":"none","suggestion":""}

Wartość pace_adjustment_seconds:
- ujemna (-5 do -20) = szybszy plan (gdy biegacz robi z zapasem)
- dodatnia (+5 do +30) = wolniejszy plan (gdy biegacz nie nadąża, ma wysokie RPE lub sygnał kontuzji)
- 0 lub action "none" = bez zmian

W "suggestion" napisz konkretnie dlaczego proponujesz korektę, używając języka biegacza — odwołaj się do RPE lub notatek jeśli były.`,
    }],
  })

  const text = resp.content[0].type === 'text' ? resp.content[0].text.trim() : ''

  let result: AdaptationResult
  try {
    // Strip possible markdown fences
    const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    result = JSON.parse(clean) as AdaptationResult
  } catch {
    console.error('[ADAPTATION] Failed to parse Claude response:', text)
    return
  }

  if (result.action === 'none') return

  await supabase.from('ai_comments').insert({
    user_id: userId,
    plan_id: planId,
    comment_type: 'plan_adaptation',
    content: JSON.stringify(result),
  })
}

// ─── Apply / Dismiss ────────────────────────────────────────────────────────

export async function applyAdaptation(
  supabase: SupabaseClient<Database>,
  userId: string,
  commentId: string
): Promise<{ ok: boolean; message?: string }> {
  const { data: comment } = await supabase
    .from('ai_comments')
    .select('content, plan_id')
    .eq('id', commentId)
    .eq('user_id', userId)
    .single()

  if (!comment) return { ok: false, message: 'Not found' }

  let result: AdaptationResult
  try {
    result = JSON.parse(comment.content) as AdaptationResult
  } catch {
    return { ok: false, message: 'Invalid content' }
  }

  if (result.action === 'adjust_pace' && result.pace_adjustment_seconds !== undefined) {
    const adj = result.pace_adjustment_seconds

    const { data: plannedWorkouts } = await supabase
      .from('workouts')
      .select('id, target_pace')
      .eq('plan_id', comment.plan_id ?? '')
      .eq('status', 'planned')
      .neq('workout_type', 'rest')

    for (const w of (plannedWorkouts ?? [])) {
      if (!w.target_pace) continue
      const current = paceToSeconds(w.target_pace)
      if (!current) continue
      await supabase
        .from('workouts')
        .update({ target_pace: secondsToPace(current + adj) })
        .eq('id', w.id)
    }
  }

  result.applied = true
  await supabase
    .from('ai_comments')
    .update({ content: JSON.stringify(result) })
    .eq('id', commentId)

  return { ok: true }
}

export async function dismissAdaptation(
  supabase: SupabaseClient<Database>,
  userId: string,
  commentId: string
): Promise<{ ok: boolean }> {
  const { data: comment } = await supabase
    .from('ai_comments')
    .select('content')
    .eq('id', commentId)
    .eq('user_id', userId)
    .single()

  if (!comment) return { ok: false }

  let result: AdaptationResult
  try {
    result = JSON.parse(comment.content) as AdaptationResult
  } catch {
    return { ok: false }
  }

  result.dismissed = true
  await supabase
    .from('ai_comments')
    .update({ content: JSON.stringify(result) })
    .eq('id', commentId)

  return { ok: true }
}
