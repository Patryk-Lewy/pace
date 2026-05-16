import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/dashboard?strava=error`)
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      return NextResponse.redirect(`${appUrl}/dashboard?strava=error`)
    }

    const token = await tokenRes.json()

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.redirect(`${appUrl}/login`)

    // Upsert tokens
    await supabase.from('strava_tokens').upsert({
      user_id: user.id,
      strava_athlete_id: token.athlete.id,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_at: token.expires_at,
      athlete_name: `${token.athlete.firstname} ${token.athlete.lastname}`,
      athlete_photo: token.athlete.profile_medium ?? null,
    })

    return NextResponse.redirect(`${appUrl}/dashboard?strava=connected`)
  } catch {
    return NextResponse.redirect(`${appUrl}/dashboard?strava=error`)
  }
}
