import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { planToTcx } from '@/lib/tcx'

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: plan } = await supabase
    .from('training_plans').select('*').eq('id', id).eq('user_id', user.id).single()
  if (!plan) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: workouts } = await supabase
    .from('workouts').select('*').eq('plan_id', id).order('week_number').order('day_of_week')

  const tcx = planToTcx(workouts ?? [], plan.plan_name)
  const bytes = new TextEncoder().encode(tcx)

  return new NextResponse(bytes, {
    headers: {
      'Content-Type': 'application/vnd.garmin.tcx+xml; charset=utf-8',
      'Content-Disposition': 'attachment; filename=PACE_plan.tcx',
    },
  })
}
