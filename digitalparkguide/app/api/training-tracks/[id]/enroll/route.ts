import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ id: string }>
}

// POST — enroll the current guide in a track
export async function POST(_req: NextRequest, { params }: RouteContext) {
  const { id: trackId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('guide_track_enrollments')
    .insert({ guide_id: user.id, track_id: trackId })

  if (error) {
    // 23505 = unique_violation → already enrolled, treat as success
    if (error.code === '23505') return NextResponse.json({ enrolled: true })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ enrolled: true })
}

// DELETE — unenroll the current guide from a track
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { id: trackId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('guide_track_enrollments')
    .delete()
    .eq('guide_id', user.id)
    .eq('track_id', trackId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ enrolled: false })
}
