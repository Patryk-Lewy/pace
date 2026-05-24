import { NextResponse, type NextRequest } from 'next/server'

/**
 * GET /api/strava/register-webhook?secret=pace_webhook_2026
 *
 * One-time endpoint to register the Strava webhook subscription.
 * Strava will ping our /api/strava/webhook (GET) with hub.challenge
 * to verify the callback URL, then start sending activity events.
 *
 * Usage: open this URL in the browser (must be on the deployed Vercel URL, not localhost)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  // Simple secret guard — prevents random people from registering/listing webhooks
  const secret = searchParams.get('secret')
  if (secret !== process.env.STRAVA_WEBHOOK_VERIFY_TOKEN) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const action = searchParams.get('action') ?? 'status'
  const clientId = process.env.STRAVA_CLIENT_ID!
  const clientSecret = process.env.STRAVA_CLIENT_SECRET!
  const verifyToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN!
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  const callbackUrl = `${appUrl}/api/strava/webhook`

  // ── LIST existing subscriptions ──────────────────────────────────────────
  if (action === 'status') {
    const res = await fetch(
      `https://www.strava.com/api/v3/push_subscriptions?client_id=${clientId}&client_secret=${clientSecret}`
    )
    const data = await res.json()
    return NextResponse.json({
      info: 'Existing Strava webhook subscriptions',
      subscriptions: data,
      callbackUrl,
    })
  }

  // ── DELETE subscription ──────────────────────────────────────────────────
  if (action === 'delete') {
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing ?id=<subscription_id>' }, { status: 400 })

    const res = await fetch(
      `https://www.strava.com/api/v3/push_subscriptions/${id}?client_id=${clientId}&client_secret=${clientSecret}`,
      { method: 'DELETE' }
    )
    return NextResponse.json({ deleted: id, status: res.status })
  }

  // ── REGISTER new subscription ────────────────────────────────────────────
  if (action === 'register') {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      callback_url: callbackUrl,
      verify_token: verifyToken,
    })

    const res = await fetch('https://www.strava.com/api/v3/push_subscriptions', {
      method: 'POST',
      body,
    })

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json({
        error: 'Strava registration failed',
        details: data,
        callbackUrl,
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook registered! Strava will now push activities automatically.',
      subscription: data,
      callbackUrl,
    })
  }

  return NextResponse.json({
    error: 'Unknown action. Use ?action=status | register | delete&id=<id>',
  }, { status: 400 })
}
