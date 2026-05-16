'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import EvidenceCard from './EvidenceCard'
import EvidenceModal from './EvidenceModal'
import EvidenceFilters from './EvidenceFilters'

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

interface FilterState {
  status: string[]
  detectionType: string[]
  trackId: string
}

type Role = 'GUIDE' | 'SENIOR_GUIDE' | 'HOD' | 'SUPERADMIN'

export default function EvidencePage() {
  const [clips, setClips] = useState<EvidenceClip[]>([])
  const [loading, setLoading] = useState(true)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [selectedClip, setSelectedClip] = useState<EvidenceClip | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<FilterState>({ status: [], detectionType: [], trackId: '' })
  const [role, setRole] = useState<Role | null>(null)
  const [tracks, setTracks] = useState<{ id: string; title: string; tpa_name: string }[]>([])

  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      if (profile) setRole(profile.role as Role)

      const { data: trackData } = await supabase
        .from('training_tracks')
        .select('id, title, tpa_name')
        .order('tpa_name')
      if (trackData) setTracks(trackData)
    })()
  }, [])

  const fetchClips = useCallback(async (cursor?: string) => {
    const params = new URLSearchParams()
    if (filters.status.length) params.set('status', filters.status.join(','))
    if (filters.detectionType.length) params.set('detectionType', filters.detectionType.join(','))
    if (filters.trackId) params.set('trackId', filters.trackId)
    if (cursor) params.set('cursor', cursor)

    const res = await fetch(`/api/evidence?${params}`)
    if (!res.ok) return { clips: [], nextCursor: null }
    return res.json()
  }, [filters])

  useEffect(() => {
    setLoading(true)
    fetchClips().then(data => {
      setClips(data.clips ?? [])
      setNextCursor(data.nextCursor ?? null)
      setLoading(false)
    })
  }, [fetchClips])

  async function loadMore() {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    const data = await fetchClips(nextCursor)
    setClips(prev => [...prev, ...(data.clips ?? [])])
    setNextCursor(data.nextCursor ?? null)
    setLoadingMore(false)
  }

  function handleStatusUpdate(id: string, newStatus: string) {
    setClips(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c))
    if (selectedClip?.id === id) setSelectedClip({ ...selectedClip, status: newStatus })
  }

  const showGuide = role === 'SENIOR_GUIDE' || role === 'HOD' || role === 'SUPERADMIN'
  const canUpdateStatus = showGuide
  const showTrackFilter = role === 'HOD' || role === 'SUPERADMIN'
  const pendingCount = clips.filter(c => c.status === 'pending_review').length

  return (
    <section className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-[#1B3A24]">
            Evidence Review
          </h1>
          <p className="text-sm text-[#64748b] mt-1">
            {loading ? 'Loading…' : (
              <>Showing {clips.length} clip{clips.length !== 1 ? 's' : ''}
              {pendingCount > 0 && <> · <span className="text-blue-600 font-bold">{pendingCount} pending review</span></>}
              </>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowFilters(true)}
          className="h-10 px-4 bg-surface-container-high text-on-surface-variant rounded-xl font-bold uppercase tracking-widest text-xs flex items-center gap-2 hover:bg-surface-container-highest transition-colors border border-outline-variant/30"
        >
          <span className="material-symbols-outlined text-sm">filter_list</span>
          Filter
          {(filters.status.length > 0 || filters.detectionType.length > 0 || filters.trackId) && (
            <span className="w-2 h-2 bg-primary rounded-full" />
          )}
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <span className="material-symbols-outlined animate-spin text-[#2D6A3F] text-4xl">progress_activity</span>
        </div>
      ) : clips.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-[#e2e8f0] p-12 text-center">
          <span className="material-symbols-outlined text-5xl text-gray-300 mb-3 block">videocam_off</span>
          <h2 className="text-xl font-bold text-gray-700 mb-2">No evidence clips found</h2>
          <p className="text-gray-500">Clips appear here after detection and sync from monitoring sessions.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {clips.map(clip => (
              <EvidenceCard
                key={clip.id}
                clip={clip}
                showGuide={showGuide}
                onClick={() => setSelectedClip(clip)}
              />
            ))}
          </div>

          {nextCursor && (
            <div className="flex justify-center pt-4">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="h-10 px-6 bg-primary text-white rounded-xl font-bold uppercase tracking-widest text-xs hover:opacity-90 disabled:opacity-60 flex items-center gap-2"
              >
                {loadingMore ? (
                  <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                ) : (
                  'Load more'
                )}
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal */}
      {selectedClip && (
        <EvidenceModal
          clip={selectedClip}
          canUpdateStatus={canUpdateStatus}
          onClose={() => setSelectedClip(null)}
          onStatusUpdate={handleStatusUpdate}
        />
      )}

      {/* Filters drawer */}
      {showFilters && (
        <EvidenceFilters
          filters={filters}
          tracks={tracks}
          showTrackFilter={showTrackFilter}
          onChange={setFilters}
          onClose={() => setShowFilters(false)}
        />
      )}
    </section>
  )
}
