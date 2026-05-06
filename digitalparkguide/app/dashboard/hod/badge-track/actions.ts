'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { generateCertificate } from '@/lib/badges/generate-certificate'
import { sendCertificateEmail } from '@/lib/badges/send-certificate-email'
import { hasMinRole, type AppRole } from '@/types/roles'

const PAGE = '/dashboard/hod/badge-track'

async function assertHod() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!hasMinRole(profile?.role as AppRole, 'HOD')) {
    return { authorized: false as const, userId: '', error: 'Insufficient permissions' }
  }
  return { authorized: true as const, userId: user.id, error: null }
}

type ActionResult = { success?: true; error?: string }

// ── Create cert row for a guide + track ──────────────────────
export async function createCertification(
  guideId: string,
  trackId: string,
): Promise<ActionResult & { certId?: string }> {
  const auth = await assertHod()
  if (!auth.authorized) return { error: auth.error! }

  const admin = createAdminClient()

  const { data: track } = await admin
    .from('training_tracks')
    .select('tpa_name')
    .eq('id', trackId)
    .single()

  if (!track) return { error: 'Track not found' }

  const { data: existing } = await admin
    .from('guide_track_certifications')
    .select('id')
    .eq('guide_id', guideId)
    .eq('track_id', trackId)
    .neq('stage', 'REJECTED')
    .maybeSingle()

  if (existing) return { error: 'Active certification already exists for this guide + track' }

  const { data: cert, error } = await admin
    .from('guide_track_certifications')
    .insert({
      guide_id: guideId,
      track_id: trackId,
      tpa_name: track.tpa_name,
      stage: 'AWAITING_PAYMENT',
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath(PAGE)
  return { success: true, certId: cert.id }
}

// ── Mark payment received (manual reference) ─────────────────
export async function markPaid(
  certId: string,
  paymentRef: string,
): Promise<ActionResult> {
  const auth = await assertHod()
  if (!auth.authorized) return { error: auth.error! }

  const admin = createAdminClient()
  const { error } = await admin
    .from('guide_track_certifications')
    .update({
      stage: 'PAID',
      stripe_session_id: paymentRef,
      paid_at: new Date().toISOString(),
    })
    .eq('id', certId)
    .eq('stage', 'AWAITING_PAYMENT')

  if (error) return { error: error.message }
  revalidatePath(PAGE)
  return { success: true }
}

// ── Mark modules completed ───────────────────────────────────
export async function markModulesCompleted(
  certId: string,
  completedAt?: string,
): Promise<ActionResult> {
  const auth = await assertHod()
  if (!auth.authorized) return { error: auth.error! }

  const admin = createAdminClient()
  const { error } = await admin
    .from('guide_track_certifications')
    .update({
      stage: 'MODULES_COMPLETED',
      modules_completed_at: completedAt || new Date().toISOString(),
    })
    .eq('id', certId)
    .eq('stage', 'PAID')

  if (error) return { error: error.message }
  revalidatePath(PAGE)
  return { success: true }
}

// ── Mark quiz passed ─────────────────────────────────────────
export async function markQuizPassed(
  certId: string,
  passedAt?: string,
): Promise<ActionResult> {
  const auth = await assertHod()
  if (!auth.authorized) return { error: auth.error! }

  const admin = createAdminClient()
  const { error } = await admin
    .from('guide_track_certifications')
    .update({
      stage: 'PENDING_INTERVIEW',
      quiz_passed_at: passedAt || new Date().toISOString(),
    })
    .eq('id', certId)
    .eq('stage', 'MODULES_COMPLETED')

  if (error) return { error: error.message }
  revalidatePath(PAGE)
  return { success: true }
}

// ── Mark interview passed ────────────────────────────────────
export async function markInterviewPassed(
  certId: string,
  notes?: string,
): Promise<ActionResult> {
  const auth = await assertHod()
  if (!auth.authorized) return { error: auth.error! }

  const admin = createAdminClient()
  const { error } = await admin
    .from('guide_track_certifications')
    .update({
      stage: 'PENDING_BADGE_APPROVAL',
      interview_outcome: 'PASSED',
      interview_completed_at: new Date().toISOString(),
      interview_notes: notes || null,
      interviewer_id: auth.userId,
      submitted_to_hod_at: new Date().toISOString(),
    })
    .eq('id', certId)
    .in('stage', ['PENDING_INTERVIEW', 'INTERVIEW_PASSED'])

  if (error) return { error: error.message }
  revalidatePath(PAGE)
  return { success: true }
}

// ── Issue badge (reuses existing RPC + PDF + email) ──────────
export async function issueBadge(
  certId: string,
): Promise<ActionResult & { certificateNo?: string | null }> {
  const auth = await assertHod()
  if (!auth.authorized) return { error: auth.error! }

  const admin = createAdminClient()

  const { error: rpcError } = await admin.rpc('issue_tpa_badge', { p_cert_id: certId })
  if (rpcError) return { error: rpcError.message }

  const { data: cert } = await admin
    .from('guide_track_certifications')
    .select('guide_id, track_id, tpa_name, badge_issued_at, certificate_no')
    .eq('id', certId)
    .single()

  if (!cert) return { success: true }

  const [profileResult, trackResult, authUserResult] = await Promise.all([
    admin.from('profiles').select('full_name').eq('id', cert.guide_id).single(),
    admin.from('training_tracks').select('title').eq('id', cert.track_id).single(),
    admin.auth.admin.getUserById(cert.guide_id),
  ])

  const guideName  = profileResult.data?.full_name
  const trackTitle = trackResult.data?.title
  const guideEmail = authUserResult.data?.user?.email

  if (guideName && trackTitle && cert.badge_issued_at) {
    const issuedAt = new Date(cert.badge_issued_at)
    try {
      const pdfBytes = await generateCertificate({
        guideName,
        trackName: trackTitle,
        parkName: cert.tpa_name,
        issuedAt,
      })
      if (guideEmail) {
        const renewalDue = new Date(issuedAt)
        renewalDue.setFullYear(renewalDue.getFullYear() + 1)
        await sendCertificateEmail({
          guideEmail,
          guideName,
          trackName: trackTitle,
          parkName: cert.tpa_name,
          issuedAt,
          renewalDue,
          pdfBytes,
        })
      }
    } catch (err) {
      console.error('[issueBadge] PDF/email failed:', err)
    }
  }

  revalidatePath(PAGE)
  return { success: true, certificateNo: cert.certificate_no }
}

// ── Reject certification ─────────────────────────────────────
export async function rejectCertification(
  certId: string,
  reason: string,
): Promise<ActionResult> {
  const auth = await assertHod()
  if (!auth.authorized) return { error: auth.error! }

  const admin = createAdminClient()
  const { error } = await admin.rpc('reject_certification', {
    p_cert_id: certId,
    p_reason: reason,
  })

  if (error) return { error: error.message }
  revalidatePath(PAGE)
  return { success: true }
}
