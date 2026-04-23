import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasMinRole, type AppRole } from '@/types/roles'
import { HodCertificationsClient } from '@/components/HodCertificationsClient'
import type { PendingApprovalRow } from '@/components/HodCertificationsClient'

export default async function HodCertificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/hod/certifications')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!hasMinRole(profile?.role as AppRole, 'HOD')) {
    redirect('/unauthorized')
  }

  // Fetch pending approval rows with track join
  const { data: certs, error } = await supabase
    .from('guide_track_certifications')
    .select('id, guide_id, tpa_name, submitted_to_hod_at, created_at, training_tracks ( title )')
    .eq('stage', 'PENDING_BADGE_APPROVAL')
    .order('submitted_to_hod_at', { ascending: true })

  // Fetch guide names separately (guide_id → auth.users, not profiles FK-wise)
  const guideIds = [...new Set((certs ?? []).map((c) => c.guide_id))]
  const { data: profiles } = guideIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', guideIds)
    : { data: [] }

  const nameById = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name]))

  const rows: PendingApprovalRow[] = (certs ?? []).map((c) => ({
    id:                 c.id,
    guide_id:           c.guide_id,
    guide_name:         nameById[c.guide_id] ?? 'Unknown Guide',
    tpa_name:           c.tpa_name,
    track_title:        (c.training_tracks as unknown as { title: string } | null)?.title ?? '—',
    submitted_to_hod_at: c.submitted_to_hod_at,
    created_at:         c.created_at,
  }))

  return (
    <section className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-primary">Badge Approvals</h1>
        <span className="text-sm text-on-surface-variant font-semibold">
          {rows.length} pending
        </span>
      </div>
      <HodCertificationsClient
        initialRows={rows}
        fetchError={error?.message ?? null}
      />
    </section>
  )
}
