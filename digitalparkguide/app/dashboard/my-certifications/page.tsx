import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MyCertificationsClient } from '@/components/MyCertificationsClient'
import type { CertificationRow } from '@/components/MyCertificationsClient'

export default async function MyCertificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/my-certifications')

  const { data, error } = await supabase
    .from('my_certifications_view')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <section className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-[#1B3A24]">My Certifications</h1>
        <p className="text-sm text-[#64748b] mt-1">Track your certification progress and interview stages.</p>
      </div>
      <MyCertificationsClient
        certifications={(data ?? []) as CertificationRow[]}
        fetchError={error?.message ?? null}
      />
    </section>
  )
}
