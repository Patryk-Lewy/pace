import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>

      {/* ── Nav ── */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto">
        <span
          className="text-2xl font-black tracking-widest uppercase"
          style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif', color: 'var(--green)' }}
        >
          PACE
        </span>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-semibold px-4 py-2 rounded-xl transition-all hover:opacity-70"
            style={{ color: 'var(--text-2)' }}
          >
            Zaloguj się
          </Link>
          <Link
            href="/register"
            className="text-sm font-black uppercase tracking-widest px-5 py-2.5 rounded-xl transition-all hover:-translate-y-0.5"
            style={{
              fontFamily: 'var(--font-barlow-condensed), sans-serif',
              background: 'var(--green)',
              color: '#000',
            }}
          >
            Zacznij za darmo
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-24 text-center">
        <div
          className="inline-block text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full mb-6"
          style={{ background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid rgba(0,230,118,0.3)' }}
        >
          Powered by Claude AI
        </div>

        <h1
          className="text-6xl sm:text-8xl font-black mb-6 leading-none"
          style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif' }}
        >
          Trenuj mądrzej.<br />
          <span style={{ color: 'var(--green)' }}>Biegaj szybciej.</span>
        </h1>

        <p className="text-lg max-w-xl mx-auto mb-10" style={{ color: 'var(--text-2)' }}>
          PACE to AI trener biegowy, który analizuje Twoje rekordy, dane ze Stravy i historię
          treningów — i buduje plan, który naprawdę pasuje do Twojego życia.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/register"
            className="text-base font-black uppercase tracking-widest px-8 py-4 rounded-2xl transition-all hover:-translate-y-1 hover:shadow-lg"
            style={{
              fontFamily: 'var(--font-barlow-condensed), sans-serif',
              background: 'var(--green)',
              color: '#000',
            }}
          >
            Zbuduj swój plan →
          </Link>
          <Link
            href="/login"
            className="text-base font-semibold px-8 py-4 rounded-2xl transition-all hover:opacity-80"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-2)',
            }}
          >
            Mam już konto
          </Link>
        </div>

        <p className="text-xs mt-4" style={{ color: 'var(--text-3)' }}>
          Bezpłatnie · Bez karty kredytowej · Gotowy plan w 3 minuty
        </p>
      </section>

      {/* ── Features ── */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <p
          className="text-xs font-semibold uppercase tracking-widest text-center mb-10"
          style={{ color: 'var(--text-3)' }}
        >
          Co dostaniesz
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              emoji: '🤖',
              title: 'Plan generowany przez AI',
              desc: 'Claude Sonnet analizuje Twoje rekordy życiowe (VDOT), dostępność i historię kontuzji — i układa plan tydzień po tygodniu.',
            },
            {
              emoji: '📊',
              title: 'Analiza każdego biegu',
              desc: 'Po połączeniu ze Stravą PACE automatycznie pobiera aktywności, porównuje z planem i komentuje wyniki przez Claude AI.',
            },
            {
              emoji: '🔄',
              title: 'Adaptacja planu',
              desc: 'Jeśli konsekwentnie biegasz szybciej lub wolniej niż plan — AI to wyłapuje i proponuje korektę temp treningowych.',
            },
            {
              emoji: '❤️',
              title: 'Strefy tętna',
              desc: 'Automatyczne obliczanie stref Z1–Z5 z danych Strava. Porównanie planowanej strefy z wykonaną po każdym treningu.',
            },
            {
              emoji: '🔔',
              title: 'Przypomnienia push',
              desc: 'Powiadomienie push każdego dnia treningowego o 8:00 — z nazwą treningu, dystansem i docelowym tempem.',
            },
            {
              emoji: '⌚',
              title: 'Eksport do Garmina',
              desc: 'Każdy trening eksportujesz jako plik .TCX z targetami tempa — i wgrywasz bezpośrednio na zegarek Garmin.',
            },
            {
              emoji: '🏁',
              title: 'Strategia startowa',
              desc: 'Plan tempa na dzień zawodów — kilometr po kilometrze. Wybierz strategię even split, negative split lub progresywną i wyjdź na start z konkretnym planem.',
            },
          ].map(f => (
            <div
              key={f.title}
              className="rounded-2xl p-6"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div className="text-3xl mb-3">{f.emoji}</div>
              <h3
                className="text-xl font-black mb-2"
                style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif' }}
              >
                {f.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section
        className="py-20"
        style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="max-w-5xl mx-auto px-6">
          <p
            className="text-xs font-semibold uppercase tracking-widest text-center mb-12"
            style={{ color: 'var(--text-3)' }}
          >
            Jak to działa
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Uzupełnij profil',
                desc: 'Podaj swoje rekordy życiowe, dostępność i cel. Zajmie Ci to 2 minuty.',
              },
              {
                step: '02',
                title: 'Claude buduje plan',
                desc: 'AI analizuje dane metodą VDOT i generuje spersonalizowany plan na 8–16 tygodni.',
              },
              {
                step: '03',
                title: 'Trenuj i śledź postępy',
                desc: 'Połącz Stravę. Po każdym biegu dostajesz analizę AI i automatyczną adaptację planu.',
              },
            ].map(s => (
              <div key={s.step} className="text-center">
                <div
                  className="text-5xl font-black mb-4"
                  style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif', color: 'var(--green)' }}
                >
                  {s.step}
                </div>
                <h3
                  className="text-xl font-black mb-2"
                  style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif' }}
                >
                  {s.title}
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="max-w-5xl mx-auto px-6 py-24 text-center">
        <h2
          className="text-5xl sm:text-7xl font-black mb-4"
          style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif' }}
        >
          Gotowy na<br />
          <span style={{ color: 'var(--green)' }}>nowy poziom?</span>
        </h2>
        <p className="text-base mb-8" style={{ color: 'var(--text-2)' }}>
          Zarejestruj się bezpłatnie i w 3 minuty masz gotowy plan treningowy.
        </p>
        <Link
          href="/register"
          className="inline-block text-base font-black uppercase tracking-widest px-10 py-4 rounded-2xl transition-all hover:-translate-y-1"
          style={{
            fontFamily: 'var(--font-barlow-condensed), sans-serif',
            background: 'var(--green)',
            color: '#000',
          }}
        >
          Zacznij za darmo →
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer
        className="border-t px-6 py-8"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <span
            className="text-sm font-black tracking-widest uppercase"
            style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif', color: 'var(--green)' }}
          >
            PACE
          </span>
          <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-3)' }}>
            <Link href="/privacy" className="hover:underline" style={{ color: 'var(--text-2)' }}>
              Polityka prywatności
            </Link>
            <span>·</span>
            <span>AI trener biegowy · Powered by Claude</span>
          </div>
        </div>
      </footer>

    </div>
  )
}
