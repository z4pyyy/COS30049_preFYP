import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role as string | undefined
  if (!role || role === 'PUBLIC_USER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  let userFilter: string[] | null = null

  if (role === 'GUIDE') {
    userFilter = [user.id]
  } else if (role === 'SENIOR_GUIDE') {
    const { data: members } = await admin
      .from('guide_group_members')
      .select('guide_id')
      .eq('senior_guide_id', user.id)
    userFilter = (members ?? []).map(m => m.guide_id)
    userFilter.push(user.id)
  }

  let query = admin
    .from('quiz_attempts')
    .select(`
      id, user_id, quiz_id, score, passed, attempt_number,
      time_taken_seconds, status, started_at, submitted_at,
      quizzes ( title, passing_score, module_id,
        training_modules:module_id ( title, training_tracks ( tpa_name ) )
      )
    `)
    .in('status', ['submitted', 'expired'])
    .order('submitted_at', { ascending: false, nullsFirst: false })
    .limit(1000)

  if (userFilter) {
    query = query.in('user_id', userFilter)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const userIds = [...new Set((data ?? []).map(r => r.user_id))]
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, full_name')
    .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000'])

  const nameMap = Object.fromEntries(
    (profiles ?? []).map(p => [p.id, p.full_name])
  )

  const rows = (data ?? []).map((r: Record<string, unknown>) => {
    const quizzes = r.quizzes as {
      title: string
      passing_score: number
      module_id: string | null
      training_modules: {
        title: string
        training_tracks: { tpa_name: string } | null
      } | null
    } | null

    return {
      id: r.id,
      user_id: r.user_id,
      quiz_id: r.quiz_id,
      score: r.score,
      passed: r.passed,
      attempt_number: r.attempt_number,
      time_taken_seconds: r.time_taken_seconds,
      status: r.status,
      started_at: r.started_at,
      submitted_at: r.submitted_at,
      guide_name: nameMap[r.user_id as string] || (r.user_id as string).slice(0, 8),
      quiz_title: quizzes?.title || '—',
      module_title: quizzes?.training_modules?.title || '—',
      tpa_name: quizzes?.training_modules?.training_tracks?.tpa_name || 'Unassigned',
      passing_score: quizzes?.passing_score ?? 80,
    }
  })

  return NextResponse.json({ rows, role })
}
