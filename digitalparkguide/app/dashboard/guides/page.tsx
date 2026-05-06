import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasMinRole, type AppRole } from '@/types/roles'
import GuideTrackClient from './GuideTrackClient'

export type CertRow = {
  id: string
  guide_id: string
  guide_name: string
  guide_role: string
  tpa_name: string
  track_title: string
  stage: string
  paid_at: string | null
  badge_issued_at: string | null
  revoked_at: string | null
  certificate_no: string | null
  created_at: string
}

export default async function GuideTrackPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/guides')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!hasMinRole(profile?.role as AppRole, 'HOD')) {
    redirect('/unauthorized')
  }

  const { data: certs, error } = await supabase
    .from('guide_track_certifications')
    .select('id, guide_id, tpa_name, stage, paid_at, badge_issued_at, revoked_at, certificate_no, created_at, training_tracks ( title )')
    .order('tpa_name', { ascending: true })
    .order('stage', { ascending: true })

  const guideIds = [...new Set((certs ?? []).map(c => c.guide_id))]
  const { data: profiles } = guideIds.length
    ? await supabase.from('profiles').select('id, full_name, role').in('id', guideIds)
    : { data: [] }

  const profileById = Object.fromEntries(
    (profiles ?? []).map(p => [p.id, { name: p.full_name, role: p.role }])
  )

  const rows: CertRow[] = (certs ?? []).map(c => ({
    id: c.id,
    guide_id: c.guide_id,
    guide_name: profileById[c.guide_id]?.name ?? 'Unknown',
    guide_role: profileById[c.guide_id]?.role ?? 'GUIDE',
    tpa_name: c.tpa_name,
    track_title: (c.training_tracks as unknown as { title: string } | null)?.title ?? c.tpa_name,
    stage: c.stage,
    paid_at: c.paid_at,
    badge_issued_at: c.badge_issued_at,
    revoked_at: c.revoked_at,
    certificate_no: c.certificate_no,
    created_at: c.created_at,
  }))

  return (
    <section className="p-8 space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-[#8DC63F] font-bold">HoD Tools</p>
        <h1 className="text-2xl font-black text-[#1B3A24] mt-1">Guide Track</h1>
        <p className="text-sm text-[#64748b] mt-1">
          All certifications grouped by TPA. See who holds badges and their pipeline stage.
        </p>
      </div>
      <GuideTrackClient rows={rows} fetchError={error?.message ?? null} />
    </section>
  )
}
