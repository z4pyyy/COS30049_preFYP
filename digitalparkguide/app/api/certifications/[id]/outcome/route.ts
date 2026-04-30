import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id: certId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { outcome, notes } = await req.json()
  if (!outcome || !['PASSED', 'FAILED'].includes(outcome)) {
    return NextResponse.json({ error: 'outcome must be PASSED or FAILED' }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('record_interview_outcome', {
    p_cert_id: certId,
    p_outcome: outcome,
    p_notes: notes || '',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ certification: data })
}
