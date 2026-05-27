import Link from 'next/link'

export const metadata = {
  title: 'Polityka prywatności — PACE',
  description: 'Jak PACE chroni i wykorzystuje Twoje dane.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-3xl mx-auto">
        <Link
          href="/"
          className="text-2xl font-black tracking-widest uppercase"
          style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif', color: 'var(--green)' }}
        >
          PACE
        </Link>
        <div className="flex gap-4 text-sm items-center">
          <span style={{ color: 'var(--green)' }}>PL</span>
          <Link href="/privacy/en" style={{ color: 'var(--text-3)' }}>EN</Link>
          <Link
            href="/"
            className="font-semibold ml-2"
            style={{ color: 'var(--text-2)' }}
          >
            ← Strona główna
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 pb-24">
        <div className="mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--green)' }}>
            Polityka prywatności
          </p>
          <h1
            className="text-5xl sm:text-6xl font-black mb-4 leading-none"
            style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif' }}
          >
            Twoje dane,<br />Twoja kontrola.
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>
            Ostatnia aktualizacja: 27 maja 2026
          </p>
        </div>

        <div className="space-y-10">
          <Section title="1. Kto jest administratorem danych">
            <p>
              Administratorem Twoich danych osobowych jest <strong>Patryk Lewandowski</strong>,
              twórca aplikacji PACE.
            </p>
            <p>Kontakt: <a href="mailto:plewandowskkii@gmail.com" className="underline" style={{ color: 'var(--green)' }}>plewandowskkii@gmail.com</a></p>
          </Section>

          <Section title="2. Jakie dane zbieramy">
            <p className="mb-3">PACE zbiera tylko dane niezbędne do działania aplikacji:</p>
            <ul className="space-y-2 list-disc list-inside" style={{ color: 'var(--text-2)' }}>
              <li><strong>Dane konta:</strong> adres email i hasło (zaszyfrowane)</li>
              <li><strong>Profil biegacza:</strong> rekordy życiowe, dostępne dni treningowe, cel, historia kontuzji</li>
              <li><strong>Dane ze Strava (opcjonalnie):</strong> aktywności biegowe — dystans, czas, tempo, tętno, data, nazwa biegu</li>
              <li><strong>Powiadomienia push (opcjonalnie):</strong> klucz subskrypcji push przeglądarki</li>
              <li><strong>Dane techniczne:</strong> logi błędów aplikacji (bez danych osobowych)</li>
            </ul>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-3)' }}>
              Nie zbieramy lokalizacji GPS, danych biometrycznych poza tymi udostępnionymi przez Strava,
              ani danych z innych źródeł.
            </p>
          </Section>

          <Section title="3. Jak wykorzystujemy Twoje dane">
            <ul className="space-y-2 list-disc list-inside" style={{ color: 'var(--text-2)' }}>
              <li>Generowanie spersonalizowanego planu treningowego przez AI (Claude od Anthropic)</li>
              <li>Analiza Twoich biegów i porównanie z planem</li>
              <li>Adaptacja planu na podstawie wykonanych treningów</li>
              <li>Wysyłka przypomnień o treningach (jeśli włączysz)</li>
              <li>Tygodniowe podsumowania emailem (jeśli masz aktywny plan)</li>
              <li>Komunikacja transakcyjna (np. reset hasła, powitanie)</li>
            </ul>
            <p className="mt-3">
              <strong>Nie sprzedajemy Twoich danych.</strong> Nie używamy ich do reklam.
              Nie udostępniamy ich firmom trzecim w celach marketingowych.
            </p>
          </Section>

          <Section title="4. Komu udostępniamy dane">
            <p className="mb-3">Twoje dane są przetwarzane przez następujących dostawców usług (procesorów):</p>
            <ul className="space-y-3" style={{ color: 'var(--text-2)' }}>
              <li>
                <strong>Supabase</strong> (USA / UE) — baza danych i autoryzacja.{' '}
                <a href="https://supabase.com/privacy" target="_blank" rel="noreferrer" className="underline" style={{ color: 'var(--green)' }}>Polityka prywatności</a>
              </li>
              <li>
                <strong>Vercel</strong> (USA) — hosting aplikacji.{' '}
                <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noreferrer" className="underline" style={{ color: 'var(--green)' }}>Polityka prywatności</a>
              </li>
              <li>
                <strong>Anthropic</strong> (USA) — AI Claude do generowania planów i analizy.
                Wysyłamy zanonimizowane dane treningowe (bez emaila).{' '}
                <a href="https://www.anthropic.com/legal/privacy" target="_blank" rel="noreferrer" className="underline" style={{ color: 'var(--green)' }}>Polityka prywatności</a>
              </li>
              <li>
                <strong>Strava</strong> (USA) — wyłącznie odczyt Twoich aktywności po Twojej zgodzie OAuth.{' '}
                <a href="https://www.strava.com/legal/privacy" target="_blank" rel="noreferrer" className="underline" style={{ color: 'var(--green)' }}>Polityka prywatności</a>
              </li>
              <li>
                <strong>Resend</strong> (USA) — wysyłka emaili transakcyjnych.{' '}
                <a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noreferrer" className="underline" style={{ color: 'var(--green)' }}>Polityka prywatności</a>
              </li>
            </ul>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-3)' }}>
              Wszyscy procesorzy przestrzegają RODO i mają odpowiednie zabezpieczenia transferu danych
              do krajów spoza EOG (Standard Contractual Clauses).
            </p>
          </Section>

          <Section title="5. Twoje prawa (RODO)">
            <p className="mb-3">Masz prawo do:</p>
            <ul className="space-y-2 list-disc list-inside" style={{ color: 'var(--text-2)' }}>
              <li><strong>Dostępu</strong> do swoich danych — wszystkie są widoczne w aplikacji</li>
              <li><strong>Sprostowania</strong> — edytuj profil w zakładce „Ustawienia"</li>
              <li><strong>Usunięcia</strong> („prawo do bycia zapomnianym") — w ustawieniach lub przez email</li>
              <li><strong>Ograniczenia przetwarzania</strong> — np. odłączenie Stravy</li>
              <li><strong>Przenoszenia danych</strong> — eksport planu do TCX/PDF dostępny w aplikacji</li>
              <li><strong>Sprzeciwu</strong> — wyłącz powiadomienia w ustawieniach</li>
              <li><strong>Skargi do organu nadzorczego</strong> (UODO) — jeśli uważasz że łamiemy prawo</li>
            </ul>
            <p className="mt-3">
              Aby skorzystać z któregoś prawa, napisz na{' '}
              <a href="mailto:plewandowskkii@gmail.com" className="underline" style={{ color: 'var(--green)' }}>
                plewandowskkii@gmail.com
              </a>. Odpowiadamy w ciągu 30 dni.
            </p>
          </Section>

          <Section title="6. Jak długo przechowujemy dane">
            <ul className="space-y-2 list-disc list-inside" style={{ color: 'var(--text-2)' }}>
              <li>Konto i profil: <strong>do momentu usunięcia konta</strong></li>
              <li>Aktywności i plany: razem z kontem</li>
              <li>Tokeny Strava: do momentu odłączenia integracji</li>
              <li>Logi błędów: <strong>30 dni</strong></li>
            </ul>
          </Section>

          <Section title="7. Bezpieczeństwo">
            <ul className="space-y-2 list-disc list-inside" style={{ color: 'var(--text-2)' }}>
              <li>Wszystkie połączenia szyfrowane przez HTTPS/TLS</li>
              <li>Hasła hashowane jednokierunkowo (bcrypt)</li>
              <li>Tokeny OAuth zaszyfrowane w bazie</li>
              <li>Row Level Security (RLS) — każdy użytkownik widzi tylko swoje dane</li>
              <li>Regularne aktualizacje bibliotek i monitoring podatności</li>
            </ul>
          </Section>

          <Section title="8. Pliki cookie">
            <p>
              Używamy wyłącznie <strong>niezbędnych ciasteczek</strong> do utrzymania sesji
              zalogowanego użytkownika (Supabase Auth). Nie używamy żadnych ciasteczek
              marketingowych, analitycznych ani śledzących.
            </p>
          </Section>

          <Section title="9. Dzieci">
            <p>
              PACE nie jest przeznaczone dla osób poniżej 16 roku życia.
              Nie zbieramy świadomie danych dzieci. Jeśli dowiemy się że konto należy do osoby
              poniżej tego wieku, niezwłocznie je usuniemy.
            </p>
          </Section>

          <Section title="10. Zmiany polityki">
            <p>
              Możemy aktualizować tę politykę. O istotnych zmianach poinformujemy emailem
              z minimum 7-dniowym wyprzedzeniem. Aktualna wersja jest zawsze dostępna na{' '}
              <Link href="/privacy" className="underline" style={{ color: 'var(--green)' }}>
                pace-murex.vercel.app/privacy
              </Link>.
            </p>
          </Section>

          <Section title="11. Kontakt">
            <p>
              W sprawach związanych z danymi osobowymi pisz na:{' '}
              <a href="mailto:plewandowskkii@gmail.com" className="underline" style={{ color: 'var(--green)' }}>
                plewandowskkii@gmail.com
              </a>
            </p>
          </Section>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8" style={{ borderTop: '1px solid var(--border)' }}>
          <Link
            href="/"
            className="text-sm font-semibold"
            style={{ color: 'var(--green)' }}
          >
            ← Wróć na stronę główną
          </Link>
        </div>
      </main>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2
        className="text-2xl font-black mb-4"
        style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif' }}
      >
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
        {children}
      </div>
    </section>
  )
}
