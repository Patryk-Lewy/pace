'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function StravaToast({ status }: { status: string }) {
  const router = useRouter()
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false)
      router.replace('/dashboard')
    }, 4000)
    return () => clearTimeout(t)
  }, [router])

  if (!visible) return null

  const isOk = status === 'connected'

  return (
    <div
      className="fixed top-6 right-6 z-50 rounded-2xl px-5 py-4 shadow-2xl animate-fade-up"
      style={{
        background: isOk ? 'var(--green-dim)' : 'var(--orange-dim)',
        border: `1px solid ${isOk ? 'var(--green)' : 'var(--orange)'}`,
        maxWidth: 320,
      }}
    >
      <p className="text-sm font-bold" style={{ color: isOk ? 'var(--green)' : 'var(--orange)' }}>
        {isOk ? '✓ Strava połączona!' : '✕ Błąd połączenia ze Stravą'}
      </p>
      <p className="text-xs mt-1" style={{ color: 'var(--text-2)' }}>
        {isOk
          ? 'Teraz możesz synchronizować swoje biegi i dostawać analizę AI.'
          : 'Spróbuj ponownie lub sprawdź ustawienia aplikacji Strava.'}
      </p>
    </div>
  )
}
