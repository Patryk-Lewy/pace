'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const DAYS = [
  { id: 'mon', label: 'Pon' }, { id: 'tue', label: 'Wt' },
  { id: 'wed', label: 'Śr' }, { id: 'thu', label: 'Czw' },
  { id: 'fri', label: 'Pt' }, { id: 'sat', label: 'Sob' },
  { id: 'sun', label: 'Ndz' },
]

const DISTANCES = [
  { id: '5km', label: '5 km' }, { id: '10km', label: '10 km' },
  { id: 'half', label: 'Półmaraton' }, { id: 'marathon', label: 'Maraton' },
]

const SESSION_OPTS = [
  { id: 30, label: '30 min' }, { id: 45, label: '45 min' },
  { id: 60, label: '60 min' }, { id: 90, label: '90 min' },
  { id: 120, label: '2 godz+' },
]

const inputStyle: React.CSSProperties = {
  background: 'var(--surface2)', border: '1px solid var(--border)',
  color: 'var(--text)', borderRadius: 10, padding: '10px 14px', fontSize: 14, width: '100%',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

type FormState = {
  race_goal_time: string
  race_distance: string
  race_date: string
  weekly_km: string
  pb_5k: string
  pb_10k: string
  pb_half: string
  pb_marathon: string
  available_days: string[]
  max_session_minutes: number
  injury_history: string
  additional_goal: string
}

const EMPTY: FormState = {
  race_goal_time: '', race_distance: '', race_date: '', weekly_km: '',
  pb_5k: '', pb_10k: '', pb_half: '', pb_marathon: '',
  available_days: [], max_session_minutes: 60, injury_history: '', additional_goal: '',
}

/**
 * Inline editor for the parameters that drive plan generation.
 * Lives on the Plan page. Saves to runner_profiles, then (optionally)
 * triggers a plan rebuild that preserves completed workouts.
 */
export default function PlanParamsEditor({
  hasPlan,
  onRebuilt,
}: {
  hasPlan: boolean
  onRebuilt: () => void
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [rebuilding, setRebuilding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: prof } = await supabase.from('runner_profiles').select('*').maybeSingle()
      if (prof) {
        setForm({
          race_goal_time: prof.race_goal_time ?? '',
          race_distance: prof.race_distance ?? '',
          race_date: prof.race_date ?? '',
          weekly_km: prof.weekly_km?.toString() ?? '',
          pb_5k: prof.pb_5k ?? '',
          pb_10k: prof.pb_10k ?? '',
          pb_half: prof.pb_half ?? '',
          pb_marathon: prof.pb_marathon ?? '',
          available_days: prof.available_days ?? [],
          max_session_minutes: prof.max_session_minutes ?? 60,
          injury_history: prof.injury_history ?? '',
          additional_goal: prof.additional_goal ?? '',
        })
      }
      setLoading(false)
    }
    load()
  }, [])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
    setOkMsg(null)
  }

  function toggleDay(day: string) {
    set('available_days', form.available_days.includes(day)
      ? form.available_days.filter(d => d !== day)
      : [...form.available_days, day])
  }

  async function saveProfile(): Promise<boolean> {
    const res = await fetch('/api/profile/update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        race_goal_time: form.race_goal_time.trim() || null,
        weekly_km: form.weekly_km ? Number(form.weekly_km) : null,
        max_session_minutes: form.max_session_minutes,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Błąd zapisu')
      return false
    }
    return true
  }

  async function handleSaveOnly() {
    setSaving(true)
    setError(null)
    setOkMsg(null)
    const ok = await saveProfile()
    setSaving(false)
    if (ok) setOkMsg('Parametry zapisane. Kliknij „Przebuduj plan", aby je zastosować.')
  }

  async function handleRebuild() {
    setRebuilding(true)
    setError(null)
    setOkMsg(null)
    // Save params first, then rebuild
    const saved = await saveProfile()
    if (!saved) { setRebuilding(false); return }

    const res = await fetch('/api/generate-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rebuild: hasPlan }),
    })
    const data = await res.json()
    setRebuilding(false)
    if (!res.ok) {
      setError(data.error ?? 'Błąd przebudowy planu')
      return
    }
    const kept = data.kept_workouts ?? 0
    setOkMsg(kept > 0
      ? `Plan przebudowany. Zachowano ${kept} ukończonych treningów, reszta zaktualizowana.`
      : 'Plan przebudowany pod nowe parametry.')
    onRebuilt()
  }

  if (loading) return null

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-6 py-4 transition-all hover:opacity-80">
        <span className="text-sm font-black uppercase tracking-widest"
          style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif', color: 'var(--text-2)' }}>
          ⚙️ Parametry planu
        </span>
        <span style={{ color: 'var(--text-3)' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-6 pb-6 flex flex-col gap-5 border-t pt-5" style={{ borderColor: 'var(--border)' }}>
          <Field label="Cel czasowy (opcjonalnie)">
            <div className="relative">
              <input value={form.race_goal_time} onChange={e => set('race_goal_time', e.target.value)}
                placeholder="np. 3:30:00" style={{ ...inputStyle, paddingRight: 72 }} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--text-3)' }}>H:MM:SS</span>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>Claude dobierze tempa treningowe pod ten wynik</p>
          </Field>

          <Field label="Dystans docelowy">
            <div className="flex gap-2 flex-wrap">
              {DISTANCES.map(d => (
                <button key={d.id} onClick={() => set('race_distance', d.id)}
                  className="rounded-xl px-4 py-2 text-sm font-semibold transition-all"
                  style={{
                    background: form.race_distance === d.id ? 'var(--green)' : 'var(--surface2)',
                    color: form.race_distance === d.id ? '#000' : 'var(--text-2)',
                    border: `1px solid ${form.race_distance === d.id ? 'var(--green)' : 'var(--border)'}`,
                  }}>
                  {d.label}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Data zawodów">
              <input type="date" value={form.race_date} onChange={e => set('race_date', e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Km / tydzień">
              <input type="number" value={form.weekly_km} min={0} max={300}
                onChange={e => set('weekly_km', e.target.value)} placeholder="np. 30" style={inputStyle} />
            </Field>
          </div>

          <Field label="Rekordy życiowe">
            <div className="space-y-2">
              {([
                { key: 'pb_5k', label: '5 km', ph: 'np. 23:45', hint: 'MM:SS' },
                { key: 'pb_10k', label: '10 km', ph: 'np. 48:30', hint: 'MM:SS' },
                { key: 'pb_half', label: 'Półmaraton', ph: 'np. 1:52:30', hint: 'H:MM:SS' },
                { key: 'pb_marathon', label: 'Maraton', ph: 'np. 3:45:00', hint: 'H:MM:SS' },
              ] as const).map(({ key, label, ph, hint }) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-xs w-24 shrink-0" style={{ color: 'var(--text-3)' }}>{label}</span>
                  <div className="relative flex-1">
                    <input value={form[key]} onChange={e => set(key, e.target.value)}
                      placeholder={ph} style={{ ...inputStyle, paddingRight: 60 }} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--text-3)' }}>{hint}</span>
                  </div>
                </div>
              ))}
            </div>
          </Field>

          <Field label="Dostępne dni treningowe">
            <div className="flex gap-2 flex-wrap">
              {DAYS.map(d => (
                <button key={d.id} onClick={() => toggleDay(d.id)}
                  className="w-12 h-10 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: form.available_days.includes(d.id) ? 'var(--green)' : 'var(--surface2)',
                    color: form.available_days.includes(d.id) ? '#000' : 'var(--text-2)',
                    border: `1px solid ${form.available_days.includes(d.id) ? 'var(--green)' : 'var(--border)'}`,
                  }}>
                  {d.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Maksymalny czas sesji">
            <div className="flex gap-2 flex-wrap">
              {SESSION_OPTS.map(s => (
                <button key={s.id} onClick={() => set('max_session_minutes', s.id)}
                  className="rounded-xl px-4 py-2 text-sm font-semibold transition-all"
                  style={{
                    background: form.max_session_minutes === s.id ? 'var(--orange)' : 'var(--surface2)',
                    color: form.max_session_minutes === s.id ? '#000' : 'var(--text-2)',
                    border: `1px solid ${form.max_session_minutes === s.id ? 'var(--orange)' : 'var(--border)'}`,
                  }}>
                  {s.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Historia kontuzji">
            <textarea value={form.injury_history} onChange={e => set('injury_history', e.target.value)}
              rows={2} placeholder="np. Ból kolana w 2024 (ustąpił)" style={{ ...inputStyle, resize: 'vertical' }} />
          </Field>

          <Field label="Cel dodatkowy">
            <input value={form.additional_goal} onChange={e => set('additional_goal', e.target.value)}
              placeholder="np. Schudnąć 5 kg, poprawić kondycję" style={inputStyle} />
          </Field>

          {error && (
            <p className="text-sm rounded-xl px-4 py-3" style={{ background: 'var(--orange-dim)', color: 'var(--orange)' }}>
              {error}
            </p>
          )}
          {okMsg && (
            <p className="text-sm rounded-xl px-4 py-3" style={{ background: 'var(--green-dim)', color: 'var(--green)' }}>
              {okMsg}
            </p>
          )}

          <div className="flex gap-3 flex-wrap">
            <button onClick={handleSaveOnly} disabled={saving || rebuilding}
              className="rounded-xl px-5 py-3 text-sm font-semibold transition-all"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
              {saving ? 'Zapisywanie...' : 'Tylko zapisz'}
            </button>
            <button onClick={handleRebuild} disabled={saving || rebuilding}
              className="flex-1 rounded-xl px-5 py-3 text-sm font-black uppercase tracking-widest transition-all hover:-translate-y-0.5"
              style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif', background: 'var(--green)', color: '#000', minWidth: 180 }}>
              {rebuilding ? 'Przebudowuję plan...' : hasPlan ? '🔄 Przebuduj plan' : '⚡ Wygeneruj plan'}
            </button>
          </div>
          {hasPlan && (
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>
              Przebudowa zachowuje ukończone i pominięte treningi — zmienia tylko te jeszcze niezrobione.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
