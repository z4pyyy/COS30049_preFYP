import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TopNav from '@/components/TopNav'
import { GuardianPortalSidebar } from '@/components/GuardianPortalSidebar'

export default async function SeniorGuideLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/senior-guide')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  const fullName = profile?.full_name || user.email || 'Guide'
  const initials = fullName
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <>
      <TopNav fixed context="Senior Guide Console" />
      <div
        className="bg-surface text-on-surface min-h-screen flex flex-col"
        style={{ fontFamily: "'Inter', sans-serif", paddingTop: 'var(--nav-height, 93px)' }}
      >
        <div className="flex flex-col lg:flex-row flex-1">
          <GuardianPortalSidebar fullName={fullName} initials={initials} />
          <main className="flex-1 flex flex-col lg:ml-64">{children}</main>
        </div>
      </div>
    </>
  )
}
