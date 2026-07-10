import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BottomTabBar from '@/components/BottomTabBar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100dvh' }}>
      <main className="app-shell">{children}</main>
      <BottomTabBar />
    </div>
  )
}
