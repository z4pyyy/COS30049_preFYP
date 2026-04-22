import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams { params: Promise<{ attemptId: string }> }

// GET /api/quiz-attempts/[attemptId]
// Used by the quiz page to poll the authoritative expires_at timestamp.
// Polling (instead of a pure client timer) ensures a user who hides the
// tab can't gain time — when they come back we read expires_at again and
// it will have passed if the clock ran out.
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { attemptId } = await params

  const { data, error } = await supabase
    .from('quiz_attempts')
    .select('*')
    .eq('id', attemptId)
    .eq('user_id', user.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Attempt not found' }, { status: 404 })
  }

  // Compute remaining seconds authoritatively from server's NOW()
  const nowMs    = Date.now()
  const expiryMs = data.expires_at ? new Date(data.expires_at).getTime() : null
  const remaining = expiryMs === null ? null : Math.max(0, Math.round((expiryMs - nowMs) / 1000))

  return NextResponse.json({
    attempt: data,
    server_now: new Date(nowMs).toISOString(),
    remaining_seconds: remaining,
  })
}