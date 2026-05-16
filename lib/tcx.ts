// TCX (Training Center XML) generator for Garmin Connect import
// Garmin Connect accepts TCX the same way as FIT for structured workouts

import type { Workout } from '@/types/database'

type WorkoutStep =
  | { type: 'warmup' | 'cooldown'; duration_minutes: number }
  | { type: 'run'; distance_km: number; target_pace: string | null; duration_minutes: number | null }
  | { type: 'rest'; duration_minutes: number }

function parseTargetPaceToMps(pace: string | null): { low: number; high: number } | null {
  // pace format: "5:30" min/km → m/s
  if (!pace) return null
  const [min, sec] = pace.split(':').map(Number)
  if (isNaN(min)) return null
  const secPerKm = min * 60 + (sec || 0)
  const mps = 1000 / secPerKm
  // ±10% tolerance
  return { low: mps * 0.9, high: mps * 1.1 }
}

function buildSteps(workout: Workout): WorkoutStep[] {
  const steps: WorkoutStep[] = []

  if (workout.workout_type === 'rest') {
    steps.push({ type: 'rest', duration_minutes: 30 })
    return steps
  }

  // Warmup
  steps.push({ type: 'warmup', duration_minutes: 10 })

  if (workout.workout_type === 'intervals') {
    // 8 x 400m intervals with recovery
    for (let i = 0; i < 8; i++) {
      steps.push({ type: 'run', distance_km: 0.4, target_pace: workout.target_pace, duration_minutes: null })
      steps.push({ type: 'rest', duration_minutes: 2 })
    }
  } else {
    steps.push({
      type: 'run',
      distance_km: workout.distance_km ?? 5,
      target_pace: workout.target_pace,
      duration_minutes: workout.duration_minutes,
    })
  }

  // Cooldown
  steps.push({ type: 'cooldown', duration_minutes: 5 })

  return steps
}

function stepToTcx(step: WorkoutStep, index: number): string {
  const name = `Krok ${index + 1}`

  if (step.type === 'rest') {
    return `
    <Step xsi:type="Step_t">
      <StepId>${index + 1}</StepId>
      <Name>${name}</Name>
      <Duration xsi:type="Time_t">
        <Seconds>${step.duration_minutes * 60}</Seconds>
      </Duration>
      <Intensity>Resting</Intensity>
    </Step>`
  }

  const intensity = step.type === 'warmup' ? 'Warmup'
    : step.type === 'cooldown' ? 'Cooldown'
    : 'Active'

  const duration = 'distance_km' in step && step.distance_km
    ? `<Duration xsi:type="Distance_t"><Meters>${Math.round(step.distance_km * 1000)}</Meters></Duration>`
    : `<Duration xsi:type="Time_t"><Seconds>${(step.duration_minutes ?? 30) * 60}</Seconds></Duration>`

  const pace = 'target_pace' in step ? parseTargetPaceToMps(step.target_pace) : null
  const target = pace
    ? `<Target xsi:type="Speed_t">
        <SpeedZone xsi:type="CustomSpeedZone_t">
          <LowInMetersPerSecond>${pace.low.toFixed(4)}</LowInMetersPerSecond>
          <HighInMetersPerSecond>${pace.high.toFixed(4)}</HighInMetersPerSecond>
        </SpeedZone>
      </Target>`
    : '<Target xsi:type="None_t"/>'

  return `
    <Step xsi:type="Step_t">
      <StepId>${index + 1}</StepId>
      <Name>${name}</Name>
      ${duration}
      <Intensity>${intensity}</Intensity>
      ${target}
    </Step>`
}

export function workoutToTcx(workout: Workout): string {
  const steps = buildSteps(workout)
  const stepsXml = steps.map((s, i) => stepToTcx(s, i)).join('\n')
  const now = new Date().toISOString()

  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase
  xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2
  http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">
  <Workouts>
    <Workout Sport="Running">
      <Name>${workout.title}</Name>
      <CreatedBy xsi:type="Application_t">
        <Name>PACE AI Running Coach</Name>
        <Build>
          <Version>
            <VersionMajor>1</VersionMajor>
            <VersionMinor>0</VersionMinor>
          </Version>
        </Build>
        <LangID>PL</LangID>
        <PartNumber>PACE-001</PartNumber>
      </CreatedBy>
      ${stepsXml}
      <ScheduledOn>${now.split('T')[0]}</ScheduledOn>
      <Notes>${workout.description ?? ''} | Faza: ${workout.phase ?? '—'} | Tydzień ${workout.week_number}</Notes>
    </Workout>
  </Workouts>
</TrainingCenterDatabase>`
}

export function planToTcx(workouts: Workout[], planName: string): string {
  const workoutsXml = workouts
    .filter(w => w.workout_type !== 'rest')
    .map(workout => {
      const steps = buildSteps(workout)
      const stepsXml = steps.map((s, i) => stepToTcx(s, i)).join('\n')
      return `
    <Workout Sport="Running">
      <Name>T${workout.week_number}: ${workout.title}</Name>
      ${stepsXml}
      <Notes>${workout.description ?? ''}</Notes>
    </Workout>`
    }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase
  xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2
  http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">
  <Workouts>
    ${workoutsXml}
  </Workouts>
</TrainingCenterDatabase>`
}
