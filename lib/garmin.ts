import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Garmin Personal API — single user's own data via a self-generated key.
// The key is exchanged for a short-lived JWT access token (no refresh; we just
// request a new one). Pull-based: no webhooks. Host must be the personal one.
const GARMIN_HOST = 'https://personal.connectapi.garmin.com'
const TOKEN_PATH = '/personalapitoken-service/personal-api/personal-api-key/token'
const ACTIVITIES_PATH = '/activitylist-service/activities/search/activities'

export type GarminActivity = {
  activityId: number
  activityName?: string
  startTimeGMT?: string
  startTimeLocal?: string
  distance?: number           // metres
  duration?: number           // seconds
  movingDuration?: number
  elapsedDuration?: number
  averageSpeed?: number       // m/s
  averageHR?: number
  maxHR?: number
  elevationGain?: number
  activityType?: { typeKey?: string }
}

/** Read the `exp` (epoch seconds) claim from a JWT without verifying it. */
function jwtExp(token: string): number | null {
  try {
    const payload = token.split('.')[1]
    const json = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'))
    return typeof json.exp === 'number' ? json.exp : null
  } catch {
    return null
  }
}

/**
 * Valid Garmin access token for a user, refreshing from the stored key when the
 * cached token is missing/expired. Returns null when the user has no key or the
 * key is invalid/expired (so the UI can prompt a reconnect).
 */
export async function getValidGarminToken(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string | null> {
  const { data: row } = await supabase
    .from('garmin_tokens')
    .select('api_key, access_token, token_expires_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (!row) return null

  const nowSec = Math.floor(Date.now() / 1000)
  if (row.access_token && row.token_expires_at && row.token_expires_at > nowSec + 60) {
    return row.access_token
  }

  const res = await fetch(`${GARMIN_HOST}${TOKEN_PATH}`, {
    method: 'POST',
    headers: { Authorization: `ApiKey ${row.api_key}` },
  })
  if (!res.ok) return null

  // Response shape isn't guaranteed; the token is a JWT in one of these fields
  // (or the raw body). We derive expiry from the JWT's own exp claim.
  let token: string | null = null
  const text = await res.text()
  try {
    const data = JSON.parse(text)
    token = data.access_token ?? data.accessToken ?? data.token ?? null
  } catch {
    token = text.trim().startsWith('ey') ? text.trim() : null
  }
  if (!token) return null

  const exp = jwtExp(token) ?? nowSec + 86_400

  await supabase
    .from('garmin_tokens')
    .update({ access_token: token, token_expires_at: exp, updated_at: new Date().toISOString() })
    .eq('user_id', userId)

  return token
}

/** Fetch recent running activities from the Personal API. */
export async function fetchGarminRuns(
  accessToken: string,
  opts: { limit?: number; startDate?: string } = {},
): Promise<GarminActivity[]> {
  const params = new URLSearchParams({
    start: '0',
    limit: String(opts.limit ?? 30),
    activityType: 'running',
  })
  if (opts.startDate) params.set('startDate', opts.startDate)

  const res = await fetch(`${GARMIN_HOST}${ACTIVITIES_PATH}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

/** ISO start date from Garmin's (GMT, naive) timestamp. */
function garminStartISO(a: GarminActivity): string {
  const raw = a.startTimeGMT ?? a.startTimeLocal
  if (!raw) return new Date().toISOString()
  // "2026-08-01 07:30:00" (GMT) → treat as UTC
  const iso = raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

/** Map a Garmin activity to an `activities` insert row (source='garmin'). */
export function garminToActivityRow(a: GarminActivity, userId: string) {
  const distanceM = a.distance ?? 0
  const movingS = Math.round(a.movingDuration ?? a.duration ?? 0)
  const pace = a.averageSpeed && a.averageSpeed > 0
    ? Math.round(1000 / a.averageSpeed)
    : movingS > 0 && distanceM > 0
      ? Math.round(movingS / (distanceM / 1000))
      : null

  return {
    user_id: userId,
    source: 'garmin',
    garmin_id: a.activityId,
    strava_type: a.activityType?.typeKey ?? 'running',
    name: a.activityName?.trim() || 'Bieg Garmin',
    start_date: garminStartISO(a),
    distance_m: distanceM,
    moving_time_s: movingS,
    elapsed_time_s: Math.round(a.elapsedDuration ?? a.duration ?? movingS),
    avg_pace_s_per_km: pace,
    avg_heartrate: a.averageHR ?? null,
    max_heartrate: a.maxHR ?? null,
    total_elevation: a.elevationGain ?? null,
  }
}
