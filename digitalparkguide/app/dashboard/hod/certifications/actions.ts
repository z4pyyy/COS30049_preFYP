'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { generateCertificate } from '@/lib/badges/generate-certificate'
import { sendCertificateEmail } from '@/lib/badges/send-certificate-email'
import { hasMinRole, type AppRole } from '@/types/roles'

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
    return { authorized: false as const, error: 'Insufficient permissions' }
  }
  return { authorized: true as const }
}

export async function issueBadge(
  certId: string,
): Promise<{ success?: true; certificateNo?: string | null; error?: string }> {
  const auth = await assertHod()
  if (!auth.authorized) return { error: auth.error }

  const admin = createAdminClient()

  const { error: rpcError } = await admin.rpc('issue_tpa_badge', { p_cert_id: certId })
  if (rpcError) return { error: rpcError.message }

  // Fetch the updated certification row
  const { data: cert, error: certFetchError } = await admin
    .from('guide_track_certifications')
    .select('guide_id, track_id, tpa_name, badge_issued_at, certificate_no')
    .eq('id', certId)
    .single()

  if (certFetchError || !cert) {
    return { error: certFetchError?.message ?? 'Could not fetch certification after issuance' }
  }

  // Fetch guide name and track title for the certificate
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

    let pdfBytes: Uint8Array
    try {
      pdfBytes = await generateCertificate({
        guideName,
        trackName: trackTitle,
        parkName:  cert.tpa_name,
        issuedAt,
      })
    } catch (err) {
      console.error('[issueBadge] PDF generation failed:', err)
      revalidatePath('/dashboard/hod/certifications')
      return { success: true, certificateNo: cert.certificate_no }
    }

    if (guideEmail) {
      const renewalDue = new Date(issuedAt)
      renewalDue.setFullYear(renewalDue.getFullYear() + 1)
      const sent = await sendCertificateEmail({
        guideEmail,
        guideName,
        trackName:  trackTitle,
        parkName:   cert.tpa_name,
        issuedAt,
        renewalDue,
        pdfBytes,
      })
      if (!sent) {
        console.error(
          `[issueBadge] certificate email failed — cert: ${certId}, guide: ${cert.guide_id}`,
        )
      }
    } else {
      console.warn(`[issueBadge] no email for guide ${cert.guide_id} — certificate email skipped`)
    }
  }

  revalidatePath('/dashboard/hod/certifications')
  return { success: true, certificateNo: cert.certificate_no }
}

export async function rejectCertification(
  certId: string,
  reason: string,
): Promise<{ success?: true; error?: string }> {
  const auth = await assertHod()
  if (!auth.authorized) return { error: auth.error }

  const admin = createAdminClient()
  const { error } = await admin.rpc('reject_certification', {
    p_cert_id: certId,
    p_reason:  reason,
  })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/hod/certifications')
  return { success: true }
}
