import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendApplicationStatusEmail } from '@/lib/email'

interface RouteParams { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: RouteParams) {
  const supabase = await createClient()
  const { id } = await params
  const { notes } = await req.json()

  if (!notes?.trim()) {
    return NextResponse.json({ error: 'Rejection notes are required' }, { status: 400 })
  }

  const { error } = await supabase.rpc('reject_guide_application', {
    p_app_id: id,
    p_notes: notes.trim(),
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
        status: 'REJECTED',
        reviewerNotes: app.reviewer_notes,
      })
    } catch (emailErr) {
      console.error('Failed to send rejection email:', emailErr)
    }
  }

  return NextResponse.json({ success: true })
}
