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
    .select('*, general_module_completions!left(completed_at), general_module_enrollments!left(payment_status, paid_at)')
    .order('order_index', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: tracks } = await supabase
    .from('training_tracks')
    .select('id, title, prerequisite_gm_ids')
    .eq('is_archived', false)

  const tracksByGm = new Map<string, Array<{ id: string; title: string }>>()
  for (const t of tracks ?? []) {
    for (const gmId of (t.prerequisite_gm_ids ?? [])) {
      if (!tracksByGm.has(gmId)) tracksByGm.set(gmId, [])
      tracksByGm.get(gmId)!.push({ id: t.id, title: t.title })
    }
  }

  // Fetch quiz IDs for GMs so cards can link directly
  const { data: gmQuizzes } = await supabase
    .from('quizzes')
    .select('id, general_module_id')
    .not('general_module_id', 'is', null)

  const quizByGm = new Map<string, string>()
  for (const q of gmQuizzes ?? []) {
    if (q.general_module_id) quizByGm.set(q.general_module_id, q.id)
  }

  const modulesWithStatus = (modules ?? []).map((m: Record<string, unknown>) => {
    const completions = m.general_module_completions as Array<{ completed_at: string }> | null
    const enrollments = m.general_module_enrollments as Array<{ payment_status: string; paid_at: string | null }> | null

    return {
      ...m,
      completed: Array.isArray(completions) && completions.length > 0,
      completed_at: Array.isArray(completions) && completions.length > 0
        ? completions[0].completed_at : null,
      enrolled: Array.isArray(enrollments) && enrollments.length > 0,
      paid: Array.isArray(enrollments) && enrollments.some(e => e.payment_status === 'paid'),
      paid_at: Array.isArray(enrollments) && enrollments.length > 0
        ? enrollments.find(e => e.payment_status === 'paid')?.paid_at ?? null : null,
      quiz_id: quizByGm.get(m.id as string) ?? null,
      required_by_tracks: tracksByGm.get(m.id as string) ?? [],
      general_module_completions: undefined,
      general_module_enrollments: undefined,
    }
  })

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
      price_myr: body.price_myr ?? 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ module: data })
}
