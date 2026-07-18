'use client'

// Live-run screen with real GPS tracking. Accumulates distance from
// geolocation fixes (haversine), freezes on pause, and on Stop persists the
// run via /api/run/save (which matches it to the planned workout + AI comment).

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import ShareWorkoutButton, { type ShareCardData } from '@/components/ShareWorkoutButton'
import RouteMap from '@/components/RouteMap'

type Phase = 'locating' | 'tracking' | 'denied' | 'saving' | 'done'

type RunSummary = {
  distanceM: number
  elapsed: number
  avgPace: number | null
  comment: string | null
  workoutTitle: string | null
  splits: number[]
}

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

// Minimal Web Bluetooth typings (not in the standard TS lib)
type BtCharacteristic = {
  startNotifications: () => Promise<unknown>
  addEventListener: (ev: string, cb: (e: Event) => void) => void
}
type BtDevice = {
  gatt?: {
    connect: () => Promise<{
      getPrimaryService: (s: string) => Promise<{ getCharacteristic: (c: string) => Promise<BtCharacteristic> }>
      disconnect: () => void
    }>
  }
  addEventListener: (ev: string, cb: () => void) => void
}
type BtNavigator = Navigator & {
  bluetooth?: { requestDevice: (opts: { filters: { services: string[] }[] }) => Promise<BtDevice> }
}

/** Parse a Heart Rate Measurement characteristic value (GATT spec). */
function parseHeartRate(dv: DataView): number {
  const flags = dv.getUint8(0)
  return (flags & 0x1) ? dv.getUint16(1, true) : dv.getUint8(1)
}

/** Speak a Polish announcement via Web Speech (no-op when unsupported). */
function speak(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  try {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'pl-PL'
    u.rate = 1
    window.speechSynthesis.speak(u)
  } catch { /* ignore */ }
}

function spokenPace(secPerKm: number | null): string {
  if (!secPerKm || !Number.isFinite(secPerKm) || secPerKm <= 0) return ''
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return s > 0 ? `${m} ${s.toString().padStart(2, '0')}` : `${m} minut`
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

  // Heart rate via Web Bluetooth (optional chest-strap pairing)
  const [hr, setHr] = useState<number | null>(null)
  const [hrSupported, setHrSupported] = useState(false)
  const hrStats = useRef({ sum: 0, n: 0, max: 0 })
  const hrDisconnect = useRef<(() => void) | null>(null)

  useEffect(() => {
    setHrSupported(typeof navigator !== 'undefined' && !!(navigator as BtNavigator).bluetooth)
    return () => { hrDisconnect.current?.() }
  }, [])

  async function connectHr() {
    try {
      const bt = (navigator as BtNavigator).bluetooth
      if (!bt) return
      const device = await bt.requestDevice({ filters: [{ services: ['heart_rate'] }] })
      const gatt = await device.gatt?.connect()
      if (!gatt) return
      const service = await gatt.getPrimaryService('heart_rate')
      const char = await service.getCharacteristic('heart_rate_measurement')
      await char.startNotifications()
      char.addEventListener('characteristicvaluechanged', (e: Event) => {
        const value = (e.target as unknown as { value?: DataView }).value
        if (!value) return
        const bpm = parseHeartRate(value)
        if (bpm > 30 && bpm < 240) {
          setHr(bpm)
          if (runningRef.current) {
            hrStats.current.sum += bpm
            hrStats.current.n += 1
            if (bpm > hrStats.current.max) hrStats.current.max = bpm
          }
        }
      })
      device.addEventListener('gattserverdisconnected', () => setHr(null))
      hrDisconnect.current = () => { try { gatt.disconnect() } catch { /* ignore */ } }
    } catch { /* user cancelled or pairing failed — stay silent */ }
  }

  // Splits, route capture and auto-pause
  const splitsRef = useRef<number[]>([])
  const lastSplitElapsed = useRef(0)
  const routeRef = useRef<[number, number][]>([])
  const lastRoutePoint = useRef<{ lat: number; lng: number } | null>(null)
  const lastMovementAt = useRef<number>(Date.now())
  const autoPaused = useRef(false)
  const gpsActive = useRef(false)

  // Voice coaching — announce every full km; preference persists
  const [voiceOn, setVoiceOn] = useState(true)
  const voiceRef = useRef(true)
  const lastKmAnnounced = useRef(0)
  const elapsedRef = useRef(0)
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('pace-voice') : null
    if (saved !== null) { setVoiceOn(saved === '1'); voiceRef.current = saved === '1' }
  }, [])
  useEffect(() => { voiceRef.current = voiceOn }, [voiceOn])
  useEffect(() => { elapsedRef.current = elapsed }, [elapsed])

  useEffect(() => {
    const km = Math.floor(distanceM / 1000)
    if (km >= 1 && km > lastKmAnnounced.current) {
      lastKmAnnounced.current = km
      const el = elapsedRef.current
      // Record the split for this km
      splitsRef.current.push(el - lastSplitElapsed.current)
      lastSplitElapsed.current = el
      if (voiceRef.current) {
        const avg = distanceM > 50 ? Math.round(el / (distanceM / 1000)) : null
        const mins = Math.floor(el / 60)
        speak(`Kilometr ${km}. Czas ${mins} ${mins === 1 ? 'minuta' : 'minut'}. Średnie tempo ${spokenPace(avg)} na kilometr.`)
      }
    }
  }, [distanceM])

  useEffect(() => { runningRef.current = running }, [running])

  // Timer: count elapsed seconds only while running; auto-pause after 12s
  // without GPS movement (resumed automatically when movement returns).
  useEffect(() => {
    timer.current = setInterval(() => {
      if (runningRef.current) {
        setElapsed(e => e + 1)
        if (gpsActive.current && Date.now() - lastMovementAt.current > 12_000) {
          autoPaused.current = true
          setRunning(false)
          speak('Auto-pauza')
        }
      }
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
        if (!prev) { lastMovementAt.current = Date.now(); gpsActive.current = true; return }

        const seg = haversine(prev, { lat, lng })
        const dt = (t - prev.t) / 1000
        if (dt <= 0) return
        const speed = seg / dt // m/s
        if (speed > 12) return // >43 km/h — GPS jump, discard

        gpsActive.current = true

        // Movement tracking (also while paused — drives auto-resume)
        if (seg >= 3) {
          lastMovementAt.current = Date.now()
          if (autoPaused.current && !runningRef.current) {
            autoPaused.current = false
            setRunning(true)
            speak('Wznawiam')
          }
        }

        if (!runningRef.current) return

        if (seg >= 1) {
          distanceRef.current += seg
          setDistanceM(distanceRef.current)
          setCurPace(seg > 0 ? Math.round((dt / seg) * 1000) : null)

          // Route capture: a point every ≥15 m, capped to keep payload small
          const lp = lastRoutePoint.current
          if (!lp || haversine(lp, { lat, lng }) >= 15) {
            if (routeRef.current.length < 2000) {
              routeRef.current.push([Number(lat.toFixed(5)), Number(lng.toFixed(5))])
              lastRoutePoint.current = { lat, lng }
            }
          }
        }
      },
      () => setPhase('denied'),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 },
    )

    return () => { if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current) }
  }, [])

  const distKm = distanceM / 1000
  const avgPace = distKm > 0.05 ? Math.round(elapsed / distKm) : null

  const [summary, setSummary] = useState<RunSummary | null>(null)

  async function stopAndSave() {
    if (timer.current) clearInterval(timer.current)
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
    setRunning(false)
    setPhase('saving')

    // Nothing meaningful recorded → just leave without saving
    if (distanceM < 100 || elapsed < 5) { router.push('/dashboard'); return }

    let comment: string | null = null
    let workoutTitle: string | null = null
    try {
      const res = await fetch('/api/run/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          distance_m: Math.round(distanceM),
          moving_time_s: elapsed,
          elapsed_time_s: elapsed,
          avg_pace_s_per_km: avgPace,
          start_date: startIso.current || new Date().toISOString(),
          splits: splitsRef.current,
          route: routeRef.current,
          avg_heartrate: hrStats.current.n > 0 ? Math.round(hrStats.current.sum / hrStats.current.n) : null,
          max_heartrate: hrStats.current.max > 0 ? hrStats.current.max : null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      comment = data?.comment ?? null
      workoutTitle = data?.workout_title ?? null
    } catch { /* saved-run failure shouldn't trap the user on this screen */ }

    setSummary({ distanceM, elapsed, avgPace, comment, workoutTitle, splits: splitsRef.current })
    setPhase('done')
  }

  if (phase === 'done' && summary) {
    const sumKm = summary.distanceM / 1000
    const shareData: ShareCardData = {
      title: summary.workoutTitle ?? 'Bieg PACE',
      typeLabel: 'Bieg',
      emoji: '🏃',
      distanceText: sumKm.toFixed(2),
      pace: fmtPace(summary.avgPace),
      duration: fmtTime(summary.elapsed),
      heartrate: null,
      maxHeartrate: null,
      elevation: null,
      dateLabel: new Date().toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' }),
      weekLabel: null,
      accentColor: '#00e676',
      fromStrava: false,
    }
    return (
      <div style={{ ...overlay, overflowY: 'auto' }}>
        <div className="kick text-center" style={{ fontSize: 11, color: 'var(--green)', marginTop: 8 }}>
          🏁 Bieg zakończony
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: 260 }}>
          <div className="flex items-baseline" style={{ gap: 6 }}>
            <span className="cond" style={{ fontSize: 76, color: 'var(--green)' }}>{sumKm.toFixed(2)}</span>
            <span className="cond" style={{ fontSize: 26, color: 'var(--text-2)' }}>km</span>
          </div>
          <div className="flex" style={{ gap: 28, marginTop: 18 }}>
            <div className="text-center">
              <div className="kick" style={{ fontSize: 9, color: 'var(--text-3)' }}>Czas</div>
              <div className="cond" style={{ fontSize: 30, marginTop: 3 }}>{fmtTime(summary.elapsed)}</div>
            </div>
            <div className="text-center">
              <div className="kick" style={{ fontSize: 9, color: 'var(--text-3)' }}>Śr. tempo</div>
              <div className="cond" style={{ fontSize: 30, marginTop: 3 }}>{fmtPace(summary.avgPace)}<span style={{ fontSize: 14 }}>/km</span></div>
            </div>
          </div>
          {summary.workoutTitle && (
            <div style={{ marginTop: 16, font: '700 12px var(--font-barlow)', color: 'var(--green)', background: 'var(--green-dim)', borderRadius: 20, padding: '6px 14px' }}>
              ✓ Zaliczony: {summary.workoutTitle}
            </div>
          )}
        </div>

        {routeRef.current.length >= 2 && (
          <div style={{ borderRadius: 18, background: 'var(--surface)', border: '1px solid var(--border)', padding: '8px 4px', marginBottom: 14 }}>
            <RouteMap points={routeRef.current} />
          </div>
        )}

        {summary.splits.length > 0 && (
          <div style={{ borderRadius: 18, background: 'var(--surface)', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 14 }}>
            <div className="kick" style={{ fontSize: 9, color: 'var(--text-3)', padding: '12px 16px 4px' }}>Międzyczasy</div>
            {summary.splits.map((s, i) => {
              const best = Math.min(...summary.splits)
              return (
                <div key={i} className="flex items-center justify-between"
                  style={{ padding: '9px 16px', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ font: '600 13px var(--font-barlow)', color: 'var(--text-2)' }}>{i + 1} km</span>
                  <span className="cond" style={{ fontSize: 17, color: s === best ? 'var(--green)' : 'var(--text)' }}>
                    {fmtPace(s)}{s === best ? ' ⚡' : ''}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {summary.comment && (
          <div style={{ borderRadius: 18, padding: '14px 16px', background: 'var(--green-dim)', border: '1px solid rgba(0,230,118,.25)', marginBottom: 14 }}>
            <div className="kick" style={{ fontSize: 9, color: 'var(--green)', marginBottom: 6 }}>🤖 PACE AI</div>
            <p style={{ font: '400 13px/1.5 var(--font-barlow)', color: 'var(--text-2)', margin: 0 }}>{summary.comment}</p>
          </div>
        )}

        <div className="flex flex-col" style={{ gap: 10 }}>
          <ShareWorkoutButton data={shareData} />
          <button onClick={() => router.push('/dashboard')} className="press" style={{
            width: '100%', borderRadius: 16, padding: 15, background: 'var(--green)', color: '#000',
            font: '800 15px var(--font-barlow-condensed)', letterSpacing: 1.5, textTransform: 'uppercase', border: 'none',
          }}>Wróć do Dziś</button>
        </div>
      </div>
    )
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
        <button
          onClick={() => {
            const next = !voiceOn
            setVoiceOn(next)
            try { localStorage.setItem('pace-voice', next ? '1' : '0') } catch { /* ignore */ }
            if (next) speak('Komunikaty głosowe włączone')
          }}
          className="press"
          aria-label={voiceOn ? 'Wyłącz komunikaty głosowe' : 'Włącz komunikaty głosowe'}
          style={{ background: 'none', border: 'none', fontSize: 18, color: voiceOn ? 'var(--green)' : 'var(--text-3)' }}>
          {voiceOn ? '🔊' : '🔇'}
        </button>
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
        {hr !== null ? (
          <div style={{
            flex: 1, textAlign: 'center', borderRadius: 18, padding: '14px 10px',
            background: 'rgba(255,109,0,.1)', border: '1px solid rgba(255,109,0,.25)',
          }}>
            <div className="kick" style={{ fontSize: 9, color: 'var(--text-3)' }}>Tętno</div>
            <div className="cond" style={{ fontSize: 28, marginTop: 3, color: 'var(--orange)' }}>{hr}</div>
            <div style={{ font: '600 9px var(--font-barlow)', color: 'var(--text-3)' }}>bpm</div>
          </div>
        ) : hrSupported ? (
          <button onClick={connectHr} className="press" style={{
            flex: 1, borderRadius: 18, padding: '14px 6px', textAlign: 'center',
            background: 'rgba(255,255,255,.05)', border: '1px dashed rgba(255,255,255,.2)', color: 'var(--text-2)',
          }}>
            <div style={{ fontSize: 18 }}>🫀</div>
            <div style={{ font: '600 10px var(--font-barlow)', marginTop: 4 }}>Połącz pas HR</div>
          </button>
        ) : (
          <Metric label="Dystans" value={distKm.toFixed(2)} sub="km" accent />
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center" style={{ gap: 28 }}>
        <button className="press flex items-center justify-center" onClick={stopAndSave} aria-label="Zakończ"
          disabled={phase === 'saving'}
          style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--surface2)', border: '1px solid rgba(255,255,255,.12)', color: 'var(--text)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="3" /></svg>
        </button>
        <button className="press flex items-center justify-center"
          onClick={() => {
            autoPaused.current = false
            lastMovementAt.current = Date.now()
            setRunning(r => !r)
          }}
          aria-label={running ? 'Pauza' : 'Wznów'}
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
