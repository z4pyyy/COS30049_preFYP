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

  const role = profile?.role
  if (role !== 'SENIOR_GUIDE' && role !== 'HOD' && role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Use admin client to bypass RLS on joined views
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('senior_group_roster')
    .select('*')
    .eq('senior_guide_id', user.id)
    .order('avg_completion_pct', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const guideIds = (data ?? []).map(r => r.guide_id)
  let certsByGuide: Record<string, { id: string; stage: string; tpa_name: string }[]> = {}
  if (guideIds.length > 0) {
    const { data: certs } = await admin
      .from('guide_track_certifications')
      .select('id, guide_id, stage, tpa_name')
      .in('guide_id', guideIds)
      .not('stage', 'eq', 'REJECTED')
    for (const c of certs ?? []) {
      if (!certsByGuide[c.guide_id]) certsByGuide[c.guide_id] = []
      certsByGuide[c.guide_id].push({ id: c.id, stage: c.stage, tpa_name: c.tpa_name })
    }
  }

  const rows = (data ?? []).map(r => ({
    ...r,
    certifications: certsByGuide[r.guide_id] ?? [],
  }))

  return NextResponse.json({ rows })
}
