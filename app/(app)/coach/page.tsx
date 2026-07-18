'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

type Msg = { role: 'user' | 'assistant'; content: string }

const STORAGE_KEY = 'pace-coach-chat'

const STARTERS = [
  'Jak wygląda mój najbliższy tydzień?',
  'Czuję zmęczenie — co z jutrzejszym treningiem?',
  'Czy zdążę z formą na zawody?',
]

export default function CoachPage() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Restore conversation within the session
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY)
      if (saved) setMessages(JSON.parse(saved))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages)) } catch { /* ignore */ }
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(text: string) {
    const content = text.trim()
    if (!content || busy) return
    setError(null)
    setInput('')
    const next: Msg[] = [...messages, { role: 'user', content }]
    setMessages(next)
    setBusy(true)
    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.reply) throw new Error(data.error ?? 'Błąd')
      setMessages(m => [...m, { role: 'assistant', content: data.reply }])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Trener chwilowo niedostępny')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', paddingBottom: 16 }}>
      {/* Header */}
      <Link href="/dashboard" className="press flex items-center"
        style={{ gap: 8, padding: '16px 0 6px', font: '600 13px var(--font-barlow)', color: 'var(--text-2)', textDecoration: 'none' }}>
        <span style={{ fontSize: 18 }}>‹</span> Dziś
      </Link>
      <div className="flex items-center justify-between" style={{ paddingBottom: 12 }}>
        <div>
          <div className="cond" style={{ fontSize: 30 }}>Trener PACE</div>
          <div style={{ font: '500 12px var(--font-barlow)', color: 'var(--text-3)' }}>Zna Twój plan i ostatnie biegi</div>
        </div>
        {messages.length > 0 && (
          <button onClick={() => { setMessages([]); setError(null) }} className="press"
            style={{ font: '600 12px var(--font-barlow)', color: 'var(--text-3)', background: 'none', border: 'none' }}>
            Wyczyść
          </button>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            <div style={{ font: '500 13px var(--font-barlow)', color: 'var(--text-2)', marginBottom: 4 }}>
              💬 Zapytaj o trening, plan, formę albo samopoczucie:
            </div>
            {STARTERS.map(s => (
              <button key={s} onClick={() => send(s)} className="press text-left"
                style={{ borderRadius: 14, padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)', font: '500 13px var(--font-barlow)', color: 'var(--text)' }}>
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '85%',
            borderRadius: 16,
            padding: '10px 14px',
            background: m.role === 'user' ? 'var(--green)' : 'var(--surface)',
            border: m.role === 'user' ? 'none' : '1px solid var(--border)',
            color: m.role === 'user' ? '#000' : 'var(--text)',
            font: '400 14px/1.5 var(--font-barlow)',
            whiteSpace: 'pre-wrap',
          }}>
            {m.content}
          </div>
        ))}

        {busy && (
          <div style={{ alignSelf: 'flex-start', borderRadius: 16, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-3)', font: '400 14px var(--font-barlow)' }}>
            <span className="livedot">Trener pisze…</span>
          </div>
        )}
        {error && (
          <div style={{ alignSelf: 'flex-start', borderRadius: 14, padding: '10px 14px', background: 'var(--orange-dim)', color: 'var(--orange)', font: '500 13px var(--font-barlow)' }}>
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={e => { e.preventDefault(); send(input) }}
        className="flex" style={{ gap: 8, marginTop: 14, position: 'sticky', bottom: 12 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Napisz do trenera…"
          maxLength={2000}
          style={{
            flex: 1, borderRadius: 16, padding: '13px 16px', background: 'var(--surface)',
            border: '1px solid var(--border)', color: 'var(--text)', font: '400 14px var(--font-barlow)', outline: 'none',
          }}
        />
        <button type="submit" disabled={busy || !input.trim()} className="press flex items-center justify-center"
          style={{
            width: 48, height: 48, borderRadius: '50%', border: 'none', flexShrink: 0,
            background: busy || !input.trim() ? 'var(--surface3)' : 'var(--green)',
            color: busy || !input.trim() ? 'var(--text-3)' : '#000',
          }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 20v-6l8-2-8-2V4l19 8z" /></svg>
        </button>
      </form>
    </div>
  )
}
