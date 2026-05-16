import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { workoutToTcx } from '@/lib/tcx'

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: workout } = await supabase
    .from('workouts').select('*').eq('id', id).eq('user_id', user.id).single()
  if (!workout) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const tcx = workoutToTcx(workout)
  const bytes = new TextEncoder().encode(tcx)
  const safeTitle = workout.title.replace(/[^\x00-\x7F]/g, '').replace(/\s+/g, '_')
  const filename = `PACE_Tydz${workout.week_number}_${safeTitle}.tcx`

  return new NextResponse(bytes, {
    headers: {
      'Content-Type': 'application/vnd.garmin.tcx+xml; charset=utf-8',
      'Content-Disposition': `attachment; filename=${filename}`,
    },
  })
}
