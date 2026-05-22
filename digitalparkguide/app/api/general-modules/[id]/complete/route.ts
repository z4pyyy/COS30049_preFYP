import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const { id: gmId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify GM exists
  const { data: gm, error: gmErr } = await supabase
    .from('general_modules')
    .select('id')
    .eq('id', gmId)
    .single()

  if (gmErr || !gm) {
    return NextResponse.json({ error: 'General module not found' }, { status: 404 })
  }

  // Verify enrolled and paid
  const { data: enrollment } = await supabase
    .from('general_module_enrollments')
    .select('id')
    .eq('guide_id', user.id)
    .eq('module_id', gmId)
    .eq('payment_status', 'paid')
    .maybeSingle()

  if (!enrollment) {
    return NextResponse.json({ error: 'Not enrolled or payment pending' }, { status: 403 })
  }

  // Block if GM has a quiz — must complete via quiz
  const { data: quiz } = await supabase
    .from('quizzes')
    .select('id')
    .eq('general_module_id', gmId)
    .maybeSingle()

  if (quiz) {
    return NextResponse.json({ error: 'This module requires passing a quiz to complete' }, { status: 400 })
  }

  // Insert completion (idempotent)
  const { error: insErr } = await supabase
    .from('general_module_completions')
    .upsert(
      { user_id: user.id, module_id: gmId, completed_at: new Date().toISOString() },
      { onConflict: 'user_id,module_id' },
    )

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  return NextResponse.json({ completed: true })
}
