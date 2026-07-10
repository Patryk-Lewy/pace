import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PlanClient from '@/components/PlanClient'

export default async function PlanPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: active }, { data: archived }] = await Promise.all([
    supabase.from('training_plans').select('*').eq('user_id', user.id).eq('status', 'active')
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('training_plans').select('*').eq('user_id', user.id).eq('status', 'archived')
      .order('created_at', { ascending: false }).limit(10),
  ])

  return <PlanClient plan={active ?? null} archivedPlans={archived ?? []} />
}
