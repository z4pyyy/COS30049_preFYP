import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const STALLED_DAYS = 14

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role
  if (role !== 'HOD' && role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  const [progressResult, groupsResult, seniorProfilesResult] = await Promise.all([
    supabase
      .from('guide_progress_summary')
      .select('*')
      .order('last_activity_at', { ascending: true, nullsFirst: true }),
    admin
      .from('guide_group_members')
      .select('senior_guide_id, guide_id, tpa_name'),
    admin
      .from('profiles')
      .select('id, full_name')
      .in('role', ['SENIOR_GUIDE', 'HOD', 'SUPERADMIN']),
  ])

  if (progressResult.error) {
    return NextResponse.json({ error: progressResult.error.message }, { status: 500 })
  }

  const all = progressResult.data ?? []
  const active = all.filter((r) => r.enrollment_status === 'active')

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

  // Build per-group aggregation
  const groupMembers = groupsResult.data ?? []
  const seniorNames = Object.fromEntries(
    (seniorProfilesResult.data ?? []).map(p => [p.id, p.full_name])
  )

  const guideToSenior = new Map<string, string>()
  for (const gm of groupMembers) {
    guideToSenior.set(gm.guide_id, gm.senior_guide_id)
  }

  const groupAgg = new Map<string, { name: string; guides: number; enrollments: number; totalPct: number; stalled: number }>()
  for (const r of active) {
    const seniorId = guideToSenior.get(r.guide_id) ?? 'unassigned'
    const entry = groupAgg.get(seniorId) ?? {
      name: seniorId === 'unassigned' ? 'Unassigned' : (seniorNames[seniorId] ?? seniorId.slice(0, 8)),
      guides: 0,
      enrollments: 0,
      totalPct: 0,
      stalled: 0,
    }
    entry.enrollments++
    entry.totalPct += Number(r.completion_pct)
    if (r.completion_pct < 100) {
      const isStalled = !r.last_activity_at || new Date(r.last_activity_at).getTime() < cutoff
      if (isStalled) entry.stalled++
    }
    groupAgg.set(seniorId, entry)
  }

  // Count unique guides per group
  const guidesByGroup = new Map<string, Set<string>>()
  for (const r of active) {
    const seniorId = guideToSenior.get(r.guide_id) ?? 'unassigned'
    const set = guidesByGroup.get(seniorId) ?? new Set()
    set.add(r.guide_id)
    guidesByGroup.set(seniorId, set)
  }
  for (const [seniorId, set] of guidesByGroup) {
    const entry = groupAgg.get(seniorId)
    if (entry) entry.guides = set.size
  }

  const groups = Array.from(groupAgg.entries()).map(([senior_id, g]) => ({
    senior_id,
    senior_name: g.name,
    guides: g.guides,
    enrollments: g.enrollments,
    avg_completion_pct: g.enrollments === 0 ? 0 : Math.round(g.totalPct / g.enrollments),
    stalled: g.stalled,
  })).sort((a, b) => a.senior_name.localeCompare(b.senior_name))

  return NextResponse.json({
    rows: all,
    stats: {
      total_guides:           uniqueGuides,
      active_enrollments:     active.length,
      avg_completion_pct:     avgPct,
      fully_certified_guides: fullyCertified,
      stalled_guides:         stalled.length,
    },
    groups,
  })
}