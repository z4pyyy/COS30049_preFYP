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
    <section className="p-8 space-y-6">
      <h1 className="text-2xl font-black text-primary">My Certifications</h1>
      <MyCertificationsClient
        certifications={(data ?? []) as CertificationRow[]}
        fetchError={error?.message ?? null}
      />
    </section>
  )
}
