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
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6">
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
      </div>
    )
  }

  // Fetch non-archived TPA names for enrolled tracks only (for filter dropdown)
  const { data: enrolledTracks } = await supabase
    .from('training_tracks')
    .select('tpa_name')
    .in('id', [...enrolledTrackIds])
    .eq('is_archived', false)
    .order('tpa_name')

  const availableTpas = Array.from(new Set((enrolledTracks || []).map(t => t.tpa_name).filter(Boolean)))

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

  if (modulesError) {
    return (
      <div className="min-h-screen bg-[#f8fafc] py-16 px-6">
        <div className="max-w-4xl mx-auto rounded-3xl bg-white p-10 shadow-lg">
          <h1 className="text-3xl font-bold text-[#1B3A24] mb-4">Training Modules</h1>
          <p className="text-[#64748b]">Unable to load modules right now. Please try again later.</p>
        </div>
      </div>
    )
  }

  const modules = (rawModules as unknown as TrainingModule[]) || []

  // Filter by TPA if selected
  const filtered = tpaFilter
    ? modules.filter(m => m.training_tracks?.tpa_name === tpaFilter)
    : modules

  // Group by TPA
  const groupedByTpa = filtered.reduce<Record<string, TrainingModule[]>>((acc, module) => {
    const tpa = module.training_tracks?.tpa_name || 'Unknown TPA'
    ;(acc[tpa] ??= []).push(module)
    return acc
  }, {})

  // Sequential lock: must complete previous module in same track
  const byTrack = modules.reduce<Record<string, TrainingModule[]>>((acc, m) => {
    ;(acc[m.track_id] ??= []).push(m)
    return acc
  }, {})

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
  const trackProgress = Object.entries(byTrack).map(([trackId, mods]) => {
    const completed = mods.filter(m => progressMap.get(m.id)?.completed).length
    return { trackId, completed, total: mods.length }
  })

  const statusBadge: Record<string, { label: string; cls: string; icon: string }> = {
    completed:   { label: 'Completed',   cls: 'bg-[#dcfce7] text-[#15803d]', icon: 'verified' },
    in_progress: { label: 'In Progress', cls: 'bg-[#fef9c3] text-[#854d0e]', icon: 'pending' },
    not_started: { label: 'Not Started', cls: 'bg-[#f1f5f9] text-[#64748b]', icon: 'radio_button_unchecked' },
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-[#8DC63F]">Guide Portal</p>
              <h1 className="text-4xl font-black text-[#1B3A24] mt-3">Training Modules</h1>
              <p className="text-[#64748b] mt-3 max-w-2xl">
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
        </div>

        {/* Track progress summary */}
        {trackProgress.length > 0 && (
          <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {trackProgress.map(({ trackId, completed, total }) => {
              const track = modules.find(m => m.track_id === trackId)?.training_tracks
              if (!track) return null
              const pct = total > 0 ? Math.round((completed / total) * 100) : 0
              return (
                <div key={trackId} className="bg-white rounded-2xl border border-[#e2e8f0] p-4">
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
            <select
              name="tpa"
              defaultValue={tpaFilter}
              className="w-full rounded-xl border border-[#cbd5e1] bg-white px-4 py-3 text-[#1B3A24]"
            >
              <option value="">All My TPAs</option>
              {availableTpas.map(tpa => (
                <option key={tpa} value={tpa}>{tpa}</option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-xl bg-[#2D6A3F] px-5 py-3 text-sm font-semibold text-white hover:bg-[#1B3A24] transition"
            >
              Apply Filter
            </button>
          </div>
        </form>

        {Object.keys(groupedByTpa).length === 0 ? (
          <div className="rounded-3xl bg-white p-12 shadow-lg text-center">
            <span className="material-symbols-outlined text-5xl text-[#cbd5e1] mb-4 block">school</span>
            <h2 className="text-2xl font-bold text-[#1B3A24] mb-3">No modules found</h2>
            <p className="text-[#64748b]">No active modules for the selected TPA.</p>
          </div>
        ) : (
          Object.entries(groupedByTpa).map(([tpa, tpaModules]) => (
            <section key={tpa} className="mb-10">
              <div className="mb-4 flex items-center gap-3">
                <span className="material-symbols-outlined text-[#2D6A3F] text-3xl">landscape</span>
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-[#8DC63F]">{tpa}</p>
                  <h2 className="text-2xl font-bold text-[#1B3A24]">Modules for {tpa}</h2>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {tpaModules.map(module => {
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
                        <span className="rounded-full bg-[#e0f2fe] px-3 py-1 text-xs font-semibold text-[#0369a1]">
                          {module.training_tracks?.title || 'Unknown Track'}
                        </span>
                      </div>

                      <h3 className="text-xl font-semibold text-[#1B3A24] mb-2">
                        {module.order_index > 0 && (
                          <span className="text-sm text-[#94a3b8] font-normal mr-1">#{module.order_index + 1}</span>
                        )}
                        {module.title}
                      </h3>
                      <p className="text-[#475569] leading-relaxed mb-4 line-clamp-2 text-sm">{module.description}</p>

                      {module.duration_hours != null && (
                        <p className="text-xs text-[#64748b] mb-4 flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">schedule</span>
                          {module.duration_hours} hour{module.duration_hours === 1 ? '' : 's'}
                        </p>
                      )}

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
            </section>
          ))
        )}
      </main>
    </div>
  )
}
