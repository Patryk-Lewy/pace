'use client'

// Supplementary training library + guided player: per-exercise countdown,
// auto-advance, voice cues (same Web Speech pattern as the live run).

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ROUTINES, routineDuration, findRoutine, animFor, demoSearchUrl, type Routine } from '@/lib/exercises'
import ExerciseFigure from '@/components/ExerciseFigure'

function speak(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  try {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'pl-PL'
    window.speechSynthesis.speak(u)
  } catch { /* ignore */ }
}

function fmtMin(totalSec: number): string {
  const m = Math.round(totalSec / 60)
  return `~${m} min`
}

export default function ExercisesPage() {
  const [active, setActive] = useState<Routine | null>(null)

  // Deep-link support: /exercises?r=warmup opens the player directly
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('r')
    const r = findRoutine(id)
    if (r) setActive(r)
  }, [])

  if (active) {
    return <RoutinePlayer routine={active} onExit={() => setActive(null)} />
  }

  return (
    <div className="animate-fade-up">
      <Link href="/dashboard" className="press flex items-center"
        style={{ gap: 8, padding: '16px 0 10px', font: '600 13px var(--font-barlow)', color: 'var(--text-2)', textDecoration: 'none' }}>
        <span style={{ fontSize: 18 }}>‹</span> Dziś
      </Link>
      <div style={{ paddingBottom: 16 }}>
        <div className="cond" style={{ fontSize: 30 }}>Uzupełniające</div>
        <div style={{ font: '500 12px var(--font-barlow)', color: 'var(--text-3)', marginTop: 2 }}>
          Rozgrzewka, siła i regeneracja — z prowadzeniem głosowym
        </div>
      </div>

      <div className="flex flex-col" style={{ gap: 10 }}>
        {ROUTINES.map(r => (
          <button key={r.id} onClick={() => setActive(r)} className="press text-left flex items-center"
            style={{ gap: 14, borderRadius: 20, padding: 16, background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-center"
              style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--green-dim)', fontSize: 24, flexShrink: 0 }}>
              {r.emoji}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: '700 15px var(--font-barlow)' }}>{r.title}</div>
              <div style={{ font: '500 12px var(--font-barlow)', color: 'var(--text-3)' }}>
                {r.focus} · {r.exercises.length} ćwiczeń
              </div>
            </div>
            <div className="cond" style={{ fontSize: 18, color: 'var(--green)', flexShrink: 0 }}>
              {fmtMin(routineDuration(r))}
            </div>
          </button>
        ))}
      </div>

      <p style={{ font: '500 11px var(--font-barlow)', color: 'var(--text-3)', marginTop: 16, textAlign: 'center' }}>
        Przy bólu lub kontuzji odpuść i skonsultuj się ze specjalistą.
      </p>
    </div>
  )
}

// ─── Guided player ────────────────────────────────────────────────────────────

function RoutinePlayer({ routine, onExit }: { routine: Routine; onExit: () => void }) {
  const [idx, setIdx] = useState(0)
  const [remaining, setRemaining] = useState(routine.exercises[0].seconds)
  const [running, setRunning] = useState(true)
  const [finished, setFinished] = useState(false)
  const runningRef = useRef(true)
  useEffect(() => { runningRef.current = running }, [running])

  const total = routineDuration(routine)
  const elapsedBefore = routine.exercises.slice(0, idx).reduce((s, e) => s + e.seconds, 0)
  const overallPct = Math.min(((elapsedBefore + (routine.exercises[idx]?.seconds ?? 0) - remaining) / total) * 100, 100)

  const cur = routine.exercises[idx]
  const next = routine.exercises[idx + 1] ?? null

  // Announce first exercise on mount
  useEffect(() => {
    speak(`${routine.title}. Pierwsze ćwiczenie: ${routine.exercises[0].name}`)
    return () => { try { window.speechSynthesis?.cancel() } catch { /* ignore */ } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Countdown + auto-advance
  useEffect(() => {
    const t = setInterval(() => {
      if (!runningRef.current) return
      setRemaining(r => {
        if (r > 1) return r - 1
        // advance
        setIdx(i => {
          const ni = i + 1
          if (ni >= routine.exercises.length) {
            setFinished(true)
            setRunning(false)
            speak('Koniec! Dobra robota.')
            return i
          }
          speak(routine.exercises[ni].name)
          return ni
        })
        return 0
      })
      return
    }, 1000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When idx changes, reset the per-exercise clock
  useEffect(() => {
    if (!finished) setRemaining(routine.exercises[idx].seconds)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx])

  function skip() {
    if (idx + 1 >= routine.exercises.length) {
      setFinished(true)
      setRunning(false)
      speak('Koniec! Dobra robota.')
    } else {
      speak(routine.exercises[idx + 1].name)
      setIdx(i => i + 1)
    }
  }

  if (finished) {
    return (
      <div style={overlay}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>{routine.emoji}</div>
          <div className="cond" style={{ fontSize: 34, color: 'var(--green)' }}>Zrobione!</div>
          <p style={{ font: '500 13px var(--font-barlow)', color: 'var(--text-2)', marginTop: 8 }}>
            {routine.title} · {fmtMin(total)}
          </p>
        </div>
        <button onClick={onExit} className="press" style={{
          width: '100%', borderRadius: 16, padding: 15, background: 'var(--green)', color: '#000',
          font: '800 15px var(--font-barlow-condensed)', letterSpacing: 1.5, textTransform: 'uppercase', border: 'none',
        }}>Wróć do listy</button>
      </div>
    )
  }

  return (
    <div style={overlay}>
      {/* Top */}
      <div className="flex items-center justify-between">
        <button onClick={onExit} className="press flex items-center"
          style={{ gap: 6, font: '600 13px var(--font-barlow)', color: 'var(--text-2)', background: 'none', border: 'none' }}>
          <span style={{ fontSize: 18 }}>‹</span> {routine.title}
        </button>
        <span style={{ font: '700 12px var(--font-barlow)', color: 'var(--text-3)' }}>
          {idx + 1} / {routine.exercises.length}
        </span>
      </div>

      {/* Overall progress */}
      <div style={{ height: 4, borderRadius: 4, background: 'var(--surface3)', margin: '14px 0', overflow: 'hidden' }}>
        <div style={{ width: `${overallPct}%`, height: '100%', background: 'var(--green)', transition: 'width 1s linear' }} />
      </div>

      {/* Center */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <div className="cond" style={{ fontSize: 28, marginBottom: 2 }}>{cur.name}</div>

        <div className="flex items-center justify-center" style={{ gap: 14, margin: '4px 0' }}>
          <ExerciseFigure anim={animFor(cur.name)} size={116} />
          <div className="cond" style={{ fontSize: 84, color: remaining <= 5 ? 'var(--orange)' : 'var(--green)', minWidth: 96 }}>
            {remaining}
          </div>
        </div>

        <p style={{ font: '400 13px/1.5 var(--font-barlow)', color: 'var(--text-2)', maxWidth: 320 }}>
          {cur.desc}
        </p>

        <a href={demoSearchUrl(cur.name)} target="_blank" rel="noopener noreferrer" className="press"
          style={{ marginTop: 12, font: '600 12px var(--font-barlow)', color: 'var(--green)', textDecoration: 'none',
            border: '1px solid rgba(0,230,118,.3)', borderRadius: 20, padding: '6px 14px' }}>
          ▶ Zobacz demo wideo
        </a>

        {next && (
          <p style={{ font: '600 12px var(--font-barlow)', color: 'var(--text-3)', marginTop: 14 }}>
            Następne: {next.name} · {next.seconds}s
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center" style={{ gap: 28 }}>
        <button onClick={onExit} className="press flex items-center justify-center" aria-label="Zakończ"
          style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--surface2)', border: '1px solid rgba(255,255,255,.12)', color: 'var(--text)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="3" /></svg>
        </button>
        <button onClick={() => setRunning(r => !r)} className="press flex items-center justify-center" aria-label={running ? 'Pauza' : 'Wznów'}
          style={{ width: 84, height: 84, borderRadius: '50%', background: 'var(--green)', border: 'none', color: '#000', boxShadow: '0 10px 30px -6px rgba(0,230,118,.55)' }}>
          {running
            ? <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1.5" /><rect x="14" y="5" width="4" height="14" rx="1.5" /></svg>
            : <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>}
        </button>
        <button onClick={skip} className="press flex items-center justify-center" aria-label="Pomiń"
          style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--surface2)', border: '1px solid rgba(255,255,255,.12)', color: 'var(--text)' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5v14l8-7z" /><rect x="16" y="5" width="3" height="14" rx="1" /></svg>
        </button>
      </div>
    </div>
  )
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 50,
  background: 'radial-gradient(120% 80% at 50% 0%, #0f1a12, #08080a)',
  display: 'flex', flexDirection: 'column', padding: '56px 24px 30px',
}
