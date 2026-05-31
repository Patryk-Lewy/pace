'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { classifyHR, estimateMaxHR } from '@/lib/heart-rate-zones'
import { formatPace, formatDuration } from '@/lib/strava'
import { PoweredByStrava } from '@/components/PoweredByStrava'
import ShareWorkoutButton, { type ShareCardData } from '@/components/ShareWorkoutButton'
import type { Workout, Activity } from '@/types/database'

const TYPE_META: Record<string, { color: string; bg: string; emoji: string; zone: string; label: string }> = {
  easy_run:  { color: 'var(--blue)',   bg: 'var(--blue-dim)',   emoji: '🚶', zone: 'Z1–Z2', label: 'Easy Run' },
  long_run:  { color: 'var(--blue)',   bg: 'var(--blue-dim)',   emoji: '🏃', zone: 'Z2',    label: 'Long Run' },
  tempo:     { color: 'var(--orange)', bg: 'var(--orange-dim)', emoji: '⚡', zone: 'Z3',    label: 'Tempo Run' },
  intervals: { color: 'var(--orange)', bg: 'var(--orange-dim)', emoji: '🔥', zone: 'Z4–Z5', label: 'Interwały' },
  rest:      { color: 'var(--text-3)', bg: 'var(--surface3)',   emoji: '😴', zone: '—',     label: 'Odpoczynek' },
}

// Hex equivalents for canvas (CSS vars don't work in canvas context)
const TYPE_HEX: Record<string, string> = {
  easy_run: '#3b82f6', long_run: '#3b82f6',
  tempo: '#ff9100', intervals: '#ff9100', rest: '#8a8a8a',
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
  const [editing, setEditing] = useState(false)
  const [notes, setNotes] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [assigning, setAssigning] = useState(false)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: w } = await supabase.from('workouts').select('*').eq('id', id).single()
    setWorkout(w)
    setNotes(w?.user_notes ?? '')

    if (w) {
      const { data: act } = await supabase
        .from('activities')
        .select('*')
        .eq('matched_workout_id', w.id)
        .maybeSingle()

      setMatchedActivity(act ?? null)

      if (act) {
        const { data: recent } = await supabase
          .from('activities')
          .select('max_heartrate')
          .order('start_date', { ascending: false })
          .limit(20)
        setMaxHR(estimateMaxHR(recent ?? []))
      }
    }

    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function assignActivity(activityId: string) {
    setAssigning(true)
    const res = await fetch(`/api/activities/${activityId}/match`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workout_id: id }),
    })
    setAssigning(false)
    if (res.ok) {
      setAssignOpen(false)
      await load()
    } else {
      const data = await res.json().catch(() => ({}))
      alert(data.error ?? 'Nie udało się przypisać biegu. Spróbuj ponownie.')
    }
  }

  async function unlinkActivity() {
    if (!matchedActivity) return
    setAssigning(true)
    const res = await fetch(`/api/activities/${matchedActivity.id}/match`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workout_id: null }),
    })
    setAssigning(false)
    if (res.ok) await load()
    else {
      const data = await res.json().catch(() => ({}))
      alert(data.error ?? 'Nie udało się odpiąć biegu. Spróbuj ponownie.')
    }
  }

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

  async function setRpe(value: number | null) {
    if (!workout) return
    const res = await fetch(`/api/workouts/${workout.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rpe: value }),
    })
    if (res.ok) {
      setWorkout(prev => prev ? { ...prev, rpe: value } : prev)
    }
  }

  async function saveNotes() {
    if (!workout || notes === (workout.user_notes ?? '')) return
    setNotesSaving(true)
    setNotesSaved(false)
    const res = await fetch(`/api/workouts/${workout.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_notes: notes }),
    })
    if (res.ok) {
      setWorkout(prev => prev ? { ...prev, user_notes: notes || null } : prev)
      setNotesSaved(true)
      setTimeout(() => setNotesSaved(false), 2000)
    }
    setNotesSaving(false)
  }

  async function saveEdits(fields: {
    distance_km?: number | null
    target_pace?: string | null
    duration_minutes?: number | null
  }) {
    if (!workout) return { ok: false, error: 'Brak treningu' }
    const res = await fetch(`/api/workouts/${workout.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, error: data.error ?? 'Błąd zapisu' }
    setWorkout(data.workout)
    return { ok: true }
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

          {/* Status badge + Edit button */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {workout.workout_type !== 'rest' && (
              <button onClick={() => setEditing(true)}
                title="Edytuj parametry treningu"
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:-translate-y-0.5"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                ✎
              </button>
            )}
            {isCompleted && (
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl"
                style={{ background: 'var(--green)', color: '#000' }}>✓</div>
            )}
            {isSkipped && (
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl"
                style={{ background: 'var(--surface2)', color: 'var(--text-3)' }}>✕</div>
            )}
          </div>
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

      {/* Link management — assign / change / unlink a Strava run */}
      {workout.workout_type !== 'rest' && (
        <div className="rounded-2xl p-4 mb-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {matchedActivity ? (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--text-3)' }}>
                  🔗 Powiązany bieg
                </p>
                <p className="text-sm font-semibold">{matchedActivity.name}</p>
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                  {new Date(matchedActivity.start_date).toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' })}
                </p>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <button onClick={() => setAssignOpen(true)} disabled={assigning}
                  className="rounded-xl px-3 py-2 text-xs font-semibold transition-all"
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                  Zmień
                </button>
                <button onClick={unlinkActivity} disabled={assigning}
                  className="rounded-xl px-3 py-2 text-xs font-semibold transition-all"
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-3)' }}>
                  {assigning ? '...' : 'Odepnij'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--text-3)' }}>
                  🔗 Brak powiązanego biegu
                </p>
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                  Przypisz bieg ze Stravy, jeśli zrobiłeś ten trening
                </p>
              </div>
              <button onClick={() => setAssignOpen(true)} disabled={assigning}
                className="rounded-xl px-4 py-2.5 text-sm font-bold transition-all shrink-0"
                style={{ background: 'var(--green-dim)', border: '1px solid var(--green)', color: 'var(--green)' }}>
                Przypisz bieg
              </button>
            </div>
          )}
        </div>
      )}

      {assignOpen && (
        <AssignActivityModal
          currentActivityId={matchedActivity?.id ?? null}
          onPick={assignActivity}
          onClose={() => setAssignOpen(false)}
          busy={assigning}
        />
      )}

      {/* Description */}
      {workout.description && (
        <div className="rounded-2xl p-5 mb-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-3)' }}>
            Opis treningu
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
            {workout.description}
          </p>
        </div>
      )}

      {/* RPE — only when completed */}
      {isCompleted && workout.workout_type !== 'rest' && (
        <div className="rounded-2xl p-5 mb-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
                💪 Jak ciężki był ten trening?
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                1 = spacer · 10 = absolutne maksimum
              </p>
            </div>
            {workout.rpe !== null && workout.rpe !== undefined && (
              <button onClick={() => setRpe(null)}
                className="text-xs underline" style={{ color: 'var(--text-3)' }}>
                wyczyść
              </button>
            )}
          </div>
          <div className="grid grid-cols-10 gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => {
              const isSelected = workout.rpe === n
              const color =
                n <= 3 ? 'var(--blue)' :
                n <= 5 ? 'var(--green)' :
                n <= 7 ? 'var(--orange)' : 'var(--red, #ef4444)'
              return (
                <button
                  key={n}
                  onClick={() => setRpe(n)}
                  className="aspect-square rounded-lg text-sm font-black flex items-center justify-center transition-all hover:-translate-y-0.5"
                  style={{
                    background: isSelected ? color : 'var(--surface2)',
                    color: isSelected ? '#000' : 'var(--text-2)',
                    border: `1px solid ${isSelected ? color : 'var(--border)'}`,
                    fontFamily: 'var(--font-barlow-condensed), sans-serif',
                  }}
                >
                  {n}
                </button>
              )
            })}
          </div>
          {workout.rpe && (
            <p className="text-xs mt-3 text-center" style={{ color: 'var(--text-3)' }}>
              {workout.rpe <= 3 && '🟦 Łatwo — zostało dużo paliwa'}
              {workout.rpe >= 4 && workout.rpe <= 5 && '🟩 Umiarkowanie — mogłeś jeszcze trochę'}
              {workout.rpe >= 6 && workout.rpe <= 7 && '🟧 Ciężko — czuć wysiłek'}
              {workout.rpe >= 8 && workout.rpe <= 9 && '🟥 Bardzo ciężko — na granicy'}
              {workout.rpe === 10 && '🟥 Maksimum — wszystko co miałeś'}
            </p>
          )}
        </div>
      )}

      {/* User notes */}
      <div className="rounded-2xl p-5 mb-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
            📝 Twoje notatki
          </p>
          {notesSaving && <span className="text-xs" style={{ color: 'var(--text-3)' }}>Zapisuję...</span>}
          {notesSaved && <span className="text-xs" style={{ color: 'var(--green)' }}>✓ Zapisano</span>}
        </div>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          onBlur={saveNotes}
          placeholder="Np. Zrobiłem 8km zamiast 10 — bolało prawe kolano. Tempo 5:40, czułem się dobrze."
          rows={3}
          maxLength={2000}
          className="w-full rounded-xl px-4 py-3 text-sm leading-relaxed outline-none transition-colors resize-y"
          style={{
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            minHeight: '80px',
          }}
        />
        <p className="text-xs mt-2" style={{ color: 'var(--text-3)' }}>
          {notes.length}/2000 · Notatki są zapisywane automatycznie gdy klikniesz poza pole
        </p>
      </div>

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

        {/* Share result — only for completed runs */}
        {isCompleted && workout.workout_type !== 'rest' && (
          <ShareWorkoutButton data={buildShareData(workout, matchedActivity, meta.emoji, meta.label)} />
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

      {/* Edit modal */}
      {editing && (
        <EditModal
          workout={workout}
          onClose={() => setEditing(false)}
          onSave={saveEdits}
        />
      )}
    </div>
  )
}

function EditModal({
  workout, onClose, onSave,
}: {
  workout: Workout
  onClose: () => void
  onSave: (fields: {
    distance_km?: number | null
    target_pace?: string | null
    duration_minutes?: number | null
  }) => Promise<{ ok: boolean; error?: string }>
}) {
  const [distance, setDistance] = useState(workout.distance_km?.toString() ?? '')
  const [pace, setPace] = useState(workout.target_pace ? workout.target_pace.match(/^\d+:\d{2}/)?.[0] ?? workout.target_pace : '')
  const [duration, setDuration] = useState(workout.duration_minutes?.toString() ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit() {
    setError(null)
    setSaving(true)
    const result = await onSave({
      distance_km: distance === '' ? null : Number(distance),
      target_pace: pace.trim() || null,
      duration_minutes: duration === '' ? null : Number(duration),
    })
    setSaving(false)
    if (result.ok) {
      onClose()
    } else {
      setError(result.error ?? 'Błąd zapisu')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}>
      <div className="rounded-2xl p-6 w-full max-w-md animate-fade-up"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-2xl font-black"
            style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif' }}>
            Edytuj trening
          </h2>
          <button onClick={onClose} className="text-2xl" style={{ color: 'var(--text-3)' }}>×</button>
        </div>

        <div className="space-y-4">
          <Field label="Dystans (km)" type="number" step="0.1" min="0" max="200"
            value={distance} onChange={setDistance} placeholder="np. 10" />

          <Field label="Tempo (M:SS)" type="text"
            value={pace} onChange={setPace} placeholder="np. 5:30"
            hint="Format minut:sekund, np. 4:45" />

          <Field label="Czas (min)" type="number" step="1" min="0" max="600"
            value={duration} onChange={setDuration} placeholder="np. 45" />
        </div>

        {error && (
          <p className="text-sm mt-4 rounded-xl px-4 py-3"
            style={{ background: 'var(--orange-dim)', color: 'var(--orange)' }}>
            {error}
          </p>
        )}

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} disabled={saving}
            className="flex-1 rounded-xl py-3 text-sm font-semibold transition-all"
            style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
            Anuluj
          </button>
          <button onClick={submit} disabled={saving}
            className="flex-1 rounded-xl py-3 text-sm font-black uppercase tracking-widest transition-all"
            style={{
              fontFamily: 'var(--font-barlow-condensed), sans-serif',
              background: saving ? 'var(--surface3)' : 'var(--green)',
              color: saving ? 'var(--text-3)' : '#000',
            }}>
            {saving ? 'Zapisywanie...' : 'Zapisz'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({
  label, value, onChange, type, placeholder, hint, step, min, max,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type: string
  placeholder?: string
  hint?: string
  step?: string
  min?: string
  max?: string
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-widest mb-2"
        style={{ color: 'var(--text-3)' }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        step={step}
        min={min}
        max={max}
        className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-colors"
        style={{
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
        }}
      />
      {hint && <p className="text-xs mt-1.5" style={{ color: 'var(--text-3)' }}>{hint}</p>}
    </div>
  )
}

function AssignActivityModal({
  currentActivityId, onPick, onClose, busy,
}: {
  currentActivityId: string | null
  onPick: (activityId: string) => void
  onClose: () => void
  busy: boolean
}) {
  const [activities, setActivities] = useState<Activity[] | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const monthAgo = new Date(Date.now() - 28 * 24 * 3600 * 1000).toISOString()
      const { data } = await supabase
        .from('activities')
        .select('*')
        .is('matched_workout_id', null)
        .eq('hidden', false)
        .gte('start_date', monthAgo)
        .gte('distance_m', 1000)
        .order('start_date', { ascending: false })
        .limit(30)
      setActivities(data ?? [])
    }
    load()
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col animate-fade-up"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-xl font-black" style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif' }}>
            Wybierz bieg
          </h2>
          <button onClick={onClose} className="text-2xl" style={{ color: 'var(--text-3)' }}>×</button>
        </div>

        <div className="overflow-y-auto p-3">
          {activities === null && (
            <p className="text-sm text-center py-8" style={{ color: 'var(--text-3)' }}>Ładowanie...</p>
          )}
          {activities?.length === 0 && (
            <p className="text-sm text-center py-8" style={{ color: 'var(--text-3)' }}>
              Brak nieprzypisanych biegów z ostatnich 4 tygodni.
            </p>
          )}
          {activities?.map(a => (
            <button key={a.id} onClick={() => onPick(a.id)} disabled={busy}
              className="w-full text-left rounded-xl p-3 mb-2 transition-all hover:opacity-80"
              style={{
                background: a.id === currentActivityId ? 'var(--green-dim)' : 'var(--surface2)',
                border: `1px solid ${a.id === currentActivityId ? 'var(--green)' : 'var(--border)'}`,
              }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{a.name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                    {new Date(a.start_date).toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-base font-black" style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif', color: 'var(--green)' }}>
                    {((a.distance_m ?? 0) / 1000).toFixed(2)} km
                  </p>
                  {a.avg_pace_s_per_km && (
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>{formatPace(a.avg_pace_s_per_km)}/km</p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Extract only MM:SS from pace strings that may contain extra description text */
function cleanPace(raw: string): string {
  return raw.match(/^\d+:\d{2}/)?.[0] ?? raw
}

/** Build the data object for the shareable card, preferring real Strava activity data */
function buildShareData(
  workout: Workout,
  activity: Activity | null,
  emoji: string,
  typeLabel: string,
): ShareCardData {
  const fromStrava = !!activity?.distance_m
  const distanceKm = fromStrava
    ? (activity!.distance_m ?? 0) / 1000
    : (workout.distance_km ?? 0)

  const pace = fromStrava && activity!.avg_pace_s_per_km
    ? formatPace(activity!.avg_pace_s_per_km)
    : workout.target_pace
      ? cleanPace(workout.target_pace)
      : null

  const duration = fromStrava && activity!.moving_time_s
    ? formatDuration(activity!.moving_time_s)
    : workout.duration_minutes
      ? `${workout.duration_minutes} min`
      : null

  const completedDate = workout.completed_at ?? activity?.start_date ?? new Date().toISOString()

  return {
    title: workout.title,
    typeLabel,
    emoji,
    distanceText: fromStrava ? distanceKm.toFixed(2) : String(distanceKm),
    pace,
    duration,
    rpe: workout.rpe ?? null,
    heartrate: activity?.avg_heartrate ? Math.round(activity.avg_heartrate) : null,
    dateLabel: new Date(completedDate).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' }),
    weekLabel: workout.week_number ? `Tydzień ${workout.week_number}` : null,
    accentColor: TYPE_HEX[workout.workout_type] ?? '#00e676',
    fromStrava,
  }
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
