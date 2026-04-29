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

  return NextResponse.json({ progress: result })
}
