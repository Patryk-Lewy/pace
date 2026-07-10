'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { metaFor, shortPace } from '@/lib/workout-meta'
import type { Workout, TrainingPlan } from '@/types/database'

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_OFFSET: Record<string, number> = {
  mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6,
}

const MONTH_PL = [
  'Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec',
  'Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień',
]

const WEEKDAY_SHORT = ['P', 'W', 'Ś', 'C', 'P', 'S', 'N']

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getMondayOf(date: Date): Date {
  const d = new Date(date)
  const dow = d.getDay()
  const delta = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + delta)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Local YYYY-MM-DD (avoids UTC off-by-one from toISOString). */
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function workoutDate(planStart: Date, weekNumber: number, dayOfWeek: string): Date {
  const d = new Date(planStart)
  d.setDate(d.getDate() + (weekNumber - 1) * 7 + (DAY_OFFSET[dayOfWeek] ?? 0))
  return d
}

function buildDateMap(workouts: Workout[], planStart: Date): Map<string, Workout> {
  const map = new Map<string, Workout>()
  for (const w of workouts) {
    map.set(dateKey(workoutDate(planStart, w.week_number, w.day_of_week)), w)
  }
  return map
}

/** All day cells for a month, padded to full Mon→Sun rows. */
function monthCells(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const start = getMondayOf(firstDay)
  const end = new Date(lastDay)
  const dowEnd = end.getDay()
  if (dowEnd !== 0) end.setDate(end.getDate() + (7 - dowEnd))
  const cells: Date[] = []
  const cur = new Date(start)
  while (cur <= end) {
    cells.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return cells
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CalendarPage() {
  const router = useRouter()
  const [plan, setPlan] = useState<TrainingPlan | null>(null)
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)

  const today = new Date()
  const [monthYear, setMonthYear] = useState({ year: today.getFullYear(), month: today.getMonth() })
  const [selectedKey, setSelectedKey] = useState(dateKey(today))

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const supabase = createClient()
    const { data: activePlan } = await supabase
      .from('training_plans').select('*').eq('status', 'active')
      .order('created_at', { ascending: false }).maybeSingle()

    if (!activePlan) { setLoading(false); return }
    setPlan(activePlan)

    const { data: ws } = await supabase
      .from('workouts').select('*').eq('plan_id', activePlan.id).order('week_number')
    setWorkouts(ws ?? [])
    setLoading(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center" style={{ height: 240 }}>
      <p className="text-sm" style={{ color: 'var(--text-3)' }}>Ładowanie kalendarza...</p>
    </div>
  )

  if (!plan) return (
    <div className="animate-fade-up" style={{ paddingTop: 40 }}>
      <div className="text-center" style={{ borderRadius: 26, padding: 32, background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>📅</div>
        <div className="cond" style={{ fontSize: 24, marginBottom: 8 }}>Brak planu</div>
        <p style={{ font: '500 13px var(--font-barlow)', color: 'var(--text-2)', marginBottom: 20 }}>Najpierw wygeneruj plan treningowy.</p>
        <button onClick={() => router.push('/plan')} className="press" style={{
          background: 'var(--green)', color: '#000', borderRadius: 16, padding: '14px 28px',
          font: '800 14px var(--font-barlow-condensed)', letterSpacing: 1.5, textTransform: 'uppercase', border: 'none',
        }}>Idź do planu →</button>
      </div>
    </div>
  )

  const planStart = getMondayOf(new Date(plan.created_at))
  const dateMap = buildDateMap(workouts, planStart)
  const todayKey = dateKey(today)
  const cells = monthCells(monthYear.year, monthYear.month)

  const selectedDate = new Date(`${selectedKey}T00:00:00`)
  const selectedWorkout = dateMap.get(selectedKey) ?? null

  function shiftMonth(delta: number) {
    const m = monthYear.month + delta
    if (m < 0) setMonthYear({ year: monthYear.year - 1, month: 11 })
    else if (m > 11) setMonthYear({ year: monthYear.year + 1, month: 0 })
    else setMonthYear({ year: monthYear.year, month: m })
  }

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between" style={{ padding: '20px 0 16px' }}>
        <div className="cond" style={{ fontSize: 30 }}>{MONTH_PL[monthYear.month]} {monthYear.year}</div>
        <div className="flex" style={{ gap: 8 }}>
          <button onClick={() => shiftMonth(-1)} className="press flex items-center justify-center"
            style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--surface2)', color: 'var(--text-2)', border: 'none' }}>‹</button>
          <button onClick={() => shiftMonth(1)} className="press flex items-center justify-center"
            style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--surface2)', color: 'var(--text-2)', border: 'none' }}>›</button>
        </div>
      </div>

      {/* Weekday header */}
      <div className="flex" style={{ marginBottom: 8 }}>
        {WEEKDAY_SHORT.map((d, i) => (
          <span key={i} style={{ width: '14.28%', textAlign: 'center', font: '700 10px var(--font-barlow)', color: 'var(--text-3)' }}>{d}</span>
        ))}
      </div>

      {/* Month grid */}
      <div className="flex flex-wrap">
        {cells.map(cell => {
          const key = dateKey(cell)
          const workout = dateMap.get(key) ?? null
          const inMonth = cell.getMonth() === monthYear.month
          const isToday = key === todayKey
          const isSelected = key === selectedKey
          const dotColor = workout && workout.workout_type !== 'rest' ? metaFor(workout.workout_type).color : null

          return (
            <button key={key} onClick={() => setSelectedKey(key)} className="press"
              style={{ width: '14.28%', padding: '6px 0', background: 'none', border: 'none', textAlign: 'center' }}>
              <div style={{
                width: 30, height: 30, margin: '0 auto', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isToday ? 'var(--green)' : isSelected ? 'var(--surface2)' : 'transparent',
                font: '600 13px var(--font-barlow)',
                color: isToday ? '#000' : inMonth ? 'rgba(255,255,255,.85)' : 'var(--text-3)',
              }}>
                {cell.getDate()}
              </div>
              <div style={{
                width: 5, height: 5, borderRadius: '50%', margin: '3px auto 0',
                background: dotColor ?? 'transparent',
              }} />
            </button>
          )
        })}
      </div>

      <div style={{ height: 1, background: 'var(--border)', margin: '14px 0' }} />

      {/* Agenda for selected day */}
      <div className="kick" style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 10 }}>
        {capitalize(selectedDate.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' }))}
      </div>

      {selectedWorkout ? (
        <AgendaRow workout={selectedWorkout} onClick={() => router.push(`/calendar/${selectedWorkout.id}`)} />
      ) : (
        <div className="flex items-center" style={{ gap: 12, padding: 14, borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)', opacity: 0.55 }}>
          <div className="flex items-center justify-center" style={{ width: 44, height: 44, borderRadius: 13, background: 'var(--surface2)', fontSize: 18 }}>🗓️</div>
          <div style={{ flex: 1 }}>
            <div style={{ font: '700 15px var(--font-barlow)' }}>Brak treningu</div>
            <div style={{ font: '500 12px var(--font-barlow)', color: 'var(--text-3)' }}>Dzień poza planem lub odpoczynek</div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Agenda row ───────────────────────────────────────────────────────────────

function AgendaRow({ workout, onClick }: { workout: Workout; onClick: () => void }) {
  const meta = metaFor(workout.workout_type)
  const isRest = workout.workout_type === 'rest'
  const isCompleted = workout.status === 'completed'
  const pace = shortPace(workout.target_pace)

  const meta2 = isRest
    ? 'Regeneracja · rozciąganie'
    : [pace && `${pace} /km`, meta.zone !== '—' && meta.zone, workout.duration_minutes && `~${workout.duration_minutes} min`]
        .filter(Boolean).join(' · ')

  const content = (
    <div className="flex items-center" style={{
      gap: 12, padding: 14, borderRadius: 16, width: '100%',
      background: 'var(--surface)',
      border: `1px solid ${isCompleted ? 'var(--green)' : isRest ? 'var(--border)' : 'rgba(0,230,118,.3)'}`,
      opacity: isRest ? 0.55 : 1,
    }}>
      <div className="flex items-center justify-center" style={{ width: 44, height: 44, borderRadius: 13, background: meta.bg, fontSize: 20 }}>{meta.emoji}</div>
      <div style={{ flex: 1, textAlign: 'left' }}>
        <div style={{ font: '700 15px var(--font-barlow)' }}>{isCompleted ? '✓ ' : ''}{workout.title}</div>
        <div style={{ font: '500 12px var(--font-barlow)', color: 'var(--text-3)' }}>{meta2}</div>
      </div>
      {!isRest && <span style={{ color: 'var(--green)', fontSize: 18 }}>›</span>}
    </div>
  )

  if (isRest) return content
  return <button onClick={onClick} className="press" style={{ width: '100%', background: 'none', border: 'none', padding: 0 }}>{content}</button>
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
