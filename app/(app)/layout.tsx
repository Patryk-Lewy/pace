import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BottomTabBar from '@/components/BottomTabBar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  // Auth is authoritatively validated in middleware (proxy.ts). Here we only
  // need to confirm a session exists — getSession() reads the cookie without a
  // network round-trip to Supabase Auth.
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100dvh' }}>
      <main className="app-shell">{children}</main>
      <BottomTabBar />
    </div>
  )
}
