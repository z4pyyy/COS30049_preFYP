'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { getAllClips, removeFromQueue, markForDeletion, type LocalEvidenceClip } from '@/lib/evidenceQueue'
import { syncOneById, syncNow } from '@/lib/evidenceSync'

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function detectionLabel(type: string): string {
  switch (type) {
    case 'hand_near_flower': return 'Hand Near Flower'
    case 'hand_near_wildlife': return 'Hand Near Wildlife'
    default: return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }
}

function statusPill(status: LocalEvidenceClip['syncStatus']) {
  switch (status) {
    case 'pending':
      return { label: 'Queued', cls: 'bg-amber-100 text-amber-800' }
    case 'uploading':
      return { label: 'Uploading…', cls: 'bg-blue-100 text-blue-800' }
    case 'synced':
      return { label: 'Uploaded', cls: 'bg-green-100 text-green-800' }
    case 'failed':
      return { label: 'Failed', cls: 'bg-red-100 text-red-800' }
  }
}

export default function ClipQueuePanel() {
  const [clips, setClips] = useState<LocalEvidenceClip[]>([])
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const thumbUrls = useRef<Map<string, string>>(new Map())

  const refresh = useCallback(async () => {
    const all = await getAllClips()
    setClips(all.filter(c => !c.markedForDeletion))
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 3000)
    return () => clearInterval(id)
  }, [refresh])

  useEffect(() => {
    return () => {
      thumbUrls.current.forEach(url => URL.revokeObjectURL(url))
    }
  }, [])

  function getThumbnailUrl(clip: LocalEvidenceClip): string {
    const existing = thumbUrls.current.get(clip.localQueueId)
    if (existing) return existing
    if (!clip.thumbnailBlob) return ''
    const url = URL.createObjectURL(clip.thumbnailBlob)
    thumbUrls.current.set(clip.localQueueId, url)
    return url
  }

  async function handleDiscard(clip: LocalEvidenceClip) {
    if (busy.has(clip.localQueueId)) return
    setBusy(prev => new Set(prev).add(clip.localQueueId))

    try {
      if (clip.syncStatus === 'uploading') {
        await markForDeletion(clip.localQueueId)
      } else if (clip.syncStatus === 'synced') {
        await fetch(`/api/evidence/${clip.localQueueId}`, { method: 'DELETE' })
        await removeFromQueue(clip.localQueueId)
      } else {
        await removeFromQueue(clip.localQueueId)
      }
      const url = thumbUrls.current.get(clip.localQueueId)
      if (url) { URL.revokeObjectURL(url); thumbUrls.current.delete(clip.localQueueId) }
      await refresh()
    } finally {
      setBusy(prev => { const n = new Set(prev); n.delete(clip.localQueueId); return n })
    }
  }

  async function handleUploadOne(clip: LocalEvidenceClip) {
    if (busy.has(clip.localQueueId)) return
    setBusy(prev => new Set(prev).add(clip.localQueueId))
    try {
      await syncOneById(clip.localQueueId)
      await refresh()
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setBusy(prev => { const n = new Set(prev); n.delete(clip.localQueueId); return n })
    }
  }

  async function handleUploadAll() {
    setBusy(new Set(clips.filter(c => c.syncStatus === 'pending' || c.syncStatus === 'failed').map(c => c.localQueueId)))
    try {
      await syncNow(undefined, true)
      await refresh()
    } finally {
      setBusy(new Set())
    }
  }

  if (clips.length === 0) return null

  const pendingCount = clips.filter(c => c.syncStatus === 'pending' || c.syncStatus === 'failed').length

  return (
    <div className="w-full">
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between bg-surface-container-high rounded-xl px-4 py-3 hover:bg-surface-container-highest transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-on-surface-variant">
            {expanded ? 'expand_less' : 'expand_more'}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">
            Clip Queue
          </span>
          <span className="inline-flex items-center justify-center min-w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold px-1.5">
            {clips.length}
          </span>
        </div>
        {pendingCount > 0 && (
          <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600">
            {pendingCount} pending
          </span>
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="mt-2 space-y-2">
          {/* Upload All button */}
          {pendingCount > 0 && (
            <button
              onClick={handleUploadAll}
              disabled={busy.size > 0}
              className="w-full h-10 bg-primary/10 text-primary rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-primary/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-sm">cloud_upload</span>
              Upload all ({pendingCount})
            </button>
          )}

          {/* Clip cards */}
          <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
            {clips.map(clip => {
              const pill = statusPill(clip.syncStatus)
              const isBusy = busy.has(clip.localQueueId)
              const thumbUrl = getThumbnailUrl(clip)

              return (
                <div
                  key={clip.localQueueId}
                  className="flex gap-3 bg-surface-container rounded-xl p-3"
                >
                  {/* Thumbnail */}
                  <div className="w-16 h-12 rounded-lg overflow-hidden bg-surface-container-highest shrink-0">
                    {thumbUrl ? (
                      <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-outline text-sm">videocam</span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-on-surface truncate">
                        {detectionLabel(clip.detectionType)}
                      </p>
                      <span className="text-[10px] font-bold text-on-surface-variant">
                        {(clip.confidenceScore * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${pill.cls}`}>
                        {pill.label}
                      </span>
                      <span className="text-[10px] text-on-surface-variant">
                        {relativeTime(clip.detectedAt)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {(clip.syncStatus === 'pending' || clip.syncStatus === 'failed') && (
                      <button
                        onClick={() => handleUploadOne(clip)}
                        disabled={isBusy}
                        title="Upload"
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-primary hover:bg-primary/10 transition-colors disabled:opacity-40"
                      >
                        <span className={`material-symbols-outlined text-base ${isBusy ? 'animate-spin' : ''}`}>
                          {isBusy ? 'progress_activity' : 'cloud_upload'}
                        </span>
                      </button>
                    )}
                    <button
                      onClick={() => handleDiscard(clip)}
                      disabled={isBusy}
                      title="Discard"
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-error hover:bg-error/10 transition-colors disabled:opacity-40"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
