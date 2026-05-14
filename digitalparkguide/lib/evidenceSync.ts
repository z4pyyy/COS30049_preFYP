import { createClient } from '@/lib/supabase/client'
import {
  getPendingClips,
  updateClipSyncStatus,
  type LocalEvidenceClip,
} from './evidenceQueue'
import { getSelectedMimeExt } from './evidence'

type SyncProgressCallback = (done: number, total: number, current?: string) => void

let syncing = false

const GRACE_PERIOD_MS = 60_000

export async function syncNow(onProgress?: SyncProgressCallback, bypassGrace = false): Promise<void> {
  if (syncing) return
  syncing = true

  try {
    let pending = await getPendingClips()

    if (!bypassGrace) {
      const cutoff = Date.now() - GRACE_PERIOD_MS
      pending = pending.filter(c => new Date(c.detectedAt).getTime() <= cutoff)
    }

    pending = pending.filter(c => !c.markedForDeletion)

    if (pending.length === 0) return

    requestBackgroundSync()

    const supabase = createClient()
    const total = pending.length

    for (let i = 0; i < pending.length; i++) {
      const clip = pending[i]
      onProgress?.(i, total, clip.localQueueId)

      try {
        await syncOneClip(supabase, clip)
        onProgress?.(i + 1, total)
      } catch (err) {
        console.error(`Sync failed for ${clip.localQueueId}:`, err)
      }
    }
  } finally {
    syncing = false
  }
}

async function syncOneClip(
  supabase: ReturnType<typeof createClient>,
  clip: LocalEvidenceClip
): Promise<void> {
  await updateClipSyncStatus(clip.localQueueId, 'uploading')

  const { ext } = getSelectedMimeExt()
  const clipPath = `${clip.guideId}/${clip.localQueueId}${ext || '.webm'}`
  const thumbExt = clip.thumbnailBlob.type === 'image/webp' ? '.webp' : '.jpg'
  const thumbPath = `${clip.guideId}/${clip.localQueueId}${thumbExt}`

  // Strip codec params (e.g. 'video/webm; codecs="vp9"' → 'video/webm') — Supabase rejects extended MIME
  const baseContentType = (clip.mimeType || 'video/webm').split(';')[0].trim()

  const { error: clipErr } = await supabase.storage
    .from('evidence-clips')
    .upload(clipPath, clip.clipBlob, { contentType: baseContentType })

  if (clipErr) {
    await updateClipSyncStatus(clip.localQueueId, 'failed')
    throw clipErr
  }

  const { error: thumbErr } = await supabase.storage
    .from('evidence-clips')
    .upload(thumbPath, clip.thumbnailBlob, { contentType: clip.thumbnailBlob.type })

  if (thumbErr) {
    await updateClipSyncStatus(clip.localQueueId, 'failed')
    throw thumbErr
  }

  // Signed URLs via server API (service role key stays server-side)
  const signedRes = await fetch('/api/evidence/sign-urls', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clipPath, thumbPath }),
  })

  if (!signedRes.ok) {
    await updateClipSyncStatus(clip.localQueueId, 'failed')
    throw new Error('Failed to generate signed URLs')
  }

  const { clipUrl, thumbnailUrl } = await signedRes.json()

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const trackId = clip.trackId && isUuid.test(clip.trackId) ? clip.trackId : null
  const tpaLabel = clip.tpaLabel || (!trackId && clip.trackId ? clip.trackId : null)

  const { error: insertErr } = await supabase.from('evidence_clips').insert({
    guide_id: clip.guideId,
    track_id: trackId,
    tpa_label: tpaLabel,
    clip_url: clipUrl,
    thumbnail_url: thumbnailUrl,
    detected_at: clip.detectedAt,
    duration_seconds: clip.durationSeconds,
    detection_type: clip.detectionType,
    confidence_score: clip.confidenceScore,
    status: 'pending_review',
    sync_status: 'synced',
    local_queue_id: clip.localQueueId,
  })

  if (insertErr) {
    await updateClipSyncStatus(clip.localQueueId, 'failed')
    throw insertErr
  }

  await updateClipSyncStatus(clip.localQueueId, 'synced', { clipUrl, thumbnailUrl })
}

export async function syncOneById(localQueueId: string): Promise<void> {
  const pending = await getPendingClips()
  const clip = pending.find(c => c.localQueueId === localQueueId)
  if (!clip) throw new Error('Clip not found in queue')
  const supabase = createClient()
  await syncOneClip(supabase, clip)
}

export async function requestBackgroundSync(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  const reg = await navigator.serviceWorker.ready
  if ('sync' in reg) {
    try {
      await (reg as any).sync.register('evidence-sync')
    } catch {
      // Background sync not supported or denied — fallback handled by auto-sync
    }
  }
}

export function registerAutoSync(onProgress?: SyncProgressCallback): () => void {
  const onlineHandler = () => {
    if (navigator.onLine) {
      requestBackgroundSync()
      syncNow(onProgress)
    }
  }

  const visibilityHandler = () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      syncNow(onProgress)
    }
  }

  // Listen for SW sync completion messages
  const swMessageHandler = (event: MessageEvent) => {
    if (event.data?.type === 'SYNC_COMPLETE') {
      const { synced, total } = event.data
      console.log(`[SW] Background sync complete: ${synced}/${total} clips uploaded`)
    }
  }

  window.addEventListener('online', onlineHandler)
  document.addEventListener('visibilitychange', visibilityHandler)
  navigator.serviceWorker?.addEventListener('message', swMessageHandler)

  return () => {
    window.removeEventListener('online', onlineHandler)
    document.removeEventListener('visibilitychange', visibilityHandler)
    navigator.serviceWorker?.removeEventListener('message', swMessageHandler)
  }
}
