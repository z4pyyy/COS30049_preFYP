import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: clip, error } = await supabase
    .from('evidence_clips')
    .select('clip_url, thumbnail_url')
    .eq('id', id)
    .single()

  if (error || !clip) {
    return NextResponse.json({ error: 'Clip not found' }, { status: 404 })
  }

  return NextResponse.json({
    clipUrl: clip.clip_url,
    thumbnailUrl: clip.thumbnail_url,
  })
}
