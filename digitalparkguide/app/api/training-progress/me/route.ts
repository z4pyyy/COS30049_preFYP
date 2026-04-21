import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Returns the authenticated guide's own per-track progress rows.
// RLS on guide_progress_summary (security_invoker) restricts to own data.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('guide_progress_summary')
    .select('*')
    .eq('guide_id', user.id)
    .order('last_activity_at', { ascending: false, nullsFirst: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ rows: data ?? [] })
}