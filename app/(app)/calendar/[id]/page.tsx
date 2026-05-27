'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { classifyHR, estimateMaxHR } from '@/lib/heart-rate-zones'
import { PoweredByStrava } from '@/components/PoweredByStrava'
import type { Workout, Activity } from '@/types/database'

const TYPE_META: Record<string, { color: string; bg: string; emoji: string; zone: string; label: string }> = {
  easy_run:  { color: 'var(--blue)',   bg: 'var(--blue-dim)',   emoji: '🚶', zone: 'Z1–Z2', label: 'Easy Run' },
  long_run:  { color: 'var(--blue)',   bg: 'var(--blue-dim)',   emoji: '🏃', zone: 'Z2',    label: 'Long Run' },
  tempo:     { color: 'var(--orange)', bg: 'var(--orange-dim)', emoji: '⚡', zone: 'Z3',    label: 'Tempo Run' },
  intervals: { color: 'var(--orange)', bg: 'var(--orange-dim)', emoji: '🔥', zone: 'Z4–Z5', label: 'Interwały' },
  rest:      { color: 'var(--text-3)', bg: 'var(--surface3)',   emoji: '😴', zone: '—',     label: 'Odpoczynek' },
}

const DAY_PL: Record<string, string> = {
  mon: 'Poniedziałek', tue: 'Wtorek', wed: 'Środa',
  thu: 'Czwartek', fri: 'Piątek', sat: 'Sobota', sun: 'Niedziela',
}

export default function WorkoutDetailPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [workout, setWorkout] = useState<Workout | null>(null)
  const [matchedActivity, setMatchedActivity] = useState<Activity | null>(null)
  const [maxHR, setMaxHR] = useState(190)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: w } = await supabase.from('workouts').select('*').eq('id', id).single()
      setWorkout(w)

      if (w) {
        // Find matched Strava activity for this workout
        const { data: act } = await supabase
          .from('activities')
          .select('*')
          .eq('matched_workout_id', w.id)
          .maybeSingle()

        if (act) {
          setMatchedActivity(act)
          // Estimate maxHR from recent activities to classify zones
          const { data: recent } = await supabase
            .from('activities')
            .select('max_heartrate')
            .order('start_date', { ascending: false })
            .limit(20)
          setMaxHR(estimateMaxHR(recent ?? []))
        }
      }

      setLoading(false)
    }
    load()
  }, [id])

  async function setStatus(status: 'planned' | 'completed' | 'skipped') {
    if (!workout) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('workouts').update({
      status,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
    }).eq('id', workout.id)
    setWorkout(prev => prev ? { ...prev, status } : prev)
    setSaving(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-sm" style={{ color: 'var(--text-3)' }}>Ładowanie...</p>
    </div>
  )

  if (!workout) return (
    <div className="max-w-lg">
      <p className="text-sm" style={{ color: 'var(--text-3)' }}>Trening nie znaleziony.</p>
    </div>
  )

  const meta = TYPE_META[workout.workout_type] ?? TYPE_META.rest
  const isCompleted = workout.status === 'completed'
  const isSkipped = workout.status === 'skipped'

  return (
    <div className="max-w-2xl animate-fade-up">
      {/* Back */}
      <button onClick={() => router.back()}
        className="flex items-center gap-2 text-sm mb-6 transition-all hover:opacity-70"
        style={{ color: 'var(--text-3)' }}>
        ← Kalendarz
      </button>

      {/* Header */}
      <div className="rounded-2xl p-6 mb-4"
        style={{ background: 'var(--surface)', border: `1px solid ${isCompleted ? 'var(--green)' : 'var(--border)'}` }}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
                Tydzień {workout.week_number} · {DAY_PL[workout.day_of_week] ?? workout.day_of_week}
              </span>
              {workout.phase && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: 'var(--surface2)', color: 'var(--text-3)' }}>
                  {workout.phase}
                </span>
              )}
            </div>
            <h1 className="text-4xl font-black mb-1"
              style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif' }}>
              {workout.title}
            </h1>
            <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full"
              style={{ background: meta.bg, color: meta.color }}>
              {meta.emoji} {meta.label}
            </span>
          </div>

          {/* Status badge */}
          {isCompleted && (
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: 'var(--green)', color: '#000' }}>✓</div>
          )}
          {isSkipped && (
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: 'var(--surface2)', color: 'var(--text-3)' }}>✕</div>
          )}
        </div>

        {/* Metrics */}
        {workout.workout_type !== 'rest' && (
          <div className="grid grid-cols-3 gap-3 mt-4">
            {workout.distance_km && (
              <MetricBlock label="Dystans" value={`${workout.distance_km}`} unit="km" color={meta.color} />
            )}
            {workout.target_pace && (
              <MetricBlock label="Tempo" value={cleanPace(workout.target_pace)} unit="/km" color={meta.color} />
            )}
            {workout.duration_minutes && (
              <MetricBlock label="Czas" value={`${workout.duration_minutes}`} unit="min" color={meta.color} />
            )}
          </div>
        )}
      </div>

      {/* Zone — planned + actual (if Strava data exists) */}
      {workout.workout_type !== 'rest' && (
        <div className="rounded-2xl p-4 mb-4"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-4">
            {/* Planned zone */}
            <div className="flex items-center gap-3 flex-1">
              <div className="w-2 h-8 rounded-full flex-shrink-0" style={{ background: meta.color }} />
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
                  Zaplanowana strefa
                </p>
                <p className="text-lg font-bold" style={{ color: meta.color }}>{meta.zone}</p>
              </div>
            </div>

            {/* Actual zone from Strava */}
            {matchedActivity?.avg_heartrate && (() => {
              const actualZone = classifyHR(matchedActivity.avg_heartrate, maxHR)
              return (
                <div className="flex items-center gap-3 flex-1 border-l pl-4" style={{ borderColor: 'var(--border)' }}>
                  <div className="w-2 h-8 rounded-full flex-shrink-0" style={{ background: actualZone.color }} />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
                      Wykonana strefa
                    </p>
                    <p className="text-lg font-bold" style={{ color: actualZone.color }}>
                      {actualZone.name} — {Math.round(matchedActivity.avg_heartrate)} bpm
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>{actualZone.label}</p>
                  </div>
                </div>
              )
            })()}
          </div>

          {/* Strava matched activity summary */}
          {matchedActivity && (
            <div className="mt-3 pt-3 border-t flex gap-4 text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}>
              <span>🏃 {((matchedActivity.distance_m ?? 0) / 1000).toFixed(2)} km</span>
              {matchedActivity.avg_pace_s_per_km && (
                <span>⏱ {Math.floor(matchedActivity.avg_pace_s_per_km / 60)}:{(Math.round(matchedActivity.avg_pace_s_per_km) % 60).toString().padStart(2, '0')}/km</span>
              )}
              {matchedActivity.avg_heartrate && <span>♥ {Math.round(matchedActivity.avg_heartrate)} śr.</span>}
              {matchedActivity.max_heartrate && <span>♥↑ {Math.round(matchedActivity.max_heartrate)} max</span>}
              <PoweredByStrava className="ml-auto" />
            </div>
          )}
        </div>
      )}

      {/* Description */}
      {workout.description && (
        <div className="rounded-2xl p-5 mb-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-3)' }}>
            Opis treningu
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
            {workout.description}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3">
        {!isCompleted ? (
          <button onClick={() => setStatus('completed')} disabled={saving}
            className="w-full rounded-xl py-4 text-base font-black uppercase tracking-widest transition-all hover:-translate-y-0.5"
            style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif', background: 'var(--green)', color: '#000' }}>
            {saving ? 'Zapisywanie...' : '✓ Oznacz jako ukończony'}
          </button>
        ) : (
          <button onClick={() => setStatus('planned')} disabled={saving}
            className="w-full rounded-xl py-4 text-base font-bold transition-all"
            style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
            {saving ? 'Zapisywanie...' : 'Cofnij ukończenie'}
          </button>
        )}
        {!isSkipped && !isCompleted && (
          <button onClick={() => setStatus('skipped')} disabled={saving}
            className="w-full rounded-xl py-3 text-sm font-semibold transition-all"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-3)' }}>
            Pomiń trening
          </button>
        )}

        {/* Garmin export */}
        {workout.workout_type !== 'rest' && (
          <a href={`/api/export/workout?id=${workout.id}`}
            className="w-full rounded-xl py-3 text-sm font-semibold text-center transition-all flex items-center justify-center gap-2"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-3)' }}>
            ⌚ Eksportuj do Garmin (.tcx)
          </a>
        )}
      </div>
    </div>
  )
}

/** Extract only MM:SS from pace strings that may contain extra description text */
function cleanPace(raw: string): string {
  return raw.match(/^\d+:\d{2}/)?.[0] ?? raw
}

function MetricBlock({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div className="rounded-xl p-3 text-center" style={{ background: 'var(--surface2)' }}>
      <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--text-3)' }}>{label}</p>
      <p className="text-2xl font-black leading-none truncate" style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif', color }}>
        {value}
      </p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{unit}</p>
    </div>
  )
}
