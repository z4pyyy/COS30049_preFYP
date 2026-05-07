'use client'

interface EvidenceClip {
  id: string
  guide_id: string
  track_id: string | null
  tpa_label: string | null
  thumbnail_url: string | null
  detected_at: string
  duration_seconds: number
  detection_type: string
  confidence_score: number
  status: string
  training_tracks: { id: string; title: string; tpa_name: string } | null
  profiles: { full_name: string } | null
}

const STATUS_STYLES: Record<string, string> = {
  pending_review: 'bg-blue-100 text-blue-800',
  reviewed: 'bg-green-100 text-green-800',
  flagged: 'bg-red-100 text-red-800',
  dismissed: 'bg-gray-100 text-gray-500',
}

const STATUS_LABELS: Record<string, string> = {
  pending_review: 'Pending',
  reviewed: 'Reviewed',
  flagged: 'Flagged',
  dismissed: 'Dismissed',
}

function confidenceColor(score: number) {
  if (score >= 0.9) return 'text-green-600'
  if (score >= 0.7) return 'text-amber-600'
  return 'text-red-600'
}

function formatDetectionType(type: string) {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export default function EvidenceCard({
  clip,
  showGuide,
  onClick,
}: {
  clip: EvidenceClip
  showGuide: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-surface-container rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:scale-[1.01] transition-all group"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-surface-container-highest">
        {clip.thumbnail_url ? (
          <img
            src={clip.thumbnail_url}
            alt="Evidence thumbnail"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="material-symbols-outlined text-outline text-3xl">videocam_off</span>
          </div>
        )}
        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
          <span className="material-symbols-outlined text-white text-4xl">play_circle</span>
        </div>
        {/* Duration badge */}
        <div className="absolute bottom-2 left-2 bg-black/70 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
          {formatDuration(clip.duration_seconds)}
        </div>
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-on-surface truncate">
            {formatDetectionType(clip.detection_type)}
          </span>
          <span className={`text-xs font-black ${confidenceColor(clip.confidence_score)}`}>
            {(clip.confidence_score * 100).toFixed(1)}%
          </span>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-on-surface-variant">
          <span title={new Date(clip.detected_at).toLocaleString()}>
            {timeAgo(clip.detected_at)}
          </span>
          {(clip.training_tracks || clip.tpa_label) && (
            <>
              <span>·</span>
              <span className="truncate">{clip.training_tracks?.tpa_name ?? clip.tpa_label}</span>
            </>
          )}
        </div>

        {showGuide && clip.profiles && (
          <div className="text-[10px] text-on-surface-variant flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">person</span>
            {clip.profiles.full_name}
          </div>
        )}

        <div className="mt-1">
          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${STATUS_STYLES[clip.status] ?? STATUS_STYLES.pending_review}`}>
            {STATUS_LABELS[clip.status] ?? clip.status}
          </span>
        </div>
      </div>
    </button>
  )
}
