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
  session_id: string | null
  training_tracks: { id: string; title: string; tpa_name: string } | null
  profiles: { full_name: string } | null
}

interface SessionGroup {
  sessionId: string
  clips: EvidenceClip[]
  firstDetected: string
  pendingCount: number
}

interface FilterState {
  status: string[]
  detectionType: string[]
  trackId: string
}

type Role = 'GUIDE' | 'SENIOR_GUIDE' | 'HOD' | 'SUPERADMIN'

function groupBySession(clips: EvidenceClip[]): SessionGroup[] {
  const map = new Map<string, EvidenceClip[]>()

  for (const clip of clips) {
    const key = clip.session_id || clip.id
    const group = map.get(key) || []
    group.push(clip)
    map.set(key, group)
  }

  const groups: SessionGroup[] = []
  for (const [sessionId, sessionClips] of map) {
    sessionClips.sort((a, b) => a.duration_seconds - b.duration_seconds)
    const times = sessionClips.map(c => new Date(c.detected_at).getTime())
    groups.push({
      sessionId,
      clips: sessionClips,
      firstDetected: new Date(Math.min(...times)).toISOString(),
      pendingCount: sessionClips.filter(c => c.status === 'pending_review').length,
    })
  }

  groups.sort((a, b) => new Date(b.firstDetected).getTime() - new Date(a.firstDetected).getTime())
  return groups
}

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
  const [collapsedSessions, setCollapsedSessions] = useState<Set<string>>(new Set())

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

  function toggleSession(sessionId: string) {
    setCollapsedSessions(prev => {
      const next = new Set(prev)
      if (next.has(sessionId)) next.delete(sessionId)
      else next.add(sessionId)
      return next
    })
  }

  const showGuide = role === 'SENIOR_GUIDE' || role === 'HOD' || role === 'SUPERADMIN'
  const canUpdateStatus = showGuide
  const showTrackFilter = role === 'HOD' || role === 'SUPERADMIN'
  const pendingCount = clips.filter(c => c.status === 'pending_review').length
  const sessions = groupBySession(clips)

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
              <>
                {sessions.length} session{sessions.length !== 1 ? 's' : ''} · {clips.length} clip{clips.length !== 1 ? 's' : ''}
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

      {/* Sessions */}
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
        <div className="space-y-4">
          {sessions.map(session => {
            const collapsed = collapsedSessions.has(session.sessionId)
            const isRealSession = session.clips.length > 1 || !!session.clips[0]?.session_id

            return (
              <div key={session.sessionId} className="bg-white rounded-2xl border border-outline-variant/20 overflow-hidden shadow-sm">
                {/* Session header — collapsible */}
                <button
                  onClick={() => toggleSession(session.sessionId)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-container/50 transition-colors text-left"
                >
                  <span
                    className="material-symbols-outlined text-sm text-on-surface-variant transition-transform"
                    style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
                  >
                    expand_more
                  </span>
                  <span className="material-symbols-outlined text-lg text-[#2D6A3F]">
                    {isRealSession ? 'folder' : 'videocam'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-on-surface">
                      {isRealSession ? 'Monitoring Session' : 'Clip'}{' '}
                      <span className="font-normal text-on-surface-variant">
                        — {new Date(session.firstDetected).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-[10px] text-on-surface-variant flex items-center gap-3 mt-0.5">
                      <span>{session.clips.length} violation{session.clips.length !== 1 ? 's' : ''}</span>
                      {session.pendingCount > 0 && (
                        <span className="text-blue-600 font-bold">{session.pendingCount} pending</span>
                      )}
                      {showGuide && session.clips[0]?.profiles && (
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">person</span>
                          {session.clips[0].profiles.full_name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant px-2 py-1 bg-surface-container rounded-lg whitespace-nowrap">
                    {session.clips.reduce((sum, c) => sum + c.duration_seconds, 0)}s total
                  </div>
                </button>

                {/* Clips inside session */}
                {!collapsed && (
                  <div className="border-t border-outline-variant/10 px-4 pb-4 pt-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {session.clips.map(clip => (
                        <EvidenceCard
                          key={clip.id}
                          clip={clip}
                          showGuide={showGuide && !isRealSession}
                          onClick={() => setSelectedClip(clip)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

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
        </div>
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
