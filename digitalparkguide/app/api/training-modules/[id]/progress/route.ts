import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: module_id } = await params
  const { data, error } = await supabase
    .from('guide_module_progress')
    .select('*')
    .eq('guide_id', user.id)
    .eq('module_id', module_id)
    .single()

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ progress: data ?? null })
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: module_id } = await params
  const { asset_id, completed } = await req.json()

  const { data: existing } = await supabase
    .from('guide_module_progress')
    .select('*')
    .eq('guide_id', user.id)
    .eq('module_id', module_id)
    .single()

  let result
  if (existing) {
    const updates: Record<string, unknown> = { last_accessed_at: new Date().toISOString() }
    if (asset_id && !(existing.assets_consumed ?? []).includes(asset_id)) {
      updates.assets_consumed = [...(existing.assets_consumed ?? []), asset_id]
    }
    if (completed && !existing.completed) {
      updates.completed = true
      updates.completed_at = new Date().toISOString()
    }
    const { data, error } = await supabase
      .from('guide_module_progress')
      .update(updates)
      .eq('guide_id', user.id)
      .eq('module_id', module_id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    result = data
  } else {
    const { data, error } = await supabase
      .from('guide_module_progress')
      .insert({
        guide_id: user.id,
        module_id,
        assets_consumed: asset_id ? [asset_id] : [],
        completed: !!completed,
        completed_at: completed ? new Date().toISOString() : null,
      })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    result = data
  }

  // B2.4: Check badge eligibility when module is marked complete
  if (completed) await checkBadgeEligibility(supabase, user.id, module_id)

  return NextResponse.json({ progress: result })
}

async function checkBadgeEligibility(supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>, userId: string, moduleId: string) {
  const { data: mod } = await supabase
    .from('training_modules')
    .select('track_id')
    .eq('id', moduleId)
    .single()
  if (!mod) return

  const { data: trackModules } = await supabase
    .from('training_modules')
    .select('id')
    .eq('track_id', mod.track_id)
    .eq('is_active', true)
    .eq('is_archived', false)
  if (!trackModules?.length) return

  const { data: done } = await supabase
    .from('guide_module_progress')
    .select('module_id')
    .eq('guide_id', userId)
    .eq('completed', true)
    .in('module_id', trackModules.map((m) => m.id))

  const allDone = trackModules.every((m) => done?.some((p) => p.module_id === m.id))
  if (!allDone) return

  const { data: profile } = await supabase
    .from('profiles')
    .select('badge_eligible_tracks')
    .eq('id', userId)
    .single()
  if (!profile) return

  const current: string[] = profile.badge_eligible_tracks || []
  if (!current.includes(mod.track_id)) {
    await supabase
      .from('profiles')
      .update({ badge_eligible_tracks: [...current, mod.track_id] })
      .eq('id', userId)
  }
}
