'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Status = 'loading' | 'disconnected' | 'connected'

export default function GarminCard() {
  const [status, setStatus] = useState<Status>('loading')
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  async function load() {
    const supabase = createClient()
    const { data } = await supabase.from('garmin_tokens').select('last_sync').maybeSingle()
    if (data) { setStatus('connected'); setLastSync(data.last_sync) }
    else setStatus('disconnected')
  }
  useEffect(() => { load() }, [])

  async function connect() {
    if (!keyInput.trim()) return
    setBusy(true); setMsg(null)
    try {
      const res = await fetch('/api/garmin/connect', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: keyInput.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Błąd łączenia')
      setKeyInput(''); setShowForm(false)
      await load()
      setMsg({ text: 'Połączono z Garminem', ok: true })
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Błąd', ok: false })
    } finally { setBusy(false) }
  }

  async function sync() {
    setBusy(true); setMsg(null)
    try {
      const res = await fetch('/api/garmin/sync', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Błąd synchronizacji')
      await load()
      setMsg({ text: `Zsynchronizowano ${data.synced} ${data.synced === 1 ? 'bieg' : 'biegów'}`, ok: true })
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Błąd', ok: false })
    } finally { setBusy(false) }
  }

  async function disconnect() {
    setBusy(true); setMsg(null)
    await fetch('/api/garmin/disconnect', { method: 'POST' })
    setShowForm(false)
    await load()
    setBusy(false)
  }

  return (
    <div className="flex flex-col" style={{ gap: 10 }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base" style={{ background: 'var(--surface2)' }}>⌚</div>
          <div>
            <p className="text-sm font-semibold">Garmin</p>
            <p className="text-xs" style={{ color: status === 'connected' ? 'var(--green)' : 'var(--text-3)' }}>
              {status === 'connected' ? '● Połączony' : status === 'loading' ? '…' : '○ Niepołączony'}
            </p>
          </div>
        </div>

        {status === 'connected' ? (
          <div className="flex items-center" style={{ gap: 8 }}>
            <button onClick={sync} disabled={busy}
              className="rounded-xl px-4 py-2 text-xs font-bold"
              style={{ background: 'var(--green-dim)', border: '1px solid var(--green)', color: 'var(--green)' }}>
              {busy ? '…' : '⟳ Synchronizuj'}
            </button>
            <button onClick={disconnect} disabled={busy}
              className="rounded-xl px-3 py-2 text-xs font-semibold"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-3)' }}>
              Odłącz
            </button>
          </div>
        ) : status === 'disconnected' ? (
          <button onClick={() => { setShowForm(v => !v); setMsg(null) }}
            className="rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest"
            style={{ background: '#007CC3', color: '#fff', fontFamily: 'var(--font-barlow-condensed), sans-serif' }}>
            {showForm ? 'Anuluj' : 'Połącz'}
          </button>
        ) : null}
      </div>

      {status === 'connected' && lastSync && (
        <p className="text-xs" style={{ color: 'var(--text-3)' }}>
          Ostatnia synchronizacja: {new Date(lastSync).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </p>
      )}

      {status === 'disconnected' && showForm && (
        <div className="flex flex-col" style={{ gap: 8, padding: 12, borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-2)', lineHeight: 1.5 }}>
            W <b>Garmin Connect</b> (web) → ustawienia konta → <b>Personal API</b> → wygeneruj klucz i wklej go poniżej.
          </p>
          <input
            type="password"
            value={keyInput}
            onChange={e => setKeyInput(e.target.value)}
            placeholder="Klucz Garmin Personal API"
            autoComplete="off"
            style={{ borderRadius: 10, padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', font: '400 13px var(--font-barlow)' }}
          />
          <button onClick={connect} disabled={busy || !keyInput.trim()}
            className="rounded-xl py-2.5 text-xs font-black uppercase tracking-widest"
            style={{ background: busy || !keyInput.trim() ? 'var(--surface3)' : 'var(--green)', color: busy || !keyInput.trim() ? 'var(--text-3)' : '#000', border: 'none', fontFamily: 'var(--font-barlow-condensed), sans-serif' }}>
            {busy ? 'Łączę…' : 'Połącz z Garminem'}
          </button>
          <a href="https://connect.garmin.com" target="_blank" rel="noopener noreferrer"
            className="text-xs text-center" style={{ color: 'var(--text-3)' }}>
            Otwórz Garmin Connect →
          </a>
        </div>
      )}

      {msg && (
        <p className="text-xs" style={{ color: msg.ok ? 'var(--green)' : 'var(--orange)' }}>{msg.text}</p>
      )}
    </div>
  )
}
