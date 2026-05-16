import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import NotificationToggle from '@/components/NotificationToggle'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col" style={{ maxHeight: '100vh', overflow: 'hidden' }}>
        {/* Top bar */}
        <div className="flex items-center justify-end px-8 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <NotificationToggle />
        </div>
        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
