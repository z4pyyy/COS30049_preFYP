import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasMinRole, type AppRole } from '@/types/roles'
import BadgeTrackClient from './BadgeTrackClient'

export type CertRow = {
  id: string
  guide_id: string
  guide_name: string
  guide_role: string
  track_id: string
  tpa_name: string
  stage: string
  stripe_session_id: string | null
  paid_at: string | null
  modules_completed_at: string | null
  quiz_passed_at: string | null
  interview_outcome: string | null
  interview_completed_at: string | null
  interview_notes: string | null
  interviewer_name: string | null
  badge_issued_at: string | null
  certificate_no: string | null
  revoked_at: string | null
  created_at: string
}

export type GuideOption = { id: string; full_name: string; role: string }
export type TrackOption = { id: string; title: string; tpa_name: string }

export default async function BadgeTrackPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/hod/badge-track')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!hasMinRole(profile?.role as AppRole, 'HOD')) {
    redirect('/unauthorized')
  }

  const admin = createAdminClient()

  const [certsResult, profilesResult, tracksResult] = await Promise.all([
    admin
      .from('guide_track_certifications')
      .select('id, guide_id, track_id, tpa_name, stage, stripe_session_id, paid_at, modules_completed_at, quiz_passed_at, interview_outcome, interview_completed_at, interview_notes, interviewer_id, badge_issued_at, certificate_no, revoked_at, created_at')
      .order('tpa_name')
      .order('created_at', { ascending: true }),
    admin
      .from('profiles')
      .select('id, full_name, role')
      .in('role', ['GUIDE', 'SENIOR_GUIDE', 'HOD', 'SUPERADMIN'])
      .order('full_name'),
    admin
      .from('training_tracks')
      .select('id, title, tpa_name')
      .eq('is_archived', false)
      .order('tpa_name'),
  ])

  const allProfiles = profilesResult.data ?? []
  const profileById = Object.fromEntries(allProfiles.map(p => [p.id, p]))

  const interviewerIds = [...new Set(
    (certsResult.data ?? []).map(c => c.interviewer_id).filter(Boolean)
  )]
  let interviewerNames: Record<string, string> = {}
  if (interviewerIds.length > 0) {
    const { data: interviewers } = await admin
      .from('profiles')
      .select('id, full_name')
      .in('id', interviewerIds)
    for (const i of interviewers ?? []) {
      interviewerNames[i.id] = i.full_name
    }
  }

  const rows: CertRow[] = (certsResult.data ?? []).map(c => ({
    id: c.id,
    guide_id: c.guide_id,
    guide_name: profileById[c.guide_id]?.full_name ?? 'Unknown',
    guide_role: profileById[c.guide_id]?.role ?? 'GUIDE',
    track_id: c.track_id,
    tpa_name: c.tpa_name,
    stage: c.stage,
    stripe_session_id: c.stripe_session_id,
    paid_at: c.paid_at,
    modules_completed_at: c.modules_completed_at,
    quiz_passed_at: c.quiz_passed_at,
    interview_outcome: c.interview_outcome,
    interview_completed_at: c.interview_completed_at,
    interview_notes: c.interview_notes,
    interviewer_name: c.interviewer_id ? (interviewerNames[c.interviewer_id] ?? null) : null,
    badge_issued_at: c.badge_issued_at,
    certificate_no: c.certificate_no,
    revoked_at: c.revoked_at,
    created_at: c.created_at,
  }))

  const guides: GuideOption[] = allProfiles.map(p => ({
    id: p.id,
    full_name: p.full_name,
    role: p.role,
  }))

  const tracks: TrackOption[] = (tracksResult.data ?? []).map(t => ({
    id: t.id,
    title: t.title,
    tpa_name: t.tpa_name,
  }))

  return (
    <section className="p-8 space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-[#8DC63F] font-bold">HoD Tools</p>
        <h1 className="text-2xl font-black text-[#1B3A24] mt-1">Badge Track</h1>
        <p className="text-sm text-[#64748b] mt-1">
          Monitor certification pipeline and issue badges. Manually fill conditions for legacy guides.
        </p>
      </div>
      <BadgeTrackClient
        initialRows={rows}
        guides={guides}
        tracks={tracks}
        fetchError={certsResult.error?.message ?? null}
      />
    </section>
  )
}
