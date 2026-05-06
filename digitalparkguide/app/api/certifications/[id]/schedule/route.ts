import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendCertInterviewScheduledEmail } from '@/lib/email'

interface RouteParams { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id: certId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { date, time, location } = await req.json()
  if (!date || !time || !location?.trim()) {
    return NextResponse.json({ error: 'date, time, and location are required' }, { status: 400 })
  }

  const { error } = await supabase.rpc('schedule_certification_interview', {
    p_cert_id: certId,
    p_date: date,
    p_time: time,
    p_location: location.trim(),
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  try {
    const admin = createAdminClient()
    const { data: cert } = await admin
      .from('guide_track_certifications')
      .select('guide_id, tpa_name, training_tracks(title)')
      .eq('id', certId)
      .single()

    if (cert) {
      const { data: guideAuth } = await admin.auth.admin.getUserById(cert.guide_id)
      const { data: guideProfile } = await admin
        .from('profiles')
        .select('full_name')
        .eq('id', cert.guide_id)
        .single()

      if (guideAuth?.user?.email) {
        const track = cert.training_tracks as unknown as { title: string } | null
        await sendCertInterviewScheduledEmail({
          recipientEmail: guideAuth.user.email,
          guideName: guideProfile?.full_name || 'Guide',
          trackTitle: track?.title || '',
          tpaName: cert.tpa_name,
          interviewDate: date,
          interviewTime: time,
          interviewLocation: location.trim(),
        })
      }
    }
  } catch (emailErr) {
    console.error('Failed to send interview email:', emailErr)
  }

  return NextResponse.json({ success: true })
}
