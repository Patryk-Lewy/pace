'use client'

import { useEffect, useState } from 'react'

const DISMISS_KEY = 'pace-recap-dismissed'

export default function WeeklyRecapCard({ id, content }: { id: string; content: string }) {
  // Start hidden to avoid a flash for already-dismissed cards
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      setVisible(localStorage.getItem(DISMISS_KEY) !== id)
    } catch {
      setVisible(true)
    }
  }, [id])

  if (!visible) return null

  return (
    <div style={{ borderRadius: 18, padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 12, position: 'relative' }}>
      <button
        onClick={() => {
          try { localStorage.setItem(DISMISS_KEY, id) } catch { /* ignore */ }
          setVisible(false)
        }}
        aria-label="Zamknij podsumowanie"
        className="press"
        style={{ position: 'absolute', top: 10, right: 12, background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 14 }}>
        ✕
      </button>
      <div className="kick" style={{ fontSize: 9, color: 'var(--green)', marginBottom: 6 }}>📊 Podsumowanie tygodnia · PACE AI</div>
      <p style={{ font: '400 13px/1.5 var(--font-barlow)', color: 'var(--text-2)', margin: 0, paddingRight: 16 }}>{content}</p>
    </div>
  )
}
