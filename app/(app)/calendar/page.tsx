'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Workout, TrainingPlan } from '@/types/database'

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_LABELS: Record<string, string> = {
  mon: 'Pon', tue: 'Wt', wed: 'Śr', thu: 'Czw', fri: 'Pt', sat: 'Sob', sun: 'Ndz',
}
const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

// Monday = 0 offset in plan weeks
const DAY_OFFSET: Record<string, number> = {
  mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6,
}

const TYPE_COLOR: Record<string, { bg: string; text: string; label: string }> = {
  easy_run:  { bg: 'var(--blue-dim)',   text: 'var(--blue)',   label: 'Easy' },
  long_run:  { bg: 'var(--blue-dim)',   text: 'var(--blue)',   label: 'Long' },
  tempo:     { bg: 'var(--orange-dim)', text: 'var(--orange)', label: 'Tempo' },
  intervals: { bg: 'var(--orange-dim)', text: 'var(--orange)', label: 'Interway' },
  rest:      { bg: 'var(--surface3)',   text: 'var(--text-3)', label: 'Rest' },
}

const MONTH_PL = [
  'Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec',
  'Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień',
]

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** Monday of the week that contains a given date */
function getMondayOf(date: Date): Date {
  const d = new Date(date)
  const dow = d.getDay() // 0=Sun
  const delta = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + delta)
  d.setHours(0, 0, 0, 0)
  return d
}

/** YYYY-MM-DD string key */
function dateKey(d: Date): string {
  return d.toISOString().split('T')[0]
}

/** Calculate the actual date of a workout given plan start (Monday of week 1) */
function workoutDate(planStart: Date, weekNumber: number, dayOfWeek: string): Date {
  const d = new Date(planStart)
  d.setDate(d.getDate() + (weekNumber - 1) * 7 + (DAY_OFFSET[dayOfWeek] ?? 0))
  return d
}

/** Build map dateKey → Workout for all workouts in plan */
function buildDateMap(workouts: Workout[], planStart: Date): Map<string, Workout> {
  const map = new Map<string, Workout>()
  for (const w of workouts) {
    const d = workoutDate(planStart, w.week_number, w.day_of_week)
    map.set(dateKey(d), w)
  }
  return map
}

/** All day cells to display for a given month (fills Mon→Sun rows) */
function monthCells(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1)
  const lastDay  = new Date(year, month + 1, 0)
  const start    = getMondayOf(firstDay)
  // end = Sunday >= lastDay
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

type ViewMode = 'week' | 'month'

export default function CalendarPage() {
  const router = useRouter()
  const [plan, setPlan]         = useState<TrainingPlan | null>(null)
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loading, setLoading]   = useState(true)
  const [view, setView]         = useState<ViewMode>('week')

  // Week view state
  const [currentWeek, setCurrentWeek] = useState(1)

  // Month view state — current displayed month
  const today = new Date()
  const [monthYear, setMonthYear] = useState({ year: today.getFullYear(), month: today.getMonth() })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const supabase = createClient()
    const { data: activePlan } = await supabase
      .from('training_plans')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .maybeSingle()

    if (!activePlan) { setLoading(false); return }
    setPlan(activePlan)

    const { data: ws } = await supabase
      .from('workouts')
      .select('*')
      .eq('plan_id', activePlan.id)
      .order('week_number')

    setWorkouts(ws ?? [])
    setLoading(false)
  }

  async function toggleStatus(workout: Workout) {
    const newStatus = workout.status === 'completed' ? 'planned' : 'completed'
    const supabase = createClient()
    await supabase.from('workouts').update({
      status: newStatus,
      completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
    }).eq('id', workout.id)
    setWorkouts(prev => prev.map(w => w.id === workout.id ? { ...w, status: newStatus } : w))
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-sm" style={{ color: 'var(--text-3)' }}>Ładowanie kalendarza...</p>
    </div>
  )

  if (!plan) return (
    <div className="max-w-4xl animate-fade-up">
      <div className="rounded-2xl p-10 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="text-4xl mb-4">📅</div>
        <h2 className="text-2xl font-black mb-2" style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif' }}>Brak planu</h2>
        <p className="text-sm mb-6" style={{ color: 'var(--text-2)' }}>Najpierw wygeneruj plan treningowy.</p>
        <button onClick={() => router.push('/plan')}
          className="rounded-xl px-6 py-3 text-sm font-black uppercase tracking-widest"
          style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif', background: 'var(--green)', color: '#000' }}>
          Idź do planu
        </button>
      </div>
    </div>
  )

  const planStart = getMondayOf(new Date(plan.created_at))
  const dateMap   = buildDateMap(workouts, planStart)
  const todayKey  = dateKey(today)

  return (
    <div className="max-w-4xl animate-fade-up">

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-5xl font-black" style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif' }}>
            Kalendarz
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>{plan.plan_name}</p>
        </div>

        {/* View toggle */}
        <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          {(['week', 'month'] as ViewMode[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all"
              style={{
                background: view === v ? 'var(--green)' : 'var(--surface)',
                color:      view === v ? '#000' : 'var(--text-3)',
              }}>
              {v === 'week' ? 'Tygodnie' : 'Miesiąc'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Week view ── */}
      {view === 'week' && (
        <WeekView
          plan={plan}
          workouts={workouts}
          currentWeek={currentWeek}
          setCurrentWeek={setCurrentWeek}
          router={router}
          toggleStatus={toggleStatus}
          todayKey={todayKey}
          planStart={planStart}
          dateMap={dateMap}
        />
      )}

      {/* ── Month view ── */}
      {view === 'month' && (
        <MonthView
          monthYear={monthYear}
          setMonthYear={setMonthYear}
          dateMap={dateMap}
          todayKey={todayKey}
          router={router}
          toggleStatus={toggleStatus}
        />
      )}
    </div>
  )
}

// ─── Week view ────────────────────────────────────────────────────────────────

function WeekView({
  plan, workouts, currentWeek, setCurrentWeek, router, toggleStatus, todayKey, planStart, dateMap,
}: {
  plan: TrainingPlan
  workouts: Workout[]
  currentWeek: number
  setCurrentWeek: (fn: (w: number) => number) => void
  router: ReturnType<typeof useRouter>
  toggleStatus: (w: Workout) => void
  todayKey: string
  planStart: Date
  dateMap: Map<string, Workout>
}) {
  const totalWeeks   = plan.total_weeks
  const weekWorkouts = workouts.filter(w => w.week_number === currentWeek)
  const weekByDay    = DAY_ORDER.reduce((acc, day) => {
    acc[day] = weekWorkouts.find(w => w.day_of_week === day) ?? null
    return acc
  }, {} as Record<string, Workout | null>)

  const completedCount = weekWorkouts.filter(w => w.status === 'completed').length
  const totalRuns      = weekWorkouts.filter(w => w.workout_type !== 'rest').length
  const totalKm        = weekWorkouts.reduce((s, w) => s + (w.distance_km ?? 0), 0)
  const phase          = weekWorkouts[0]?.phase ?? '—'

  // Date range label for this week
  const weekStart = new Date(planStart)
  weekStart.setDate(weekStart.getDate() + (currentWeek - 1) * 7)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  const weekLabel = `${weekStart.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })} – ${weekEnd.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}`

  return (
    <>
      {/* Week selector */}
      <div className="flex items-center gap-3 mb-4 overflow-x-auto pb-2">
        <button onClick={() => setCurrentWeek(w => Math.max(1, w - 1))} disabled={currentWeek === 1}
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: currentWeek === 1 ? 'var(--text-3)' : 'var(--text)' }}>
          ‹
        </button>
        <div className="flex gap-2 flex-shrink-0">
          {Array.from({ length: totalWeeks }, (_, i) => i + 1).map(wk => (
            <button key={wk} onClick={() => setCurrentWeek(() => wk)}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all"
              style={{
                background: currentWeek === wk ? 'var(--green)' : 'var(--surface)',
                border: `1px solid ${currentWeek === wk ? 'var(--green)' : 'var(--border)'}`,
                color: currentWeek === wk ? '#000' : 'var(--text-2)',
              }}>
              {wk}
            </button>
          ))}
        </div>
        <button onClick={() => setCurrentWeek(w => Math.min(totalWeeks, w + 1))} disabled={currentWeek === totalWeeks}
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: currentWeek === totalWeeks ? 'var(--text-3)' : 'var(--text)' }}>
          ›
        </button>
      </div>

      {/* Week date label */}
      <p className="text-xs mb-4" style={{ color: 'var(--text-3)' }}>{weekLabel}</p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatMini label="Faza" value={phase} />
        <StatMini label="Km w tygodniu" value={`${totalKm.toFixed(0)} km`} accent />
        <StatMini label="Ukończone" value={`${completedCount}/${totalRuns}`} />
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {DAY_ORDER.map(day => {
          const w = weekByDay[day]
          const thisDayKey = dateKey(new Date(weekStart.getTime() + DAY_OFFSET[day] * 86400000))
          const isToday = thisDayKey === todayKey

          if (!w) return (
            <div key={day} className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: `1px solid ${isToday ? 'var(--green)' : 'var(--border)'}`, opacity: 0.4 }}>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>{DAY_LABELS[day]}</p>
            </div>
          )

          const style = TYPE_COLOR[w.workout_type] ?? TYPE_COLOR.rest
          const isCompleted = w.status === 'completed'

          return (
            <div key={day}
              className="rounded-2xl p-4 cursor-pointer transition-all hover:scale-[1.02]"
              style={{ background: 'var(--surface)', border: `1px solid ${isCompleted ? 'var(--green)' : isToday ? 'var(--green)' : 'var(--border)'}`, position: 'relative', overflow: 'hidden' }}
              onClick={() => router.push(`/calendar/${w.id}`)}>

              {w.workout_type !== 'rest' && (
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: style.text }} />
              )}

              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: isToday ? 'var(--green)' : 'var(--text-3)' }}>
                  {DAY_LABELS[day]}{isToday ? ' · Dziś' : ''}
                </span>
                <button
                  onClick={e => { e.stopPropagation(); toggleStatus(w) }}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs transition-all"
                  style={{ background: isCompleted ? 'var(--green)' : 'var(--surface2)', color: isCompleted ? '#000' : 'var(--text-3)' }}>
                  {isCompleted ? '✓' : '○'}
                </button>
              </div>

              <p className="text-sm font-bold mb-1 leading-tight" style={{ color: isCompleted ? 'var(--text-2)' : 'var(--text)' }}>
                {w.title}
              </p>

              <div className="flex flex-wrap gap-1.5 mt-2">
                {w.distance_km && <span className="text-xs font-bold" style={{ color: style.text }}>{w.distance_km} km</span>}
                {w.target_pace && <span className="text-xs" style={{ color: 'var(--text-3)' }}>@ {w.target_pace}/km</span>}
                {w.duration_minutes && <span className="text-xs" style={{ color: 'var(--text-3)' }}>~{w.duration_minutes} min</span>}
              </div>

              <div className="mt-2">
                <span className="text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                  style={{ background: style.bg, color: style.text }}>
                  {style.label}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

// ─── Month view ───────────────────────────────────────────────────────────────

function MonthView({
  monthYear, setMonthYear, dateMap, todayKey, router, toggleStatus,
}: {
  monthYear: { year: number; month: number }
  setMonthYear: (v: { year: number; month: number }) => void
  dateMap: Map<string, Workout>
  todayKey: string
  router: ReturnType<typeof useRouter>
  toggleStatus: (w: Workout) => void
}) {
  const { year, month } = monthYear

  function prevMonth() {
    setMonthYear(month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 })
  }
  function nextMonth() {
    setMonthYear(month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 })
  }

  const cells = monthCells(year, month)
  const thisMonth = month

  // Month stats
  const monthWorkouts = cells
    .map(d => dateMap.get(dateKey(d)))
    .filter((w): w is Workout => !!w && w.workout_type !== 'rest')
  const completedInMonth = monthWorkouts.filter(w => w.status === 'completed').length
  const totalKmMonth = monthWorkouts.reduce((s, w) => s + (w.distance_km ?? 0), 0)

  return (
    <>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}>
          ‹
        </button>
        <h2 className="text-2xl font-black" style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif' }}>
          {MONTH_PL[month]} {year}
        </h2>
        <button onClick={nextMonth}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}>
          ›
        </button>
      </div>

      {/* Month stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatMini label="Km w miesiącu" value={`${totalKmMonth.toFixed(0)} km`} accent />
        <StatMini label="Ukończone treningi" value={`${completedInMonth}/${monthWorkouts.length}`} />
      </div>

      {/* Calendar grid */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b" style={{ borderColor: 'var(--border)' }}>
          {['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Ndz'].map(d => (
            <div key={d} className="py-2 text-center text-xs font-semibold uppercase tracking-widest"
              style={{ color: 'var(--text-3)' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Day cells — rows of 7 */}
        <div className="grid grid-cols-7">
          {cells.map((cellDate, idx) => {
            const key       = dateKey(cellDate)
            const workout   = dateMap.get(key) ?? null
            const isToday   = key === todayKey
            const inMonth   = cellDate.getMonth() === thisMonth
            const isLast    = idx === cells.length - 1
            const isLastRow = idx >= cells.length - 7
            const colIdx    = idx % 7
            const isLastCol = colIdx === 6
            const style     = workout ? (TYPE_COLOR[workout.workout_type] ?? TYPE_COLOR.rest) : null
            const isCompleted = workout?.status === 'completed'

            return (
              <div
                key={key}
                onClick={() => workout && router.push(`/calendar/${workout.id}`)}
                className="relative min-h-[80px] p-2 transition-all"
                style={{
                  borderRight:  isLastCol ? 'none' : `1px solid var(--border)`,
                  borderBottom: isLastRow ? 'none' : `1px solid var(--border)`,
                  background:   isToday ? 'var(--green-dim)' : 'transparent',
                  cursor:       workout ? 'pointer' : 'default',
                  opacity:      inMonth ? 1 : 0.3,
                }}>

                {/* Date number */}
                <span
                  className="text-xs font-bold inline-flex items-center justify-center w-6 h-6 rounded-full mb-1"
                  style={{
                    background: isToday ? 'var(--green)' : 'transparent',
                    color:      isToday ? '#000' : inMonth ? 'var(--text-2)' : 'var(--text-3)',
                  }}>
                  {cellDate.getDate()}
                </span>

                {/* Workout chip */}
                {workout && style && (
                  <div
                    className="rounded-lg px-1.5 py-1 cursor-pointer"
                    style={{
                      background: isCompleted ? 'var(--green-dim)' : style.bg,
                      border: `1px solid ${isCompleted ? 'var(--green)' : 'transparent'}`,
                    }}>
                    <p className="text-xs font-bold leading-tight truncate"
                      style={{ color: isCompleted ? 'var(--green)' : style.text }}>
                      {isCompleted ? '✓ ' : ''}{workout.title}
                    </p>
                    {workout.distance_km && (
                      <p className="text-xs leading-tight" style={{ color: isCompleted ? 'var(--green)' : style.text, opacity: 0.8 }}>
                        {workout.distance_km} km
                      </p>
                    )}
                  </div>
                )}

              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-4">
        {[
          { label: 'Easy / Long', bg: 'var(--blue-dim)', text: 'var(--blue)' },
          { label: 'Tempo / Interway', bg: 'var(--orange-dim)', text: 'var(--orange)' },
          { label: 'Ukończony', bg: 'var(--green-dim)', text: 'var(--green)' },
          { label: 'Rest', bg: 'var(--surface3)', text: 'var(--text-3)' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ background: l.bg, border: `1px solid ${l.text}` }} />
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>{l.label}</span>
          </div>
        ))}
      </div>
    </>
  )
}

// ─── Shared components ────────────────────────────────────────────────────────

function StatMini({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--text-3)' }}>{label}</p>
      <p className="text-2xl font-black" style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif', color: accent ? 'var(--green)' : 'var(--text)' }}>
        {value}
      </p>
    </div>
  )
}
