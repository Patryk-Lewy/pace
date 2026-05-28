import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * POST /api/account/delete
 *
 * GDPR-compliant account deletion:
 * - Verifies the caller is authenticated
 * - Uses service role to delete the auth.users row
 * - All related data (profile, plans, workouts, activities, tokens,
 *   ai_comments, push_subscriptions) is removed automatically via
 *   ON DELETE CASCADE foreign keys.
 */
export async function POST() {
  // 1. Verify caller identity from session cookies
  const sessionClient = await createClient()
  const { data: { user } } = await sessionClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Delete the auth user via service role (bypasses RLS).
  //    All FKs reference auth.users(id) with ON DELETE CASCADE,
  //    so this single delete propagates to every related row.
  const adminClient = createServiceClient()
  const { error } = await adminClient.auth.admin.deleteUser(user.id)

  if (error) {
    console.error('[ACCOUNT DELETE] Failed:', error)
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
  }

  // 3. Sign out current session (cookies cleared on client too)
  await sessionClient.auth.signOut()

  return NextResponse.json({ ok: true })
}
