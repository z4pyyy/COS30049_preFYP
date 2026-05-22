import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkTrackPrerequisites } from '@/lib/prerequisites'

interface RouteContext {
  params: Promise<{ id: string }>
}

// POST — enroll the current guide in a track
export async function POST(_req: NextRequest, { params }: RouteContext) {
  const { id: trackId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const prereq = await checkTrackPrerequisites(user.id, trackId)
  if (!prereq.satisfied) {
    const incomplete = prereq.prerequisites.filter(p => !p.completed)
    return NextResponse.json(
      {
        error: 'Prerequisites not met',
        message: `Complete required general modules before enrolling.`,
        incomplete_modules: incomplete.map(p => ({ id: p.module.id, title: p.module.title })),
      },
      { status: 403 }
    )
  }

  const { error } = await supabase
    .from('guide_track_enrollments')
    .insert({ guide_id: user.id, track_id: trackId })

  // 23505 = unique_violation → already enrolled, treat as success
  if (error && error.code !== '23505') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Bug 10: carry over completed modules from prior tracks (directly or via
  // HoD-declared equivalency). Safe to call for already-enrolled users too —
  // the RPC upserts and never un-sets completion.
  const { data: presatisfied, error: psErr } = await supabase.rpc('presatisfy_track_modules', {
    p_guide_id: user.id,
    p_track_id: trackId,
  })
  if (psErr) console.error('[enroll] presatisfy_track_modules failed:', psErr.message)

  return NextResponse.json({
    enrolled: true,
    modules_presatisfied: presatisfied ?? 0,
  })
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
