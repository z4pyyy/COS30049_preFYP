import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams { params: Promise<{ attemptId: string }> }

// POST /api/quiz-attempts/[attemptId]/submit
// Body: { answers: Record<question_id, selected_option_index> }
//
// Server scores the attempt against the questions table, marks it
// submitted (or expired if the clock has run out), and returns the
// result. The client never sees correct_option_index.
export async function POST(req: NextRequest, { params }: RouteParams) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { attemptId } = await params
  const body = await req.json().catch(() => ({}))
  const answers = (body.answers ?? {}) as Record<string, number>

  // Load attempt
  const { data: attempt, error: aErr } = await supabase
    .from('quiz_attempts')
    .select('*')
    .eq('id', attemptId)
    .eq('user_id', user.id)
    .single()

  if (aErr || !attempt) {
    return NextResponse.json({ error: 'Attempt not found' }, { status: 404 })
  }
  if (attempt.status !== 'in_progress') {
    return NextResponse.json({ error: 'Attempt already finalised' }, { status: 409 })
  }

  // Determine status server-side. If expires_at has passed we mark
  // 'expired' — but we still score whatever answers arrived. The
  // alternative (zero-score on expiry) was rejected because a guide
  // who answered 9/10 questions in time shouldn't get zero just
  // because the last second passed before submit fired.
  const nowMs = Date.now()
  const expired = attempt.expires_at
    ? new Date(attempt.expires_at).getTime() < nowMs
    : false

  // Load quiz + questions WITH correct answers (server only)
  const { data: quiz } = await supabase
    .from('quizzes')
    .select('id, passing_score')
    .eq('id', attempt.quiz_id)
    .single()

  const { data: questions } = await supabase
    .from('questions')
    .select('id, correct_option_index')
    .eq('quiz_id', attempt.quiz_id)

  const total = questions?.length ?? 0
  let correct = 0
  for (const q of questions ?? []) {
    const picked = answers[q.id]
    if (picked === q.correct_option_index) correct++
  }

  const scorePct = total === 0 ? 0 : Math.round((correct / total) * 100)
  const passed = scorePct >= (quiz?.passing_score ?? 80)
  const timeTaken = Math.round((nowMs - new Date(attempt.started_at).getTime()) / 1000)

  const { data: updated, error: upErr } = await supabase
    .from('quiz_attempts')
    .update({
      score: scorePct,
      passed,
      status: expired ? 'expired' : 'submitted',
      submitted_at: new Date().toISOString(),
      time_taken_seconds: timeTaken,
    })
    .eq('id', attemptId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  return NextResponse.json({
    attempt: updated,
    total_questions: total,
    correct_count: correct,
    passed,
  })
}