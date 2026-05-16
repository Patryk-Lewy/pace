'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AdaptationResult } from '@/lib/plan-adaptation'

interface Props {
  commentId: string
  result: AdaptationResult
}

export default function AdaptationBanner({ commentId, result }: Props) {
  const router = useRouter()
  const [status, setStatus] = useState<'idle' | 'applying' | 'dismissing' | 'done'>('idle')

  async function act(action: 'apply' | 'dismiss') {
    setStatus(action === 'apply' ? 'applying' : 'dismissing')
    try {
      await fetch('/api/plan/adapt', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId, action }),
      })
    } catch (err) {
      console.error('[AdaptationBanner]', err)
    }
    setStatus('done')
    router.refresh()
  }

  if (status === 'done') return null

  const dirLabel =
    result.action === 'adjust_pace' && result.pace_adjustment_seconds !== undefined
      ? result.pace_adjustment_seconds < 0
        ? `Zwiększa intensywność o ${Math.abs(result.pace_adjustment_seconds)}s/km`
        : `Zmniejsza intensywność o ${result.pace_adjustment_seconds}s/km`
      : null

  return (
    <div
      className="rounded-2xl p-5 mb-4 flex flex-col gap-3"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--green)',
      }}
    >
      <div className="flex items-start gap-3">
        <span className="text-xl shrink-0">🤖</span>
        <div className="flex-1 min-w-0">
          <p
            className="text-xs font-semibold uppercase tracking-widest mb-1"
            style={{ color: 'var(--green)' }}
          >
            PACE sugeruje korektę planu
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-1)' }}>
            {result.suggestion}
          </p>
          {dirLabel && (
            <p className="text-xs mt-1 font-semibold" style={{ color: 'var(--text-3)' }}>
              → {dirLabel}
            </p>
          )}
        </div>
      </div>

      {result.action === 'adjust_pace' && (
        <div className="flex gap-2">
          <button
            onClick={() => act('apply')}
            disabled={status !== 'idle'}
            className="flex-1 rounded-xl py-2 text-xs font-black uppercase tracking-widest transition-all hover:opacity-90"
            style={{ background: 'var(--green)', color: '#000' }}
          >
            {status === 'applying' ? '⏳ Stosuję...' : '✓ Zastosuj'}
          </button>
          <button
            onClick={() => act('dismiss')}
            disabled={status !== 'idle'}
            className="rounded-xl px-4 py-2 text-xs font-bold transition-all hover:opacity-70"
            style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-3)' }}
          >
            {status === 'dismissing' ? '...' : 'Odrzuć'}
          </button>
        </div>
      )}

      {result.action === 'regenerate_week' && (
        <div className="flex gap-2">
          <a
            href="/plan"
            className="flex-1 rounded-xl py-2 text-xs font-black uppercase tracking-widest text-center transition-all hover:opacity-90"
            style={{ background: 'var(--green)', color: '#000', display: 'block' }}
          >
            Regeneruj plan →
          </a>
          <button
            onClick={() => act('dismiss')}
            disabled={status !== 'idle'}
            className="rounded-xl px-4 py-2 text-xs font-bold transition-all hover:opacity-70"
            style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-3)' }}
          >
            Odrzuć
          </button>
        </div>
      )}
    </div>
  )
}
