import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import CalendarView from '@/components/CalendarView'

export default async function CalendarPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  const user = session.user

  const { data: plan } = await supabase
    .from('training_plans').select('*').eq('user_id', user.id).eq('status', 'active')
    .order('created_at', { ascending: false }).maybeSingle()

  if (!plan) {
    return (
      <div className="animate-fade-up" style={{ paddingTop: 40 }}>
        <div className="text-center" style={{ borderRadius: 26, padding: 32, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📅</div>
          <div className="cond" style={{ fontSize: 24, marginBottom: 8 }}>Brak planu</div>
          <p style={{ font: '500 13px var(--font-barlow)', color: 'var(--text-2)', marginBottom: 20 }}>Najpierw wygeneruj plan treningowy.</p>
          <Link href="/plan" className="press" style={{
            display: 'inline-block', background: 'var(--green)', color: '#000', borderRadius: 16, padding: '14px 28px',
            font: '800 14px var(--font-barlow-condensed)', letterSpacing: 1.5, textTransform: 'uppercase', textDecoration: 'none',
          }}>Idź do planu →</Link>
        </div>
      </div>
    )
  }

  const { data: workouts } = await supabase
    .from('workouts').select('*').eq('plan_id', plan.id).order('week_number')

  return <CalendarView plan={plan} workouts={workouts ?? []} />
}
