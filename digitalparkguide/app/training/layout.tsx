import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TopNav from '@/components/TopNav'
import { GuardianPortalSidebar } from '@/components/GuardianPortalSidebar'
import type { AppRole } from '@/types/roles'

export default async function TrainingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/training')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  const role = (profile?.role ?? null) as AppRole | null
  const context = role === 'HOD' ? 'HoD Console' : 'Guide Dashboard'
  const fullName = profile?.full_name || user.email || 'Guide'
  const initials = fullName
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      <TopNav context={context} />
      <div className="flex flex-1">
        <GuardianPortalSidebar fullName={fullName} initials={initials} />
        <main className="flex-1 flex flex-col lg:ml-64 pt-14 lg:pt-0">{children}</main>
      </div>
    </div>
  )
}
