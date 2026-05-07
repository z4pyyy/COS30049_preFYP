import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const url = req.nextUrl
  const status = url.searchParams.get('status')
  const trackId = url.searchParams.get('trackId')
  const detectionType = url.searchParams.get('detectionType')
  const cursor = url.searchParams.get('cursor')
  const limit = 12

  let query = supabase
    .from('evidence_clips')
    .select(`
      id, guide_id, track_id, tpa_label, clip_url, thumbnail_url,
      detected_at, duration_seconds, detection_type,
      confidence_score, status, sync_status, created_at
    `)
    .eq('sync_status', 'synced')
    .order('detected_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1)

  if (status) {
    const statuses = status.split(',')
    query = query.in('status', statuses)
  }
  if (trackId) query = query.eq('track_id', trackId)
  if (detectionType) {
    const types = detectionType.split(',')
    query = query.in('detection_type', types)
  }
  if (cursor) {
    const [cursorDate, cursorId] = cursor.split('|')
    query = query.or(`detected_at.lt.${cursorDate},and(detected_at.eq.${cursorDate},id.lt.${cursorId})`)
  }

  const { data, error } = await query
  if (error) {
    console.error('Evidence API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const clips = data ?? []
  const hasMore = clips.length > limit
  const page = hasMore ? clips.slice(0, limit) : clips

  // Batch-fetch guide names and track info
  const guideIds = [...new Set(page.map(c => c.guide_id))]
  const trackIds = [...new Set(page.map(c => c.track_id).filter(Boolean))]

  const [profilesRes, tracksRes] = await Promise.all([
    guideIds.length > 0
      ? supabase.from('profiles').select('id, full_name').in('id', guideIds)
      : { data: [] },
    trackIds.length > 0
      ? supabase.from('training_tracks').select('id, title, tpa_name').in('id', trackIds)
      : { data: [] },
  ])

  const profileMap = new Map((profilesRes.data ?? []).map(p => [p.id, p]))
  const trackMap = new Map((tracksRes.data ?? []).map(t => [t.id, t]))

  const enriched = page.map(clip => ({
    ...clip,
    profiles: profileMap.get(clip.guide_id) ?? null,
    training_tracks: clip.track_id ? trackMap.get(clip.track_id) ?? null : null,
  }))

  const nextCursor = hasMore
    ? `${page[page.length - 1].detected_at}|${page[page.length - 1].id}`
    : null

  return NextResponse.json({ clips: enriched, nextCursor })
}
