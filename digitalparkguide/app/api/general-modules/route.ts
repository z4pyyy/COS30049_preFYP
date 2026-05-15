import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: modules, error } = await supabase
    .from('general_modules')
    .select('*, general_module_completions!left(completed_at)')
    .order('order_index', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const modulesWithStatus = (modules ?? []).map((m: Record<string, unknown>) => ({
    ...m,
    completed: Array.isArray(m.general_module_completions) && m.general_module_completions.length > 0,
    completed_at: Array.isArray(m.general_module_completions) && m.general_module_completions.length > 0
      ? (m.general_module_completions[0] as { completed_at: string }).completed_at
      : null,
    general_module_completions: undefined,
  }))

  return NextResponse.json({ modules: modulesWithStatus })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { data, error } = await supabase
    .from('general_modules')
    .insert({
      title: body.title,
      description: body.description ?? '',
      content: body.content ?? '',
      tpa_ids: body.tpa_ids ?? [],
      order_index: body.order_index ?? 0,
      duration_hours: body.duration_hours ?? 1,
      is_active: body.is_active ?? true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ module: data })
}
