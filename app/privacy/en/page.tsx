import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy — PACE',
  description: 'How PACE protects and uses your data.',
}

export default function PrivacyEnPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <nav className="flex items-center justify-between px-6 py-5 max-w-3xl mx-auto">
        <Link
          href="/"
          className="text-2xl font-black tracking-widest uppercase"
          style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif', color: 'var(--green)' }}
        >
          PACE
        </Link>
        <div className="flex gap-4 text-sm">
          <Link href="/privacy" style={{ color: 'var(--text-3)' }}>PL</Link>
          <span style={{ color: 'var(--green)' }}>EN</span>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 pb-24">
        <div className="mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--green)' }}>
            Privacy Policy
          </p>
          <h1
            className="text-5xl sm:text-6xl font-black mb-4 leading-none"
            style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif' }}
          >
            Your data,<br />your control.
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>
            Last updated: May 27, 2026
          </p>
        </div>

        <div className="space-y-10">
          <Section title="1. Data Controller">
            <p>
              The data controller is <strong>Patryk Lewandowski</strong>, creator of PACE.
            </p>
            <p>Contact: <a href="mailto:plewandowskkii@gmail.com" className="underline" style={{ color: 'var(--green)' }}>plewandowskkii@gmail.com</a></p>
          </Section>

          <Section title="2. Data We Collect">
            <p className="mb-3">PACE only collects data necessary for the app to function:</p>
            <ul className="space-y-2 list-disc list-inside" style={{ color: 'var(--text-2)' }}>
              <li><strong>Account data:</strong> email address and password (hashed)</li>
              <li><strong>Runner profile:</strong> personal bests, available training days, goal, injury history</li>
              <li><strong>Strava data (optional):</strong> running activities — distance, time, pace, heart rate, date, name</li>
              <li><strong>Push notifications (optional):</strong> browser push subscription key</li>
              <li><strong>Technical data:</strong> application error logs (no personal data)</li>
            </ul>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-3)' }}>
              We do not collect GPS location, biometric data beyond what Strava provides,
              or data from any other sources.
            </p>
          </Section>

          <Section title="3. How We Use Your Data">
            <ul className="space-y-2 list-disc list-inside" style={{ color: 'var(--text-2)' }}>
              <li>Generate personalized training plans via AI (Claude by Anthropic)</li>
              <li>Analyze your runs and compare with planned workouts</li>
              <li>Adapt training plans based on completed workouts</li>
              <li>Send workout reminders (if enabled)</li>
              <li>Send weekly summaries via email (for users with active plans)</li>
              <li>Transactional communication (password reset, welcome emails)</li>
            </ul>
            <p className="mt-3">
              <strong>We do not sell your data.</strong> We do not use it for advertising.
              We do not share it with third parties for marketing purposes.
            </p>
          </Section>

          <Section title="4. Data Sharing">
            <p className="mb-3">Your data is processed by the following service providers (processors):</p>
            <ul className="space-y-3" style={{ color: 'var(--text-2)' }}>
              <li>
                <strong>Supabase</strong> (US / EU) — database and authentication.{' '}
                <a href="https://supabase.com/privacy" target="_blank" rel="noreferrer" className="underline" style={{ color: 'var(--green)' }}>Privacy Policy</a>
              </li>
              <li>
                <strong>Vercel</strong> (US) — application hosting.{' '}
                <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noreferrer" className="underline" style={{ color: 'var(--green)' }}>Privacy Policy</a>
              </li>
              <li>
                <strong>Anthropic</strong> (US) — Claude AI for plan generation and analysis.
                We send anonymized training data (no email).{' '}
                <a href="https://www.anthropic.com/legal/privacy" target="_blank" rel="noreferrer" className="underline" style={{ color: 'var(--green)' }}>Privacy Policy</a>
              </li>
              <li>
                <strong>Strava</strong> (US) — read-only access to your activities with your OAuth consent.{' '}
                <a href="https://www.strava.com/legal/privacy" target="_blank" rel="noreferrer" className="underline" style={{ color: 'var(--green)' }}>Privacy Policy</a>
              </li>
              <li>
                <strong>Resend</strong> (US) — transactional email delivery.{' '}
                <a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noreferrer" className="underline" style={{ color: 'var(--green)' }}>Privacy Policy</a>
              </li>
            </ul>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-3)' }}>
              All processors comply with GDPR and have appropriate safeguards for data transfers
              outside the EEA (Standard Contractual Clauses).
            </p>
          </Section>

          <Section title="5. Your Rights (GDPR)">
            <p className="mb-3">You have the right to:</p>
            <ul className="space-y-2 list-disc list-inside" style={{ color: 'var(--text-2)' }}>
              <li><strong>Access</strong> your data — all data is visible in the app</li>
              <li><strong>Rectification</strong> — edit your profile in Settings</li>
              <li><strong>Erasure</strong> ("right to be forgotten") — in Settings or via email</li>
              <li><strong>Restriction of processing</strong> — e.g. disconnect Strava</li>
              <li><strong>Data portability</strong> — export plans to TCX/PDF available in app</li>
              <li><strong>Object</strong> — disable notifications in Settings</li>
              <li><strong>Lodge a complaint</strong> with a supervisory authority</li>
            </ul>
            <p className="mt-3">
              To exercise any right, email{' '}
              <a href="mailto:plewandowskkii@gmail.com" className="underline" style={{ color: 'var(--green)' }}>
                plewandowskkii@gmail.com
              </a>. We respond within 30 days.
            </p>
          </Section>

          <Section title="6. Data Retention">
            <ul className="space-y-2 list-disc list-inside" style={{ color: 'var(--text-2)' }}>
              <li>Account and profile: <strong>until account deletion</strong></li>
              <li>Activities and plans: together with account</li>
              <li>Strava tokens: until integration is disconnected</li>
              <li>Error logs: <strong>30 days</strong></li>
            </ul>
          </Section>

          <Section title="7. Security">
            <ul className="space-y-2 list-disc list-inside" style={{ color: 'var(--text-2)' }}>
              <li>All connections encrypted via HTTPS/TLS</li>
              <li>Passwords hashed one-way (bcrypt)</li>
              <li>OAuth tokens encrypted in database</li>
              <li>Row Level Security (RLS) — each user sees only their own data</li>
              <li>Regular library updates and vulnerability monitoring</li>
            </ul>
          </Section>

          <Section title="8. Cookies">
            <p>
              We only use <strong>essential cookies</strong> to maintain logged-in user sessions
              (Supabase Auth). We do not use any marketing, analytics, or tracking cookies.
            </p>
          </Section>

          <Section title="9. Children">
            <p>
              PACE is not intended for individuals under 16 years of age.
              We do not knowingly collect data from children. If we learn that an account belongs to
              someone under this age, we will promptly delete it.
            </p>
          </Section>

          <Section title="10. Policy Changes">
            <p>
              We may update this policy. We will notify you by email of material changes
              with at least 7 days notice. The current version is always available at{' '}
              <Link href="/privacy/en" className="underline" style={{ color: 'var(--green)' }}>
                pace-murex.vercel.app/privacy/en
              </Link>.
            </p>
          </Section>

          <Section title="11. Contact">
            <p>
              For data-related inquiries, contact:{' '}
              <a href="mailto:plewandowskkii@gmail.com" className="underline" style={{ color: 'var(--green)' }}>
                plewandowskkii@gmail.com
              </a>
            </p>
          </Section>
        </div>

        <div className="mt-16 pt-8" style={{ borderTop: '1px solid var(--border)' }}>
          <Link
            href="/"
            className="text-sm font-semibold"
            style={{ color: 'var(--green)' }}
          >
            ← Back to homepage
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
