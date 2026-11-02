import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getValidGarminToken } from '@/lib/garmin'

// POST /api/garmin/connect  { api_key }
// Store the user's Garmin Personal API key, then validate it by exchanging for
// an access token. Invalid/expired key → row removed, error returned.
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const apiKey = typeof body?.api_key === 'string' ? body.api_key.trim() : ''
    if (!apiKey || apiKey.length < 12) {
      return NextResponse.json({ error: 'Podaj poprawny klucz Garmin Personal API' }, { status: 400 })
    }

    await supabase.from('garmin_tokens').upsert({
      user_id: user.id,
      api_key: apiKey,
      access_token: null,
      token_expires_at: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    const token = await getValidGarminToken(supabase, user.id)
    if (!token) {
      await supabase.from('garmin_tokens').delete().eq('user_id', user.id)
      return NextResponse.json({ error: 'Klucz nieprawidłowy lub wygasły — wygeneruj nowy w Garmin Connect' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[garmin/connect] error:', err)
    return NextResponse.json({ error: 'Błąd łączenia z Garminem' }, { status: 500 })
  }
}
