import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { analyzeAndAdapt, applyAdaptation, dismissAdaptation } from '@/lib/plan-adaptation'

// POST /api/plan/adapt
// Manual trigger: analyze current data and (if warranted) create a suggestion.
export async function POST(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: activePlan } = await supabase
    .from('training_plans')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .maybeSingle()

  if (!activePlan) return NextResponse.json({ error: 'No active plan' }, { status: 404 })

  await analyzeAndAdapt(supabase, user.id, activePlan.id)

  return NextResponse.json({ ok: true })
}

// PATCH /api/plan/adapt
// Body: { commentId: string, action: 'apply' | 'dismiss' }
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { commentId?: string; action?: string }
  const { commentId, action } = body

  if (!commentId || !action) {
    return NextResponse.json({ error: 'Missing commentId or action' }, { status: 400 })
  }

  if (action === 'apply') {
    const result = await applyAdaptation(supabase, user.id, commentId)
    return NextResponse.json(result)
  }

  if (action === 'dismiss') {
    const result = await dismissAdaptation(supabase, user.id, commentId)
    return NextResponse.json(result)
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
