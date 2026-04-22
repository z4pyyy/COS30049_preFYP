import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { quiz_id } = await req.json()
  if (!quiz_id) return NextResponse.json({ error: 'quiz_id required' }, { status: 400 })

  // Fetch quiz metadata
  const { data: quiz, error: qErr } = await supabase
    .from('quizzes')
    .select('id, title, module_id, passing_score, max_attempts, time_limit_seconds')
    .eq('id', quiz_id)
    .single()

  if (qErr || !quiz) {
    return NextResponse.json({ error: 'Quiz not found' }, { status: 404 })
  }

  // Resume an existing in_progress attempt if the clock hasn't run out
  const nowIso = new Date().toISOString()
  const { data: active } = await supabase
    .from('quiz_attempts')
    .select('*')
    .eq('user_id', user.id)
    .eq('quiz_id', quiz_id)
    .eq('status', 'in_progress')
    .gte('expires_at', nowIso)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (active) {
    const { data: questions } = await supabase
      .from('questions')
      .select('id, quiz_id, question_text, options')  
      .eq('quiz_id', quiz_id)

    return NextResponse.json({ attempt: active, quiz, questions: questions ?? [] })
  }

  // Enforce max attempts
  const { data: remaining } = await supabase.rpc('remaining_quiz_attempts', {
    p_quiz_id: quiz_id,
    p_user: user.id,
  })

  if ((remaining ?? 0) <= 0) {
    return NextResponse.json(
      { error: 'Maximum attempts reached. Contact your HoD.' },
      { status: 403 },
    )
  }

  // Count previous finalised attempts to stamp attempt_number
  const { count: priorCount } = await supabase
    .from('quiz_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('quiz_id', quiz_id)
    .in('status', ['submitted', 'expired'])

  const now = new Date()
  const expiresAt = quiz.time_limit_seconds
    ? new Date(now.getTime() + quiz.time_limit_seconds * 1000).toISOString()
    : null  

  const { data: attempt, error: insErr } = await supabase
    .from('quiz_attempts')
    .insert({
      user_id: user.id,
      quiz_id,
      status: 'in_progress',
      started_at: now.toISOString(),
      expires_at: expiresAt,
      attempt_number: (priorCount ?? 0) + 1,
      score: 0,
      passed: false,
    })
    .select()
    .single()

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  const { data: questions } = await supabase
    .from('questions')
    .select('id, quiz_id, question_text, options')
    .eq('quiz_id', quiz_id)

  return NextResponse.json({ attempt, quiz, questions: questions ?? [] })
}