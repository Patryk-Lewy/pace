'use client'

// Live-run screen with real GPS tracking. Accumulates distance from
// geolocation fixes (haversine), freezes on pause, and on Stop persists the
// run via /api/run/save (which matches it to the planned workout + AI comment).

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type Phase = 'locating' | 'tracking' | 'denied' | 'saving'

function fmtTime(el: number): string {
  const h = Math.floor(el / 3600)
  const m = Math.floor((el % 3600) / 60)
  const s = el % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

function fmtPace(secPerKm: number | null): string {
  if (!secPerKm || !Number.isFinite(secPerKm) || secPerKm <= 0) return '—'
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Haversine distance in metres between two lat/lng points. */
function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const la1 = a.lat * Math.PI / 180
  const la2 = b.lat * Math.PI / 180
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

export default function RunPage() {
  const router = useRouter()
  const [running, setRunning] = useState(true)
  const [elapsed, setElapsed] = useState(0)
  const [distanceM, setDistanceM] = useState(0)
  const [curPace, setCurPace] = useState<number | null>(null)
  const [phase, setPhase] = useState<Phase>('locating')

  const runningRef = useRef(true)
  const distanceRef = useRef(0)
  const lastFix = useRef<{ lat: number; lng: number; t: number } | null>(null)
  const startIso = useRef<string>('')
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const watchId = useRef<number | null>(null)

  useEffect(() => { runningRef.current = running }, [running])

  // Timer: count elapsed seconds only while running
  useEffect(() => {
    timer.current = setInterval(() => {
      if (runningRef.current) setElapsed(e => e + 1)
    }, 1000)
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [])

  // GPS watch
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { setPhase('denied'); return }
    startIso.current = new Date().toISOString()

    watchId.current = navigator.geolocation.watchPosition(
      pos => {
        setPhase('tracking')
        const { latitude: lat, longitude: lng, accuracy } = pos.coords
        const t = pos.timestamp
        if (accuracy && accuracy > 40) return // too noisy to trust

        const prev = lastFix.current
        lastFix.current = { lat, lng, t }
        if (!prev || !runningRef.current) return

        const seg = haversine(prev, { lat, lng })
        const dt = (t - prev.t) / 1000
        if (dt <= 0) return
        const speed = seg / dt // m/s
        if (speed > 12) return // >43 km/h — GPS jump, discard

        if (seg >= 1) {
          distanceRef.current += seg
          setDistanceM(distanceRef.current)
          setCurPace(seg > 0 ? Math.round((dt / seg) * 1000) : null)
        }
      },
      () => setPhase('denied'),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 },
    )

    return () => { if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current) }
  }, [])

  const distKm = distanceM / 1000
  const avgPace = distKm > 0.05 ? Math.round(elapsed / distKm) : null

  async function stopAndSave() {
    if (timer.current) clearInterval(timer.current)
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
    setRunning(false)
    setPhase('saving')

    // Nothing meaningful recorded → just leave without saving
    if (distanceM < 100 || elapsed < 5) { router.push('/dashboard'); return }

    try {
      await fetch('/api/run/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          distance_m: Math.round(distanceM),
          moving_time_s: elapsed,
          elapsed_time_s: elapsed,
          avg_pace_s_per_km: avgPace,
          start_date: startIso.current || new Date().toISOString(),
        }),
      })
    } catch { /* saved-run failure shouldn't trap the user on this screen */ }
    router.push('/stats')
  }

  if (phase === 'denied') {
    return (
      <div style={overlay}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: 12 }}>
          <div style={{ fontSize: 40 }}>📍</div>
          <div className="cond" style={{ fontSize: 26 }}>Brak dostępu do GPS</div>
          <p style={{ font: '500 13px var(--font-barlow)', color: 'var(--text-2)', maxWidth: 260 }}>
            Włącz lokalizację dla przeglądarki, aby PACE mógł mierzyć dystans i tempo biegu.
          </p>
          <button onClick={() => router.push('/dashboard')} className="press" style={{
            marginTop: 8, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)',
            borderRadius: 14, padding: '12px 24px', font: '700 13px var(--font-barlow)',
          }}>Wróć do Dziś</button>
        </div>
      </div>
    )
  }

  return (
    <div style={overlay}>
      {/* Top */}
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center" style={{ gap: 7, font: '700 11px var(--font-barlow)', letterSpacing: 1.5, color: 'var(--green)' }}>
          <span className="livedot" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
          {phase === 'locating' ? 'SZUKAM GPS…' : running ? 'BIEG NA ŻYWO' : 'PAUZA'}
        </div>
        <span style={{ font: '700 12px var(--font-barlow)', color: 'var(--text-2)' }}>PACE</span>
      </div>

      {/* Center */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <div className="kick" style={{ fontSize: 11, color: 'var(--text-3)' }}>Czas trwania</div>
        <div className="cond" style={{ fontSize: 92, letterSpacing: 1, margin: '2px 0 6px' }}>{fmtTime(elapsed)}</div>
        <div className="flex items-baseline" style={{ gap: 6 }}>
          <span className="cond" style={{ fontSize: 68, color: 'var(--green)' }}>{distKm.toFixed(2)}</span>
          <span className="cond" style={{ fontSize: 24, color: 'var(--text-2)' }}>km</span>
        </div>
      </div>

      {/* Metrics */}
      <div className="flex" style={{ gap: 10, marginBottom: 14 }}>
        <Metric label="Tempo" value={fmtPace(curPace)} sub="/km" />
        <Metric label="Śr. tempo" value={fmtPace(avgPace)} sub="/km" />
        <Metric label="Dystans" value={distKm.toFixed(2)} sub="km" accent />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center" style={{ gap: 28 }}>
        <button className="press flex items-center justify-center" onClick={stopAndSave} aria-label="Zakończ"
          disabled={phase === 'saving'}
          style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--surface2)', border: '1px solid rgba(255,255,255,.12)', color: 'var(--text)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="3" /></svg>
        </button>
        <button className="press flex items-center justify-center" onClick={() => setRunning(r => !r)} aria-label={running ? 'Pauza' : 'Wznów'}
          style={{ width: 84, height: 84, borderRadius: '50%', background: 'var(--green)', border: 'none', color: '#000', boxShadow: '0 10px 30px -6px rgba(0,230,118,.55)' }}>
          {running
            ? <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1.5" /><rect x="14" y="5" width="4" height="14" rx="1.5" /></svg>
            : <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>}
        </button>
        <div style={{ width: 60, height: 60 }} />
      </div>

      {phase === 'saving' && (
        <p className="text-center" style={{ font: '600 12px var(--font-barlow)', color: 'var(--text-3)', marginTop: 12 }}>Zapisywanie biegu…</p>
      )}
    </div>
  )
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 50,
  background: 'radial-gradient(120% 80% at 50% 0%, #0f1a12, #08080a)',
  display: 'flex', flexDirection: 'column', padding: '64px 24px 30px',
}

function Metric({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div style={{
      flex: 1, textAlign: 'center', borderRadius: 18, padding: '14px 10px',
      background: accent ? 'rgba(0,230,118,.08)' : 'rgba(255,255,255,.05)',
      border: `1px solid ${accent ? 'rgba(0,230,118,.25)' : 'rgba(255,255,255,.08)'}`,
    }}>
      <div className="kick" style={{ fontSize: 9, color: 'var(--text-3)' }}>{label}</div>
      <div className="cond" style={{ fontSize: 28, marginTop: 3, color: accent ? 'var(--green)' : 'var(--text)' }}>{value}</div>
      <div style={{ font: '600 9px var(--font-barlow)', color: 'var(--text-3)' }}>{sub}</div>
    </div>
  )
}
