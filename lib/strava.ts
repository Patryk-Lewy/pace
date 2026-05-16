import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export type StravaActivity = {
  id: number
  name: string
  type: string
  start_date: string
  distance: number          // meters
  moving_time: number       // seconds
  elapsed_time: number      // seconds
  average_speed: number     // m/s
  average_heartrate?: number
  max_heartrate?: number
  total_elevation_gain: number
}

// Convert m/s to seconds per km
export function speedToSecPerKm(mps: number): number {
  if (!mps || mps === 0) return 0
  return Math.round(1000 / mps)
}

// Format seconds per km → "5:30"
export function formatPace(secPerKm: number): string {
  if (!secPerKm) return '—'
  const min = Math.floor(secPerKm / 60)
  const sec = secPerKm % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}

// Format seconds → "1:23:45"
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

export async function getValidAccessToken(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<string | null> {
  const { data: tokenRow } = await supabase
    .from('strava_tokens')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!tokenRow) return null

  const nowSec = Math.floor(Date.now() / 1000)

  // Token still valid
  if (tokenRow.expires_at > nowSec + 60) {
    return tokenRow.access_token
  }

  // Refresh token
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: tokenRow.refresh_token,
    }),
  })

  if (!res.ok) return null

  const refreshed = await res.json()

  await supabase.from('strava_tokens').update({
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token,
    expires_at: refreshed.expires_at,
  }).eq('user_id', userId)

  return refreshed.access_token
}

export async function fetchRecentActivities(
  accessToken: string,
  perPage = 10
): Promise<StravaActivity[]> {
  const res = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?per_page=${perPage}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!res.ok) return []
  return res.json()
}
