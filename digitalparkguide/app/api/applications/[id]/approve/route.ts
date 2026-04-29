import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendApplicationStatusEmail } from '@/lib/email'

interface RouteParams { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: RouteParams) {
  const supabase = await createClient()
  const { id } = await params
  const { notes } = await req.json()

  const { error } = await supabase.rpc('approve_guide_application', {
    p_app_id: id,
    p_notes: notes ?? '',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: app } = await supabase
    .from('guide_applications')
    .select('email, full_name, tpa_name, reviewer_notes')
    .eq('id', id)
    .single()

  if (app) {
    try {
      await sendApplicationStatusEmail({
        recipientEmail: app.email,
        fullName: app.full_name,
        tpaName: app.tpa_name,
        status: 'APPROVED',
        reviewerNotes: app.reviewer_notes,
      })
    } catch (emailErr) {
      console.error('Failed to send approval email:', emailErr)
    }
  }

  return NextResponse.json({ success: true })
}
