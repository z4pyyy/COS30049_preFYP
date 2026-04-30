import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendBadgeIssuedEmail } from '@/lib/email'

interface RouteParams { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const { id: certId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data, error } = await supabase.rpc('issue_tpa_badge', { p_cert_id: certId })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  try {
    const cert = data as { guide_id: string; tpa_name: string; track_id: string; certificate_no: string }
    const { data: guideAuth } = await supabase.auth.admin.getUserById(cert.guide_id)
    const { data: guideProfile } = await supabase.from('profiles').select('full_name').eq('id', cert.guide_id).single()
    const { data: track } = await supabase.from('training_tracks').select('title').eq('id', cert.track_id).single()

    if (guideAuth?.user?.email) {
      await sendBadgeIssuedEmail({
        recipientEmail: guideAuth.user.email,
        guideName: guideProfile?.full_name || 'Guide',
        trackTitle: track?.title || '',
        tpaName: cert.tpa_name,
        certificateNo: cert.certificate_no,
      })
    }
  } catch (emailErr) {
    console.error('Failed to send badge email:', emailErr)
  }

  return NextResponse.json({ certification: data })
}
