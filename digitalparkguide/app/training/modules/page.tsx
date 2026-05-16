import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasMinRole, type AppRole } from '@/types/roles'

export const metadata: Metadata = {
  title: 'Guide Training Modules',
  description: 'Browse guide training modules by Totally Protected Area (TPA) and certification track.',
}

interface TrainingModule {
  id: string
  title: string
  description: string
  order_index: number
  duration_hours: number | null
  track_id: string
  training_tracks?: { id: string; title: string; tpa_name: string; track_type: string } | null
}

interface TrainingTrackLite {
  id: string
  title: string
  tpa_name: string
  track_type: string
}

interface ProgressRecord {
  module_id: string
  completed: boolean
  assets_consumed: string[]
}

export default async function GuideTrainingModulesPage({
  searchParams,
}: {
  searchParams?: Promise<{ tpa?: string }>
}) {
  const sp = await searchParams
  const tpaFilter = sp?.tpa || ''
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/training/modules${tpaFilter ? `?tpa=${encodeURIComponent(tpaFilter)}` : ''}`)

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !hasMinRole(profile.role as unknown as AppRole, 'GUIDE')) redirect('/unauthorized')

  // Fetch guide's enrolled track IDs
  const { data: enrollments } = await supabase
    .from('guide_track_enrollments')
    .select('track_id')
    .eq('guide_id', user.id)
    .eq('status', 'active')

  const enrolledTrackIds = new Set((enrollments || []).map(e => e.track_id))

  // No enrollments → send to tracks page to enroll first
  if (enrolledTrackIds.size === 0) {
    return (
      <section className="p-4 sm:p-6 lg:p-8 flex flex-1 items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-3xl border border-[#e2e8f0] p-10 shadow-sm text-center">
          <span className="material-symbols-outlined text-5xl text-[#cbd5e1] mb-4 block">lock</span>
          <h2 className="text-2xl font-black text-[#1B3A24] mb-3">No Active Tracks</h2>
          <p className="text-[#64748b] text-sm mb-6">
            You need to activate at least one training track before modules become available.
          </p>
          <Link
            href="/training/tracks"
            className="inline-flex items-center gap-2 rounded-xl bg-[#1B3A24] px-6 py-3 font-semibold text-white hover:bg-[#2D6A3F] transition"
          >
            <span className="material-symbols-outlined text-sm">add_circle</span>
            Browse & Activate Tracks
          </Link>
        </div>
      </section>
    )
  }

  // Fetch full track info for enrolled tracks (drives per-track section rendering)
  const { data: enrolledTracksRaw } = await supabase
    .from('training_tracks')
    .select('id, title, tpa_name, track_type')
    .in('id', [...enrolledTrackIds])
    .eq('is_archived', false)
    .order('tpa_name')
    .order('title')

  const enrolledTracks: TrainingTrackLite[] = (enrolledTracksRaw || []) as TrainingTrackLite[]
  const availableTpas = Array.from(new Set(enrolledTracks.map(t => t.tpa_name).filter(Boolean)))

  // Fetch active, non-archived modules — only for enrolled tracks
  const { data: rawModules, error: modulesError } = await supabase
    .from('training_modules')
    .select('id, title, description, order_index, duration_hours, track_id, training_tracks(id, title, tpa_name, track_type)')
    .eq('is_active', true)
    .eq('is_archived', false)
    .in('track_id', [...enrolledTrackIds])
    .order('order_index', { ascending: true })

  // Fetch user's progress for all modules
  const { data: progressRecords } = await supabase
    .from('guide_module_progress')
    .select('module_id, completed, assets_consumed')
    .eq('guide_id', user.id)

  const progressMap = new Map<string, ProgressRecord>(
    (progressRecords || []).map(p => [p.module_id, p])
  )

  // Fetch which modules have quizzes (for indicator badge)
  const { data: quizModules } = await supabase
    .from('quizzes')
    .select('module_id')
  const modulesWithQuiz = new Set((quizModules ?? []).map(q => q.module_id).filter(Boolean))

  if (modulesError) {
    return (
      <section className="p-4 sm:p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-[#1B3A24]">Training Modules</h1>
        </div>
        <div className="rounded-3xl bg-white p-10 shadow-lg">
          <p className="text-[#64748b]">Unable to load modules right now. Please try again later.</p>
        </div>
      </section>
    )
  }

  const modules = (rawModules as unknown as TrainingModule[]) || []

  // Group modules by track_id, seeding empty arrays for every enrolled track so
  // tracks with zero published modules still render as a section.
  const modulesByTrack: Record<string, TrainingModule[]> = Object.fromEntries(
    enrolledTracks.map(t => [t.id, [] as TrainingModule[]])
  )
  for (const m of modules) {
    ;(modulesByTrack[m.track_id] ??= []).push(m)
  }
  // Sort modules within each track by order_index
  for (const trackId of Object.keys(modulesByTrack)) {
    modulesByTrack[trackId].sort((a, b) => a.order_index - b.order_index)
  }

  // Filter at the track level (not the module level) so per-track progress stays intact
  const visibleTracks = tpaFilter
    ? enrolledTracks.filter(t => t.tpa_name === tpaFilter)
    : enrolledTracks

  // Retain byTrack alias for isLocked below
  const byTrack = modulesByTrack

  const isLocked = (module: TrainingModule): boolean => {
    if (module.order_index === 0) return false
    const trackMods = (byTrack[module.track_id] || []).sort((a, b) => a.order_index - b.order_index)
    const idx = trackMods.findIndex(m => m.id === module.id)
    if (idx <= 0) return false
    const prev = trackMods[idx - 1]
    return !progressMap.get(prev.id)?.completed
  }

  const getStatus = (moduleId: string) => {
    const p = progressMap.get(moduleId)
    if (!p) return 'not_started'
    if (p.completed) return 'completed'
    if (p.assets_consumed?.length > 0) return 'in_progress'
    return 'not_started'
  }

  // Overall progress per track
  const progressForTrack = (trackId: string) => {
    const mods = modulesByTrack[trackId] || []
    const completed = mods.filter(m => progressMap.get(m.id)?.completed).length
    const total = mods.length
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0
    return { completed, total, pct }
  }

  const statusBadge: Record<string, { label: string; cls: string; icon: string }> = {
    completed:   { label: 'Completed',   cls: 'bg-[#dcfce7] text-[#15803d]', icon: 'verified' },
    in_progress: { label: 'In Progress', cls: 'bg-[#fef9c3] text-[#854d0e]', icon: 'pending' },
    not_started: { label: 'Not Started', cls: 'bg-[#f1f5f9] text-[#64748b]', icon: 'radio_button_unchecked' },
  }

  return (
    <section className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-[#1B3A24]">Training Modules</h1>
          <p className="text-sm text-[#64748b] mt-1">
            Your active track modules. Complete each in order to earn your park certification.
          </p>
        </div>
        <div className="flex items-center gap-3">
              <Link
                href="/training/tracks"
                className="inline-flex items-center gap-2 rounded-full border border-[#cbd5e1] bg-white px-5 py-3 text-sm font-semibold text-[#1B3A24] hover:border-[#94a3b8] transition"
              >
                <span className="material-symbols-outlined text-sm">trophy</span>
                My Tracks
              </Link>
        </div>
      </div>

      {/* Track progress summary — one chip per enrolled track */}
        {enrolledTracks.length > 0 && (
          <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {enrolledTracks.map(track => {
              const { completed, total, pct } = progressForTrack(track.id)
              return (
                <div key={track.id} className="bg-white rounded-2xl border border-[#e2e8f0] p-4">
                  <p className="text-xs text-[#8DC63F] font-bold uppercase tracking-wider mb-1">{track.tpa_name}</p>
                  <p className="font-bold text-[#1B3A24] text-sm mb-2 truncate">{track.title}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-[#e2e8f0] rounded-full overflow-hidden">
                      <div
                        className="h-2 bg-[#2D6A3F] rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-[#64748b] shrink-0">
                      {completed}/{total}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* TPA Filter */}
        <form action="/training/modules" className="mb-8">
          <label className="block text-sm font-semibold text-[#1B3A24] mb-2">Filter by TPA</label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full">
              <select
                name="tpa"
                defaultValue={tpaFilter}
                className="appearance-none w-full pl-3 pr-8 py-2 text-sm bg-white border border-[#d1d9e0] rounded-lg font-medium text-[#1B3A24] hover:border-[#2D6A3F] focus:outline-none focus:border-[#2D6A3F] focus:ring-1 focus:ring-[#2D6A3F] transition-colors cursor-pointer"
              >
                <option value="">All My TPAs</option>
                {availableTpas.map(tpa => (
                  <option key={tpa} value={tpa}>{tpa}</option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-base text-[#94a3b8] pointer-events-none" translate="no">
                expand_more
              </span>
            </div>
            <button
              type="submit"
              className="rounded-xl bg-[#2D6A3F] px-5 py-3 text-sm font-semibold text-white hover:bg-[#1B3A24] transition"
            >
              Apply Filter
            </button>
          </div>
        </form>

        {visibleTracks.length === 0 ? (
          <div className="rounded-3xl bg-white p-12 shadow-lg text-center">
            <span className="material-symbols-outlined text-5xl text-[#cbd5e1] mb-4 block">school</span>
            <h2 className="text-2xl font-bold text-[#1B3A24] mb-3">No tracks found</h2>
            <p className="text-[#64748b]">No enrolled tracks for the selected TPA.</p>
          </div>
        ) : (
          visibleTracks.map(track => {
            const trackModules = modulesByTrack[track.id] || []
            const { completed, total, pct } = progressForTrack(track.id)
            return (
              <section key={track.id} className="mb-10">
                <div className="mb-4 rounded-3xl bg-white border border-[#e2e8f0] p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-[#2D6A3F] text-3xl">landscape</span>
                      <div>
                        <p className="text-sm uppercase tracking-[0.2em] text-[#8DC63F]">{track.tpa_name}</p>
                        <h2 className="text-2xl font-bold text-[#1B3A24]">{track.title}</h2>
                      </div>
                    </div>
                    <div className="md:min-w-[240px]">
                      <div className="flex items-center justify-between text-xs font-mono text-[#64748b] mb-1">
                        <span>{completed}/{total} modules completed</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-2 bg-[#e2e8f0] rounded-full overflow-hidden">
                        <div
                          className="h-2 bg-[#2D6A3F] rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                {trackModules.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#cbd5e1] bg-white p-6 text-center">
                    <p className="text-sm text-[#64748b]">No published modules yet for this track.</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {trackModules.map(module => {
                      const status = getStatus(module.id)
                      const locked = isLocked(module)
                      const badge = statusBadge[status]

                      return (
                        <article
                          key={module.id}
                          className={`rounded-3xl border bg-white p-6 shadow-sm transition-all ${
                            locked ? 'opacity-60 border-[#e2e8f0]' : 'border-[#e2e8f0] hover:shadow-md hover:border-[#8DC63F]'
                          }`}
                        >
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              {locked && (
                                <span className="material-symbols-outlined text-[#94a3b8] text-lg" title="Complete previous module first">lock</span>
                              )}
                              <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${badge.cls}`}>
                                <span className="material-symbols-outlined text-xs">{badge.icon}</span>
                                {badge.label}
                              </span>
                            </div>
                          </div>

                          <h3 className="text-xl font-semibold text-[#1B3A24] mb-2">
                            {module.order_index > 0 && (
                              <span className="text-sm text-[#94a3b8] font-normal mr-1">#{module.order_index + 1}</span>
                            )}
                            {module.title}
                          </h3>
                          <p className="text-[#475569] leading-relaxed mb-4 line-clamp-2 text-sm">{module.description}</p>

                          <div className="flex items-center gap-3 text-xs text-[#64748b] mb-4">
                            {module.duration_hours != null && (
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs">schedule</span>
                                {module.duration_hours} hour{module.duration_hours === 1 ? '' : 's'}
                              </span>
                            )}
                            {modulesWithQuiz.has(module.id) && (
                              <span className="flex items-center gap-1 text-[#2D6A3F] font-semibold">
                                <span className="material-symbols-outlined text-xs">quiz</span>
                                Quiz
                              </span>
                            )}
                          </div>

                          {locked ? (
                            <div className="inline-flex items-center gap-2 rounded-xl border border-[#e2e8f0] px-4 py-3 text-sm font-semibold text-[#94a3b8]">
                              <span className="material-symbols-outlined text-sm">lock</span>
                              Complete previous module first
                            </div>
                          ) : (
                            <Link
                              href={`/training/modules/${module.id}`}
                              className="inline-flex items-center gap-2 rounded-xl bg-[#1B3A24] px-4 py-3 text-sm font-semibold text-white hover:bg-[#111827] transition"
                            >
                              {status === 'completed' ? 'Review Module' : status === 'in_progress' ? 'Continue' : 'Start Module'}
                              <span className="material-symbols-outlined text-sm">arrow_forward</span>
                            </Link>
                          )}
                        </article>
                      )
                    })}
                  </div>
                )}
              </section>
            )
          })
        )}
    </section>
  )
}
