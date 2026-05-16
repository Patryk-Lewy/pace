'use client'

import { useEffect, useState } from 'react'

type PermState = 'unsupported' | 'default' | 'granted' | 'denied'

async function subscribeToPush(): Promise<boolean> {
  try {
    const reg = await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()
    const sub = existing ?? await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
      ) as unknown as string,
    })

    const res = await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    })
    return res.ok
  } catch (err) {
    console.error('[PUSH] Subscribe error:', err)
    return false
  }
}

async function unsubscribeFromPush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return
    const endpoint = sub.endpoint
    await sub.unsubscribe()
    await fetch('/api/notifications/subscribe', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
    })
  } catch (err) {
    console.error('[PUSH] Unsubscribe error:', err)
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

export default function NotificationToggle() {
  const [perm, setPerm] = useState<PermState>('unsupported')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return
    setPerm(Notification.permission as PermState)
    // Register SW
    navigator.serviceWorker.register('/sw.js').catch(console.error)
  }, [])

  async function enable() {
    setLoading(true)
    const result = await Notification.requestPermission()
    setPerm(result as PermState)
    if (result === 'granted') {
      const ok = await subscribeToPush()
      if (ok) {
        // Confirm notification
        const reg = await navigator.serviceWorker.ready
        reg.showNotification('PACE — przypomnienia włączone! 🏃', {
          body: 'Będziesz dostawać powiadomienie każdego dnia treningowego o 8:00.',
          icon: '/favicon.ico',
          tag: 'pace-welcome',
        })
      }
    }
    setLoading(false)
  }

  async function disable() {
    setLoading(true)
    await unsubscribeFromPush()
    setPerm('default')
    setLoading(false)
  }

  if (perm === 'unsupported') return null

  if (perm === 'granted') {
    return (
      <button
        onClick={disable}
        disabled={loading}
        className="flex items-center gap-2 text-xs transition-all hover:opacity-70"
        style={{ color: 'var(--green)' }}
        title="Kliknij aby wyłączyć powiadomienia"
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--green)' }} />
        {loading ? 'Wyłączanie...' : 'Powiadomienia włączone'}
      </button>
    )
  }

  if (perm === 'denied') {
    return (
      <p className="text-xs" style={{ color: 'var(--text-3)' }}
        title="Odblokuj powiadomienia w ustawieniach przeglądarki">
        🔕 Powiadomienia zablokowane
      </p>
    )
  }

  return (
    <button
      onClick={enable}
      disabled={loading}
      className="rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all hover:-translate-y-0.5 hover:opacity-90"
      style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
    >
      {loading ? '⏳ Włączanie...' : '🔔 Włącz przypomnienia'}
    </button>
  )
}
