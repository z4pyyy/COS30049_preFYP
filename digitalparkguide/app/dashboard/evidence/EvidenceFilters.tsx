'use client'

interface FilterState {
  status: string[]
  detectionType: string[]
  trackId: string
}

interface TrackOption {
  id: string
  title: string
  tpa_name: string
}

const STATUS_OPTIONS = [
  { value: 'pending_review', label: 'Pending' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'flagged', label: 'Flagged' },
  { value: 'dismissed', label: 'Dismissed' },
]

const DETECTION_TYPES = [
  { value: 'hand_near_flower', label: 'Hand Near Flower' },
  { value: 'hand_near_wildlife', label: 'Hand Near Wildlife' },
]

export default function EvidenceFilters({
  filters,
  tracks,
  showTrackFilter,
  onChange,
  onClose,
}: {
  filters: FilterState
  tracks: TrackOption[]
  showTrackFilter: boolean
  onChange: (f: FilterState) => void
  onClose: () => void
}) {
  function toggleStatus(val: string) {
    const next = filters.status.includes(val)
      ? filters.status.filter(s => s !== val)
      : [...filters.status, val]
    onChange({ ...filters, status: next })
  }

  function toggleDetectionType(val: string) {
    const next = filters.detectionType.includes(val)
      ? filters.detectionType.filter(s => s !== val)
      : [...filters.detectionType, val]
    onChange({ ...filters, detectionType: next })
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div
        className="w-80 bg-surface shadow-2xl h-full overflow-y-auto border-l border-outline-variant/20 p-6 flex flex-col gap-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-tight text-on-surface">Filters</h3>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Status */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-secondary mb-2">Status</p>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => toggleStatus(opt.value)}
                className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border transition-colors ${
                  filters.status.includes(opt.value)
                    ? 'bg-primary text-white border-primary'
                    : 'bg-surface-container text-on-surface-variant border-outline-variant/30 hover:border-primary'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Detection type */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-secondary mb-2">Detection Type</p>
          <div className="flex flex-wrap gap-2">
            {DETECTION_TYPES.map(opt => (
              <button
                key={opt.value}
                onClick={() => toggleDetectionType(opt.value)}
                className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border transition-colors ${
                  filters.detectionType.includes(opt.value)
                    ? 'bg-primary text-white border-primary'
                    : 'bg-surface-container text-on-surface-variant border-outline-variant/30 hover:border-primary'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* TPA filter */}
        {showTrackFilter && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-secondary mb-2">TPA</p>
            <select
              value={filters.trackId}
              onChange={e => onChange({ ...filters, trackId: e.target.value })}
              className="w-full h-10 bg-surface-container-high text-on-surface rounded-xl px-3 text-sm font-medium border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All TPAs</option>
              {tracks.map(t => (
                <option key={t.id} value={t.id}>{t.tpa_name} — {t.title}</option>
              ))}
            </select>
          </div>
        )}

        {/* Clear */}
        <button
          onClick={() => onChange({ status: [], detectionType: [], trackId: '' })}
          className="mt-auto h-10 bg-surface-container text-on-surface-variant rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-surface-container-high transition-colors"
        >
          Clear all filters
        </button>
      </div>
    </div>
  )
}
