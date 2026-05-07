'use client'

import { useState } from 'react'

interface EvidenceClip {
  id: string
  guide_id: string
  track_id: string | null
  tpa_label: string | null
  clip_url: string | null
  thumbnail_url: string | null
  detected_at: string
  duration_seconds: number
  detection_type: string
  confidence_score: number
  status: string
  training_tracks: { id: string; title: string; tpa_name: string } | null
  profiles: { full_name: string } | null
}

const VALID_STATUSES = ['pending_review', 'reviewed', 'flagged', 'dismissed'] as const

const STATUS_LABELS: Record<string, string> = {
  pending_review: 'Pending Review',
  reviewed: 'Reviewed',
  flagged: 'Flagged',
  dismissed: 'Dismissed',
}

function formatDetectionType(type: string) {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export default function EvidenceModal({
  clip,
  canUpdateStatus,
  onClose,
  onStatusUpdate,
}: {
  clip: EvidenceClip
  canUpdateStatus: boolean
  onClose: () => void
  onStatusUpdate: (id: string, status: string) => void
}) {
  const [updating, setUpdating] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(clip.clip_url)
  const [loadingUrl, setLoadingUrl] = useState(false)

  async function loadSignedUrl() {
    if (videoUrl || loadingUrl) return
    setLoadingUrl(true)
    try {
      const res = await fetch(`/api/evidence/${clip.id}/signed-url`)
      if (res.ok) {
        const { clipUrl } = await res.json()
        setVideoUrl(clipUrl)
      }
    } finally {
      setLoadingUrl(false)
    }
  }

  async function handleStatusChange(newStatus: string) {
    setUpdating(true)
    try {
      const res = await fetch(`/api/evidence/${clip.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) onStatusUpdate(clip.id, newStatus)
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-surface rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Video player */}
        <div className="relative aspect-video bg-black rounded-t-2xl overflow-hidden">
          {videoUrl ? (
            <video
              src={videoUrl}
              controls
              className="w-full h-full object-contain"
              autoPlay
            />
          ) : (
            <button
              onClick={loadSignedUrl}
              className="w-full h-full flex flex-col items-center justify-center gap-2 text-white/60 hover:text-white transition-colors"
            >
              {loadingUrl ? (
                <span className="material-symbols-outlined animate-spin text-3xl">progress_activity</span>
              ) : (
                <>
                  <span className="material-symbols-outlined text-5xl">play_circle</span>
                  <span className="text-sm font-bold uppercase tracking-widest">Load video</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Metadata */}
        <div className="p-6 flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <h2 className="text-lg font-black uppercase tracking-tight text-on-surface">
              {formatDetectionType(clip.detection_type)}
            </h2>
            <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-secondary block mb-0.5">
                Confidence
              </span>
              <span className="font-bold text-on-surface">
                {(clip.confidence_score * 100).toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-secondary block mb-0.5">
                Duration
              </span>
              <span className="font-bold text-on-surface">{clip.duration_seconds}s</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-secondary block mb-0.5">
                Detected at
              </span>
              <span className="font-medium text-on-surface">
                {new Date(clip.detected_at).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-secondary block mb-0.5">
                TPA
              </span>
              <span className="font-medium text-on-surface">
                {clip.training_tracks?.tpa_name ?? clip.tpa_label ?? '—'}
              </span>
            </div>
            {clip.profiles && (
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-secondary block mb-0.5">
                  Guide
                </span>
                <span className="font-medium text-on-surface">{clip.profiles.full_name}</span>
              </div>
            )}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-secondary block mb-0.5">
                Status
              </span>
              <span className="font-bold text-on-surface">{STATUS_LABELS[clip.status] ?? clip.status}</span>
            </div>
          </div>

          {/* Status update + download */}
          <div className="flex items-center gap-3 pt-2 border-t border-outline-variant/20">
            {canUpdateStatus && (
              <select
                value={clip.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={updating}
                className="flex-1 h-10 bg-surface-container-high text-on-surface rounded-xl px-3 text-sm font-medium border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
              >
                {VALID_STATUSES.map(s => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            )}
            {videoUrl && (
              <a
                href={videoUrl}
                download
                className="h-10 px-4 bg-primary text-white rounded-xl font-bold uppercase tracking-widest text-xs flex items-center gap-2 hover:opacity-90"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                Download
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
