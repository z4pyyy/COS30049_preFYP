import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// HoD-only aggregate stats + the full per-guide/per-track roster.
const STALLED_DAYS = 14

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Gate on role — RLS would also block a guide, but we want a clean 403
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role
  if (role !== 'HOD' && role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: rows, error } = await supabase
    .from('guide_progress_summary')
    .select('*')
    .order('last_activity_at', { ascending: true, nullsFirst: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const all = rows ?? []
  const active = all.filter((r) => r.enrollment_status === 'active')

  // Stalled = active, <100%, and either never touched or inactive >14d
  const cutoff = Date.now() - STALLED_DAYS * 24 * 60 * 60 * 1000
  const stalled = active.filter((r) => {
    if (r.completion_pct >= 100) return false
    if (!r.last_activity_at) return true
    return new Date(r.last_activity_at).getTime() < cutoff
  })

  const uniqueGuides = new Set(active.map((r) => r.guide_id)).size
  const avgPct = active.length === 0
    ? 0
    : Math.round(active.reduce((s, r) => s + Number(r.completion_pct), 0) / active.length)
  const fullyCertified = new Set(
    all.filter((r) => Number(r.completion_pct) === 100).map((r) => r.guide_id)
  ).size

  return NextResponse.json({
    rows: all,
    stats: {
      total_guides:           uniqueGuides,
      active_enrollments:     active.length,
      avg_completion_pct:     avgPct,
      fully_certified_guides: fullyCertified,
      stalled_guides:         stalled.length,
    },
  })
}