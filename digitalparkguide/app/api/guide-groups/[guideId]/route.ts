import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams { params: Promise<{ guideId: string }> }

export async function PUT(req: NextRequest, { params }: RouteParams) {
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

  const { guideId } = await params
  const { senior_guide_id, tpa_name } = await req.json()

  // Remove current membership for this guide, if any
  const { error: delErr } = await supabase
    .from('guide_group_members')
    .delete()
    .eq('guide_id', guideId)

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  // null senior = leave the guide unassigned
  if (!senior_guide_id) {
    return NextResponse.json({ ok: true, assigned: null })
  }

  if (!tpa_name) {
    return NextResponse.json(
      { error: 'tpa_name required when assigning a senior' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('guide_group_members')
    .insert({
      senior_guide_id,
      guide_id: guideId,
      tpa_name,
      assigned_by: user.id,
      assignment_type: 'manual',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, assigned: data })
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
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

  const { guideId } = await params
  const { error } = await supabase
    .from('guide_group_members')
    .delete()
    .eq('guide_id', guideId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}