import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * DELETE /api/activities/[id]
 *
 * Soft-deletes (hides) a synced activity. The row is kept with hidden=true so
 * that a later Strava re-sync won't bring it back. If the activity completed a
 * planned workout, that workout reverts to 'planned'.
 */
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: activity } = await supabase
    .from('activities')
    .select('id, matched_workout_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!activity) return NextResponse.json({ error: 'Nie znaleziono biegu' }, { status: 404 })

  // Revert linked workout back to planned
  if (activity.matched_workout_id) {
    await supabase
      .from('workouts')
      .update({ status: 'planned', completed_at: null })
      .eq('id', activity.matched_workout_id)
      .eq('user_id', user.id)
  }

  // Soft-delete: hide + unlink + clear AI comment
  const { error } = await supabase
    .from('activities')
    .update({ hidden: true, matched_workout_id: null, ai_comment: null, ai_analyzed_at: null })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
