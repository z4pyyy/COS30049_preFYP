import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { hasMinRole, type AppRole } from '@/types/roles'
import { EnrollButton } from '@/components/EnrollButton'

interface TrainingTrack {
  id: string
  title: string
  tpa_name: string
  track_type: string
  overview: string | null
  duration_weeks: number | null
  eligibility: string | null
  is_open: boolean
  module_count: number
}

interface Enrollment {
  track_id: string
  status: string
}

const TRACK_BADGE: Record<string, { bg: string; text: string; icon: string }> = {
  GUIDE:        { bg: 'bg-[#dcfce7]', text: 'text-[#15803d]', icon: 'hiking' },
  SENIOR_GUIDE: { bg: 'bg-[#e0f2fe]', text: 'text-[#0369a1]', icon: 'military_tech' },
  RANGER:       { bg: 'bg-[#fef9c3]', text: 'text-[#854d0e]', icon: 'shield' },
}

export default async function GuideTracksPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/training/tracks')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !hasMinRole(profile.role as unknown as AppRole, 'GUIDE')) redirect('/unauthorized')

  // Fetch all active, non-archived tracks
  const { data: rawTracks } = await supabase
    .from('training_tracks')
    .select('id, title, tpa_name, track_type, overview, duration_weeks, eligibility, is_open')
    .eq('is_archived', false)
    .order('tpa_name')
    .order('title')

  const tracks = (rawTracks || []) as TrainingTrack[]

  // Fetch module counts per track
  const { data: moduleCounts } = await supabase
    .from('training_modules')
    .select('track_id')
    .eq('is_active', true)
    .eq('is_archived', false)

  const countMap = (moduleCounts || []).reduce<Record<string, number>>((acc, m) => {
    acc[m.track_id] = (acc[m.track_id] ?? 0) + 1
    return acc
  }, {})

  tracks.forEach(t => { t.module_count = countMap[t.id] ?? 0 })

  // Fetch guide's current enrollments
  const { data: enrollments } = await supabase
    .from('guide_track_enrollments')
    .select('track_id, status')
    .eq('guide_id', user.id)

  const enrolledIds = new Set((enrollments as Enrollment[] | null || []).map(e => e.track_id))

  // Group by TPA
  const byTpa = tracks.reduce<Record<string, TrainingTrack[]>>((acc, t) => {
    ;(acc[t.tpa_name] ??= []).push(t)
    return acc
  }, {})

  const enrolledCount = enrolledIds.size

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[#8DC63F]">Guide Portal</p>
            <h1 className="text-4xl font-black text-[#1B3A24] mt-3">Training Tracks</h1>
            <p className="text-[#64748b] mt-3 max-w-2xl">
              Activate a training track to unlock its modules. Each track is tied to a specific
              Totally Protected Area (TPA) and certification level.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {enrolledCount > 0 && (
              <Link
                href="/training/modules"
                className="inline-flex items-center gap-2 rounded-full bg-[#1B3A24] px-5 py-3 text-sm font-semibold text-white hover:bg-[#2D6A3F] transition"
              >
                <span className="material-symbols-outlined text-sm">school</span>
                My Modules
              </Link>
            )}
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-full border border-[#cbd5e1] bg-white px-5 py-3 text-sm font-semibold text-[#1B3A24] hover:border-[#94a3b8] transition"
            >
              ← Dashboard
            </Link>
          </div>
        </div>

        {/* Summary strip */}
        {enrolledCount > 0 && (
          <div className="mb-8 rounded-2xl bg-[#1B3A24] px-6 py-4 flex items-center gap-4 text-white">
            <span className="material-symbols-outlined text-[#8DC63F] text-2xl">verified</span>
            <div>
              <p className="font-bold text-sm">
                {enrolledCount} active track{enrolledCount !== 1 ? 's' : ''}
              </p>
              <p className="text-[#8DC63F] text-xs">
                Your modules are unlocked — head to My Modules to continue learning.
              </p>
            </div>
          </div>
        )}

        {Object.keys(byTpa).length === 0 ? (
          <div className="rounded-3xl bg-white p-12 shadow-lg text-center">
            <span className="material-symbols-outlined text-5xl text-[#cbd5e1] mb-4 block">landscape</span>
            <h2 className="text-2xl font-bold text-[#1B3A24] mb-2">No tracks available</h2>
            <p className="text-[#64748b]">Your HoD has not published any training tracks yet.</p>
          </div>
        ) : (
          Object.entries(byTpa).map(([tpa, tpaTracks]) => (
            <section key={tpa} className="mb-12">
              <div className="mb-4 flex items-center gap-3">
                <span className="material-symbols-outlined text-[#2D6A3F] text-3xl">landscape</span>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[#8DC63F]">TPA</p>
                  <h2 className="text-2xl font-bold text-[#1B3A24]">{tpa}</h2>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {tpaTracks.map(track => {
                  const badge = TRACK_BADGE[track.track_type] ?? TRACK_BADGE.GUIDE
                  const isEnrolled = enrolledIds.has(track.id)

                  return (
                    <article
                      key={track.id}
                      className={`rounded-3xl border bg-white p-6 shadow-sm transition-all ${
                        isEnrolled
                          ? 'border-[#86efac] ring-1 ring-[#86efac]'
                          : 'border-[#e2e8f0] hover:shadow-md'
                      }`}
                    >
                      {/* Top row */}
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${badge.bg} ${badge.text}`}>
                          <span className="material-symbols-outlined text-xs">{badge.icon}</span>
                          {track.track_type.replace('_', ' ')}
                        </span>
                        {!track.is_open && (
                          <span className="text-xs font-bold text-[#94a3b8] bg-[#f1f5f9] px-2 py-1 rounded-full">
                            Closed
                          </span>
                        )}
                      </div>

                      <h3 className="text-xl font-bold text-[#1B3A24] mb-2">{track.title}</h3>

                      {track.overview && (
                        <p className="text-[#475569] text-sm leading-relaxed mb-4 line-clamp-2">
                          {track.overview}
                        </p>
                      )}

                      {/* Meta */}
                      <div className="flex flex-wrap gap-3 text-xs text-[#64748b] mb-5">
                        {track.duration_weeks != null && (
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">schedule</span>
                            {track.duration_weeks} week{track.duration_weeks !== 1 ? 's' : ''}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">menu_book</span>
                          {track.module_count} module{track.module_count !== 1 ? 's' : ''}
                        </span>
                        {track.eligibility && (
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">checklist</span>
                            {track.eligibility}
                          </span>
                        )}
                      </div>

                      {/* Action */}
                      <div className="flex items-center gap-3">
                        <EnrollButton trackId={track.id} enrolled={isEnrolled} />
                        {isEnrolled && (
                          <Link
                            href={`/training/modules?tpa=${encodeURIComponent(tpa)}`}
                            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2D6A3F] hover:text-[#1B3A24] transition"
                          >
                            View Modules
                            <span className="material-symbols-outlined text-sm">arrow_forward</span>
                          </Link>
                        )}
                      </div>
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
