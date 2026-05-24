import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6"
      style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="text-center max-w-md">
        <p className="text-8xl font-black mb-2"
          style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif', color: 'var(--green)' }}>
          404
        </p>
        <h1 className="text-3xl font-black mb-3"
          style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif' }}>
          Nie znaleziono strony
        </h1>
        <p className="text-sm mb-8" style={{ color: 'var(--text-2)' }}>
          Ta strona nie istnieje lub została przeniesiona.
        </p>
        <Link href="/dashboard"
          className="inline-block rounded-xl px-8 py-3 text-sm font-black uppercase tracking-widest transition-all hover:-translate-y-0.5"
          style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif', background: 'var(--green)', color: '#000' }}>
          Wróć do dashboardu →
        </Link>
      </div>
    </div>
  )
}
