import { NextResponse, type NextRequest } from 'next/server'
import { Resend } from 'resend'

// POST /api/auth/welcome-email
// Called client-side after successful Supabase signUp.
// Body: { email: string }
export async function POST(request: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    // Silently skip if not configured — don't break registration
    return NextResponse.json({ ok: true, skipped: true })
  }

  const body = await request.json() as { email?: string }
  const { email } = body

  if (!email) {
    return NextResponse.json({ error: 'Missing email' }, { status: 400 })
  }

  const resend = new Resend(apiKey)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pace.app'

  try {
    await resend.emails.send({
      from: process.env.RESEND_DOMAIN === 'resend.dev'
        ? 'PACE <onboarding@resend.dev>'
        : `PACE <hello@${process.env.RESEND_DOMAIN ?? 'pace.app'}>`,
      to: email,
      subject: 'Witaj w PACE — Twój plan treningowy czeka! 🏃',
      html: buildWelcomeEmail(appUrl),
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[WELCOME EMAIL]', err)
    // Don't fail registration over email error
    return NextResponse.json({ ok: true, skipped: true })
  }
}

function buildWelcomeEmail(appUrl: string): string {
  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Witaj w PACE</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e5e5e5;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">

    <!-- Logo -->
    <div style="margin-bottom:32px;">
      <span style="font-size:28px;font-weight:900;letter-spacing:0.15em;text-transform:uppercase;color:#00e676;">
        PACE
      </span>
    </div>

    <!-- Hero -->
    <h1 style="font-size:36px;font-weight:900;line-height:1.1;margin:0 0 16px;color:#fff;">
      Twój AI trener<br/>jest gotowy. 🤖
    </h1>
    <p style="font-size:15px;line-height:1.6;color:#a3a3a3;margin:0 0 32px;">
      Cześć! Właśnie dołączyłeś do PACE — AI trenera biegowego opartego na Claude.
      Zostało Ci tylko jedno: uzupełnić profil, żeby Claude mógł zbudować Twój spersonalizowany plan.
    </p>

    <!-- CTA button -->
    <div style="margin-bottom:40px;">
      <a href="${appUrl}/onboarding"
        style="display:inline-block;background:#00e676;color:#000;font-weight:900;font-size:14px;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none;padding:14px 32px;border-radius:12px;">
        Uzupełnij profil i zbuduj plan →
      </a>
    </div>

    <!-- Steps -->
    <div style="background:#141414;border:1px solid #262626;border-radius:16px;padding:24px;margin-bottom:32px;">
      <p style="font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:#525252;margin:0 0 16px;">
        Co dalej?
      </p>
      ${[
        ['01', 'Uzupełnij profil biegacza', 'Podaj rekordy życiowe, dostępne dni i cel. Zajmie Ci to 2 minuty.'],
        ['02', 'Claude generuje Twój plan', 'AI oblicza optymalne tempa metodą VDOT i układa plan tydzień po tygodniu.'],
        ['03', 'Połącz Stravę', 'Po każdym biegu dostajesz analizę AI i automatyczną adaptację planu.'],
      ].map(([num, title, desc]) => `
      <div style="display:flex;gap:16px;margin-bottom:16px;align-items:flex-start;">
        <span style="font-size:20px;font-weight:900;color:#00e676;min-width:28px;font-family:monospace;">${num}</span>
        <div>
          <p style="font-size:14px;font-weight:700;color:#fff;margin:0 0 4px;">${title}</p>
          <p style="font-size:13px;color:#737373;margin:0;line-height:1.5;">${desc}</p>
        </div>
      </div>`).join('')}
    </div>

    <!-- Features pills -->
    <div style="margin-bottom:40px;">
      ${['🤖 Plan AI', '📊 Analiza Strava', '❤️ Strefy tętna', '🔔 Przypomnienia push', '⌚ Eksport Garmin'].map(f =>
        `<span style="display:inline-block;background:#1a1a1a;border:1px solid #262626;border-radius:20px;padding:4px 12px;font-size:12px;color:#a3a3a3;margin:0 6px 6px 0;">${f}</span>`
      ).join('')}
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid #1f1f1f;padding-top:24px;">
      <p style="font-size:12px;color:#525252;margin:0;">
        Jeśli to nie Ty się rejestrowałeś, zignoruj tę wiadomość.
      </p>
      <p style="font-size:12px;color:#525252;margin:8px 0 0;">
        PACE · AI trener biegowy · Powered by Claude
      </p>
    </div>

  </div>
</body>
</html>`
}
