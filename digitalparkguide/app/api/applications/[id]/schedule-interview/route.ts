import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: RouteParams) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'HOD' && profile?.role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const { date, time, location, notes } = await req.json()

  if (!date || !time || !location?.trim()) {
    return NextResponse.json(
      { error: 'date, time, and location are required' },
      { status: 400 },
    )
  }

  const today = new Date().toISOString().slice(0, 10)
  if (date < today) {
    return NextResponse.json(
      { error: 'Interview date cannot be in the past' },
      { status: 400 },
    )
  }

  const { data, error } = await supabase
    .from('guide_applications')
    .update({
      status: 'INTERVIEW_SCHEDULED',
      interview_date: date,
      interview_time: time,
      interview_location: location.trim(),
      reviewer_notes: notes?.trim() ?? '',
      interview_scheduled_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ application: data })
}