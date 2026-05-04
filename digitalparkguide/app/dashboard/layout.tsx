import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TopNav from '@/components/TopNav'
import { GuardianPortalSidebar } from '@/components/GuardianPortalSidebar'
import type { AppRole } from '@/types/roles'

function contextLabelFor(role: AppRole | null): string {
  switch (role) {
    case 'SUPERADMIN':   return 'Superadmin Console'
    case 'HOD':          return 'HoD Console'
    case 'SENIOR_GUIDE': return 'Senior Guide Console'
    case 'GUIDE':        return 'Guide Dashboard'
    default:             return 'Guide Dashboard'
  }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/dashboard')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  const role = (profile?.role ?? null) as AppRole | null

  const hasPassword = user.user_metadata?.has_password === true
  if (!hasPassword && role !== 'SUPERADMIN' && role !== 'HOD') {
    redirect('/set-password')
  }
  const context = contextLabelFor(role)
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