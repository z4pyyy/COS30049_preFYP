import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const TEN_YEARS_SECONDS = 10 * 365 * 24 * 60 * 60

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const formData = await req.formData()
  const clipFile = formData.get('clip') as File | null
  const thumbFile = formData.get('thumbnail') as File | null
  const metadataStr = formData.get('metadata') as string | null

  if (!clipFile || !thumbFile || !metadataStr) {
    return NextResponse.json({ error: 'clip, thumbnail, and metadata required' }, { status: 400 })
  }

  const metadata = JSON.parse(metadataStr)

  if (metadata.guideId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const clipExt = clipFile.name?.split('.').pop() || 'webm'
  const thumbExt = thumbFile.type === 'image/webp' ? 'webp' : 'jpg'
  const clipPath = `${user.id}/${metadata.localQueueId}.${clipExt}`
  const thumbPath = `${user.id}/${metadata.localQueueId}.${thumbExt}`

  const clipBuffer = Buffer.from(await clipFile.arrayBuffer())
  const thumbBuffer = Buffer.from(await thumbFile.arrayBuffer())

  // Strip codec params and fallback from application/octet-stream
  let clipContentType = (clipFile.type || 'video/webm').split(';')[0].trim()
  if (clipContentType === 'application/octet-stream') clipContentType = 'video/webm'

  const { error: clipUploadErr } = await supabase.storage
    .from('evidence-clips')
    .upload(clipPath, clipBuffer, { contentType: clipContentType })

  if (clipUploadErr) {
    return NextResponse.json({ error: clipUploadErr.message }, { status: 500 })
  }

  const { error: thumbUploadErr } = await supabase.storage
    .from('evidence-clips')
    .upload(thumbPath, thumbBuffer, { contentType: thumbFile.type })

  if (thumbUploadErr) {
    return NextResponse.json({ error: thumbUploadErr.message }, { status: 500 })
  }

  const admin = createAdminClient()

  const [clipSigned, thumbSigned] = await Promise.all([
    admin.storage.from('evidence-clips').createSignedUrl(clipPath, TEN_YEARS_SECONDS),
    admin.storage.from('evidence-clips').createSignedUrl(thumbPath, TEN_YEARS_SECONDS),
  ])

  if (clipSigned.error || thumbSigned.error) {
    return NextResponse.json({ error: 'Failed to generate signed URLs' }, { status: 500 })
  }

  const { error: insertErr } = await supabase.from('evidence_clips').insert({
    guide_id: user.id,
    track_id: metadata.trackId || null,
    tpa_label: metadata.tpaLabel || null,
    clip_url: clipSigned.data.signedUrl,
    thumbnail_url: thumbSigned.data.signedUrl,
    detected_at: metadata.detectedAt,
    duration_seconds: metadata.durationSeconds,
    detection_type: metadata.detectionType,
    confidence_score: metadata.confidenceScore,
    status: 'pending_review',
    sync_status: 'synced',
    local_queue_id: metadata.localQueueId,
    session_id: metadata.sessionId || null,
  })

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
