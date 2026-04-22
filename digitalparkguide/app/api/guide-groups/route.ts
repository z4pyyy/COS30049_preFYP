import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'HOD' && profile?.role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: seniors, error: sErr } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'SENIOR_GUIDE')
    .order('full_name')

  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 })

  // Every group membership (HoD RLS allows full read)
  const { data: memberships, error: mErr } = await supabase
    .from('guide_group_members')
    .select('senior_guide_id, guide_id, tpa_name, assigned_at, assignment_type')

  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 })

  // Guides not in any group yet 
  const assignedIds = new Set((memberships ?? []).map((m) => m.guide_id))
  const { data: allGuides, error: gErr } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'GUIDE')

  if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 })

  const unassigned = (allGuides ?? []).filter((g) => !assignedIds.has(g.id))

  // Roll up group size per senior
  const sizeBySenior = new Map<string, number>()
  for (const m of memberships ?? []) {
    sizeBySenior.set(m.senior_guide_id, (sizeBySenior.get(m.senior_guide_id) ?? 0) + 1)
  }

  return NextResponse.json({
    seniors: (seniors ?? []).map((s) => ({
      id: s.id,
      full_name: s.full_name,
      group_size: sizeBySenior.get(s.id) ?? 0,
    })),
    memberships: memberships ?? [],
    unassigned,
  })
}