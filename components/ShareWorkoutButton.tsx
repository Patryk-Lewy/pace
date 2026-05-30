'use client'

import { useState } from 'react'

export type ShareCardData = {
  title: string
  typeLabel: string
  emoji: string
  distanceText: string      // e.g. "10.24"
  pace: string | null       // e.g. "5:12"
  duration: string | null   // e.g. "52:30"
  rpe: number | null
  heartrate: number | null
  dateLabel: string         // e.g. "28 maja 2026"
  weekLabel: string | null  // e.g. "Tydzień 4"
  accentColor: string       // hex, e.g. "#00e676"
  fromStrava: boolean
}

// Brand palette (canvas needs literal hex, not CSS vars)
const BG = '#0a0a0a'
const GREEN = '#00e676'
const WHITE = '#ffffff'
const MUTED = '#8a8a8a'
const STRAVA = '#fc4c02'

const CARD_W = 1080
const CARD_H = 1920

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function drawSpaced(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, spacing: number) {
  const widths = [...text].map(ch => ctx.measureText(ch).width)
  const total = widths.reduce((s, w) => s + w, 0) + spacing * (text.length - 1)
  let x = cx - total / 2
  ctx.textAlign = 'left'
  for (let i = 0; i < text.length; i++) {
    ctx.fillText(text[i], x, y)
    x += widths[i] + spacing
  }
  ctx.textAlign = 'center'
}

function drawCard(ctx: CanvasRenderingContext2D, d: ShareCardData) {
  // Background
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, CARD_W, CARD_H)

  // Accent radial glow behind the hero number
  const glow = ctx.createRadialGradient(CARD_W / 2, 830, 60, CARD_W / 2, 830, 620)
  glow.addColorStop(0, `${d.accentColor}26`) // ~15% alpha
  glow.addColorStop(1, `${d.accentColor}00`)
  ctx.fillStyle = glow
  ctx.fillRect(0, 200, CARD_W, 1100)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  // PACE wordmark
  ctx.fillStyle = GREEN
  ctx.font = '900 70px "Arial Black", Impact, sans-serif'
  drawSpaced(ctx, 'PACE', CARD_W / 2, 180, 14)

  // Type pill
  const pillText = `${d.emoji}  ${d.typeLabel.toUpperCase()}`
  ctx.font = '700 38px Arial, sans-serif'
  const pillW = ctx.measureText(pillText).width + 80
  const pillH = 84
  const pillX = CARD_W / 2 - pillW / 2
  const pillY = 268
  ctx.fillStyle = '#1a1a1a'
  roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2)
  ctx.fill()
  ctx.strokeStyle = '#2a2a2a'
  ctx.lineWidth = 2
  roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2)
  ctx.stroke()
  ctx.fillStyle = d.accentColor
  ctx.textBaseline = 'middle'
  ctx.fillText(pillText, CARD_W / 2, pillY + pillH / 2 + 4)
  ctx.textBaseline = 'alphabetic'

  // Hero distance number
  ctx.fillStyle = WHITE
  ctx.font = '900 380px "Arial Black", Impact, sans-serif'
  ctx.fillText(d.distanceText, CARD_W / 2, 880)

  // KM label
  ctx.fillStyle = d.accentColor
  ctx.font = '900 90px "Arial Black", Impact, sans-serif'
  drawSpaced(ctx, 'KM', CARD_W / 2, 1010, 10)

  // Stats row — pick up to 3
  type Stat = { label: string; value: string }
  const stats: Stat[] = []
  if (d.pace) stats.push({ label: 'TEMPO', value: `${d.pace}/km` })
  if (d.duration) stats.push({ label: 'CZAS', value: d.duration })
  if (d.rpe !== null) stats.push({ label: 'WYSIŁEK', value: `${d.rpe}/10` })
  else if (d.heartrate) stats.push({ label: 'TĘTNO', value: `${d.heartrate}` })
  const shown = stats.slice(0, 3)

  // Divider
  ctx.strokeStyle = '#222222'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(120, 1180)
  ctx.lineTo(CARD_W - 120, 1180)
  ctx.stroke()

  const rowY = 1320
  const colW = (CARD_W - 240) / shown.length
  shown.forEach((s, i) => {
    const cx = 120 + colW * i + colW / 2
    ctx.fillStyle = MUTED
    ctx.font = '700 34px Arial, sans-serif'
    drawSpaced(ctx, s.label, cx, rowY - 30, 4)
    ctx.fillStyle = WHITE
    ctx.font = '900 90px "Arial Black", Impact, sans-serif'
    ctx.fillText(s.value, cx, rowY + 70)
  })

  // Divider
  ctx.beginPath()
  ctx.moveTo(120, 1480)
  ctx.lineTo(CARD_W - 120, 1480)
  ctx.stroke()

  // Workout title
  ctx.fillStyle = WHITE
  ctx.font = '700 56px Arial, sans-serif'
  ctx.fillText(truncate(ctx, d.title, CARD_W - 160), CARD_W / 2, 1600)

  // Week + date meta
  ctx.fillStyle = MUTED
  ctx.font = '400 38px Arial, sans-serif'
  const meta = [d.weekLabel, d.dateLabel].filter(Boolean).join('  ·  ')
  ctx.fillText(meta, CARD_W / 2, 1670)

  // Footer: powered by strava (if applicable) + url
  let footerY = 1800
  if (d.fromStrava) {
    ctx.fillStyle = STRAVA
    ctx.font = '700 34px Arial, sans-serif'
    ctx.fillText('⚡ Powered by Strava', CARD_W / 2, footerY)
    footerY += 56
  }
  ctx.fillStyle = GREEN
  ctx.font = '700 36px Arial, sans-serif'
  drawSpaced(ctx, 'PACE-MUREX.VERCEL.APP', CARD_W / 2, footerY, 4)
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text
  let t = text
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1)
  return t + '…'
}

export default function ShareWorkoutButton({ data }: { data: ShareCardData }) {
  const [open, setOpen] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [generating, setGenerating] = useState(false)

  async function generate() {
    setGenerating(true)
    const canvas = document.createElement('canvas')
    canvas.width = CARD_W
    canvas.height = CARD_H
    const ctx = canvas.getContext('2d')
    if (!ctx) { setGenerating(false); return }

    drawCard(ctx, data)

    canvas.toBlob(b => {
      if (b) {
        setBlob(b)
        setImageUrl(URL.createObjectURL(b))
        setOpen(true)
      }
      setGenerating(false)
    }, 'image/png')
  }

  async function share() {
    if (!blob) return
    const file = new File([blob], 'pace-trening.png', { type: 'image/png' })
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Mój trening w PACE 🏃' })
      } else {
        download()
      }
    } catch (err) {
      // User cancelled share sheet — ignore AbortError
      if ((err as Error)?.name !== 'AbortError') download()
    }
  }

  function download() {
    if (!imageUrl) return
    const a = document.createElement('a')
    a.href = imageUrl
    a.download = 'pace-trening.png'
    a.click()
  }

  function close() {
    setOpen(false)
    if (imageUrl) URL.revokeObjectURL(imageUrl)
    setImageUrl(null)
    setBlob(null)
  }

  return (
    <>
      <button onClick={generate} disabled={generating}
        className="w-full rounded-xl py-3 text-sm font-semibold transition-all flex items-center justify-center gap-2"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
        {generating ? 'Generuję...' : '📸 Udostępnij wynik'}
      </button>

      {open && imageUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)' }}
          onClick={close}>
          <div className="w-full max-w-sm animate-fade-up flex flex-col items-center gap-4"
            onClick={e => e.stopPropagation()}>
            <img src={imageUrl} alt="Podgląd karty treningu"
              className="rounded-2xl w-full"
              style={{ border: '1px solid var(--border)', maxHeight: '70vh', objectFit: 'contain' }} />
            <div className="flex gap-3 w-full">
              <button onClick={close}
                className="flex-1 rounded-xl py-3 text-sm font-semibold transition-all"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                Zamknij
              </button>
              <button onClick={download}
                className="flex-1 rounded-xl py-3 text-sm font-semibold transition-all"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                ⬇ Pobierz
              </button>
              <button onClick={share}
                className="flex-1 rounded-xl py-3 text-sm font-black uppercase tracking-widest transition-all"
                style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif', background: 'var(--green)', color: '#000' }}>
                Udostępnij
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
