import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeWorkoutDate } from '@/lib/workout-matching'
import type { Workout, TrainingPlan } from '@/types/database'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://connect.garmin.com',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization',
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS_HEADERS })
}

// ─── Garmin JSON helpers ───────────────────────────────────────────────────────

const RUNNING_SPORT = { sportTypeId: 1, sportTypeKey: 'running', displayOrder: 1 }

const STEP_TYPES: Record<string, { stepTypeId: number; stepTypeKey: string; displayOrder: number }> = {
  warmup:   { stepTypeId: 1, stepTypeKey: 'warmup',   displayOrder: 1 },
  cooldown: { stepTypeId: 2, stepTypeKey: 'cooldown', displayOrder: 2 },
  interval: { stepTypeId: 3, stepTypeKey: 'interval', displayOrder: 3 },
}

const END_TIME     = (secs: number)   => ({ conditionTypeId: 2, conditionTypeKey: 'time',     displayOrder: 2, displayable: true, value: secs })
const END_DISTANCE = (meters: number) => ({ conditionTypeId: 1, conditionTypeKey: 'distance', displayOrder: 1, displayable: true, value: meters })

const NO_TARGET = {
  targetType: { workoutTargetTypeId: 1, workoutTargetTypeKey: 'no.target', displayOrder: 1 },
  targetValueOne: null, targetValueTwo: null,
}

function paceTarget(paceStr: string, zoneHalfWidthSec = 20) {
  // "5:30" → seconds per km → m/s
  const [m, s] = paceStr.split(':').map(Number)
  const secsPerKm = m * 60 + s
  const centerMs = 1000 / secsPerKm
  // wider = slower speed = lower m/s value
  const slowMs = 1000 / (secsPerKm + zoneHalfWidthSec)
  const fastMs = 1000 / (secsPerKm - zoneHalfWidthSec)
  return {
    targetType: { workoutTargetTypeId: 6, workoutTargetTypeKey: 'pace.zone', displayOrder: 6 },
    targetValueOne: slowMs,
    targetValueTwo: fastMs,
  }
}

type TargetInfo = { targetType: { workoutTargetTypeId: number; workoutTargetTypeKey: string; displayOrder: number }; targetValueOne: number | null; targetValueTwo: number | null }

function makeStep(order: number, type: 'warmup' | 'cooldown' | 'interval', endCond: ReturnType<typeof END_TIME>, targetInfo: TargetInfo) {
  return {
    type: 'ExecutableStepDTO',
    stepOrder: order,
    stepType: STEP_TYPES[type],
    childStepId: null,
    description: null,
    endCondition: {
      conditionTypeId: endCond.conditionTypeId,
      conditionTypeKey: endCond.conditionTypeKey,
      displayOrder: endCond.displayOrder,
      displayable: endCond.displayable,
    },
    endConditionValue: endCond.value,
    preferredEndConditionUnit: null,
    endConditionCompare: null,
    targetType: targetInfo.targetType,
    targetValueOne: targetInfo.targetValueOne,
    targetValueTwo: targetInfo.targetValueTwo,
    targetValueUnit: null,
    zoneNumber: null,
    secondaryTargetType: null,
    secondaryTargetValueOne: null,
    secondaryTargetValueTwo: null,
    secondaryTargetValueUnit: null,
    secondaryZoneNumber: null,
    endConditionZone: null,
    strokeType: { strokeTypeId: 0, strokeTypeKey: null, displayOrder: 0 },
    equipmentType: { equipmentTypeId: 0, equipmentTypeKey: null, displayOrder: 0 },
    category: null, exerciseName: null, workoutProvider: null,
    providerExerciseSourceId: null, weightValue: null, weightUnit: null,
  }
}

function workoutToGarminJson(w: Workout) {
  const target = w.target_pace ? paceTarget(w.target_pace) : NO_TARGET
  const steps = []

  if (w.workout_type === 'tempo' || w.workout_type === 'intervals') {
    // warmup 10 min
    steps.push(makeStep(1, 'warmup', END_TIME(10 * 60), NO_TARGET))
    // main block
    const mainMins = w.duration_minutes ? Math.max(5, w.duration_minutes - 20) : 20
    const mainEnd = w.distance_km
      ? END_DISTANCE(Math.round(w.distance_km * 1000 * 0.7))
      : END_TIME(mainMins * 60)
    steps.push(makeStep(2, 'interval', mainEnd, target))
    // cooldown 10 min
    steps.push(makeStep(3, 'cooldown', END_TIME(10 * 60), NO_TARGET))
  } else {
    // easy_run / long_run – single step
    const endCond = w.duration_minutes
      ? END_TIME(w.duration_minutes * 60)
      : END_DISTANCE(Math.round((w.distance_km ?? 5) * 1000))
    const easyTarget = w.target_pace ? paceTarget(w.target_pace, 30) : NO_TARGET
    steps.push(makeStep(1, 'interval', endCond, easyTarget))
  }

  return {
    workoutName: w.title,
    description: w.workout_type,
    sportType: RUNNING_SPORT,
    workoutProvider: 'PACE',
    workoutSourceId: w.id,
    estimatedDurationInSecs: w.duration_minutes ? w.duration_minutes * 60 : null,
    estimatedDistanceInMeters: w.distance_km ? Math.round(w.distance_km * 1000) : null,
    workoutSegments: [{
      segmentOrder: 1,
      sportType: RUNNING_SPORT,
      workoutSteps: steps,
    }],
  }
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function computeDate(plan: TrainingPlan, w: Workout): string | null {
  if (w.scheduled_date) return w.scheduled_date
  // Same anchor as the rest of the app (plan created_at → start Monday),
  // instead of the old back-calculation from race_date.
  const d = computeWorkoutDate(plan.created_at, w.week_number, w.day_of_week)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  // Accept both cookie auth (modal) and Bearer token auth (bookmarklet on garmin.com)
  let user
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const { data } = await supabase.auth.getUser(authHeader.slice(7))
    user = data.user
  } else {
    const { data: { user: u } } = await supabase.auth.getUser()
    user = u
  }

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get active plan
  const { data: plan } = await supabase
    .from('training_plans')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .maybeSingle()

  if (!plan) return NextResponse.json({ error: 'No active plan' }, { status: 404 })

  // Get all non-rest workouts
  const { data: workouts } = await supabase
    .from('workouts')
    .select('*')
    .eq('plan_id', plan.id)
    .neq('workout_type', 'rest')
    .order('week_number')
    .order('day_of_week')

  if (!workouts?.length) return NextResponse.json({ error: 'No workouts' }, { status: 404 })

  // Build workout entries with dates and Garmin JSON
  const entries = (workouts ?? []).map(w => ({
    date: computeDate(plan, w),
    garminJson: workoutToGarminJson(w),
    title: w.title,
    week: w.week_number,
  })).filter(e => e.date !== null)

  // Generate the sync script
  const script = generateSyncScript(entries as Array<{ date: string; garminJson: object; title: string; week: number }>)

  return new NextResponse(script, {
    headers: {
      'Content-Type': 'text/javascript; charset=utf-8',
      ...CORS_HEADERS,
    },
  })
}

function generateSyncScript(entries: Array<{ date: string; garminJson: object; title: string; week: number }>) {
  const data = JSON.stringify(entries)
  return `
// ╔══════════════════════════════════════════════════════════════════╗
// ║           PACE → Garmin Connect Sync Script                     ║
// ║  Run this in the browser console on connect.garmin.com          ║
// ╚══════════════════════════════════════════════════════════════════╝

(async function() {
  const csrf = document.querySelector('meta[name="csrf-token"]')?.content;
  if (!csrf) { alert('BŁĄD: Otwórz tę stronę na connect.garmin.com'); return; }

  const workouts = ${data};
  const BASE = '/gc-api/workout-service';
  const HDRS = { 'NK': 'NT', 'Accept': 'application/json', 'Content-Type': 'application/json', 'Connect-Csrf-Token': csrf };

  let created = 0, failed = 0;
  console.log('[PACE] 🏃 Rozpoczynam synchronizację ' + workouts.length + ' treningów...');

  for (const entry of workouts) {
    try {
      // 1. Create workout
      const cr = await fetch(BASE + '/workout', { method: 'POST', credentials: 'include', headers: HDRS, body: JSON.stringify(entry.garminJson) });
      const cData = await cr.json();
      const wId = cData.workoutId;
      if (!wId) throw new Error('Brak workoutId: ' + JSON.stringify(cData).substring(0, 100));

      // 2. Schedule to date
      const sr = await fetch(BASE + '/schedule/' + wId, { method: 'POST', credentials: 'include', headers: HDRS, body: JSON.stringify({ date: entry.date }) });
      if (!sr.ok) throw new Error('Schedule failed: ' + sr.status);

      console.log('[PACE] ✅ Tyg.' + entry.week + ': ' + entry.title + ' → ' + entry.date);
      created++;
    } catch(e) {
      console.error('[PACE] ❌ Tyg.' + entry.week + ': ' + entry.title + ' – ' + e.message);
      failed++;
    }
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 300));
  }

  const msg = '✅ PACE Sync gotowy!\\n' + created + ' treningów dodanych do Garmin Connect.';
  if (failed) alert(msg + '\\n⚠️ ' + failed + ' błędów – sprawdź konsolę.');
  else alert(msg + '\\nOdśwież stronę żeby zobaczyć treningi w kalendarzu.');
})();
`.trim()
}
