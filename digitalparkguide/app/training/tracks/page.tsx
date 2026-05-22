import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasMinRole, type AppRole } from '@/types/roles'
import { EnrollButton } from '@/components/EnrollButton'
import PaymentStatusModal from '@/components/PaymentStatusModal'
import TrackPrerequisiteChips from '@/components/TrackPrerequisiteChips'
import BundleEnrollButton from '@/components/BundleEnrollButton'
import GeneralModulesTab from '@/components/GeneralModulesTab'
import { stripe } from '@/lib/stripe'

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
  price_myr: number
  price_per_module: number | null
  prerequisite_gm_ids: string[]
  total_price_myr: number
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

export default async function GuideTracksPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string; session_id?: string; tab?: string }>
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/training/tracks')

  const { payment, session_id, tab } = await searchParams
  const activeTab = tab === 'general-modules' ? 'general-modules' : 'tracks'

  if (payment === 'success' && session_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(session_id)
      const guide_id = session.metadata?.guide_id
      const track_id = session.metadata?.track_id
      if (guide_id && guide_id === user.id && session.payment_status === 'paid') {
        const admin = createAdminClient()

        if (track_id) {
          const { error } = await admin.from('guide_track_enrollments').upsert(
            {
              guide_id,
              track_id,
              status: 'active',
              payment_status: 'paid',
              stripe_session_id: session.id,
              paid_at: new Date().toISOString(),
            },
            { onConflict: 'guide_id,track_id' }
          )
          if (error) console.error('[stripe-redirect] enrollment upsert failed:', error.message)

          const { error: psErr } = await admin.rpc('presatisfy_track_modules', {
            p_guide_id: guide_id,
            p_track_id: track_id,
          })
          if (psErr) console.error('[stripe-redirect] presatisfy_track_modules failed:', psErr.message)
        }

        if (session.metadata?.type === 'bundle' && session.metadata?.module_ids) {
          const moduleIds = session.metadata.module_ids.split(',').filter(Boolean)
          for (const module_id of moduleIds) {
            await admin.from('general_module_enrollments').upsert(
              {
                guide_id,
                module_id,
                status: 'active',
                payment_status: 'paid',
                stripe_session_id: session.id,
                paid_at: new Date().toISOString(),
              },
              { onConflict: 'guide_id,module_id' }
            )
          }
        }

        if (session.metadata?.type === 'general_module' && session.metadata?.module_id) {
          await admin.from('general_module_enrollments').upsert(
            {
              guide_id,
              module_id: session.metadata.module_id,
              status: 'active',
              payment_status: 'paid',
              stripe_session_id: session.id,
              paid_at: new Date().toISOString(),
            },
            { onConflict: 'guide_id,module_id' }
          )
        }
      }
    } catch (err) {
      console.error('[stripe-redirect] session verify failed:', err)
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !hasMinRole(profile.role as unknown as AppRole, 'GUIDE')) redirect('/unauthorized')

  const { data: rawTracks } = await supabase
    .from('training_tracks')
    .select('id, title, tpa_name, track_type, overview, duration_weeks, eligibility, is_open, price_myr, price_per_module, prerequisite_gm_ids')
    .eq('is_archived', false)
    .order('tpa_name')
    .order('title')

  const tracks = (rawTracks || []) as TrainingTrack[]

  const { data: moduleCounts } = await supabase
    .from('training_modules')
    .select('track_id')
    .eq('is_active', true)
    .eq('is_archived', false)

  const countMap = (moduleCounts || []).reduce<Record<string, number>>((acc, m) => {
    acc[m.track_id] = (acc[m.track_id] ?? 0) + 1
    return acc
  }, {})

  tracks.forEach(t => {
    t.module_count = countMap[t.id] ?? 0
    t.total_price_myr = t.price_per_module != null
      ? t.price_per_module * t.module_count
      : (t.price_myr ?? 0)
  })

  const { data: enrollments } = await supabase
    .from('guide_track_enrollments')
    .select('track_id, status')
    .eq('guide_id', user.id)

  const enrolledIds = new Set((enrollments as Enrollment[] | null || []).map(e => e.track_id))

  // Fetch GM status for prerequisite display
  const { data: rawGms } = await supabase
    .from('general_modules')
    .select('id, title, price_myr, general_module_completions!left(completed_at), general_module_enrollments!left(payment_status)')
    .eq('is_active', true)
    .order('order_index', { ascending: true })

  const gmStatusMap = new Map<string, {
    title: string
    price_myr: number
    completed: boolean
    completed_at: string | null
    enrolled: boolean
    paid: boolean
  }>()

  for (const gm of rawGms ?? []) {
    const completions = gm.general_module_completions as Array<{ completed_at: string }> | null
    const enrollmentRows = gm.general_module_enrollments as Array<{ payment_status: string }> | null
    gmStatusMap.set(gm.id, {
      title: gm.title,
      price_myr: gm.price_myr ?? 0,
      completed: Array.isArray(completions) && completions.length > 0,
      completed_at: Array.isArray(completions) && completions.length > 0 ? completions[0].completed_at : null,
      enrolled: Array.isArray(enrollmentRows) && enrollmentRows.length > 0,
      paid: Array.isArray(enrollmentRows) && enrollmentRows.some(e => e.payment_status === 'paid'),
    })
  }

  const byTpa = tracks.reduce<Record<string, TrainingTrack[]>>((acc, t) => {
    ;(acc[t.tpa_name] ??= []).push(t)
    return acc
  }, {})

  const enrolledCount = enrolledIds.size

  return (
    <section className="p-4 sm:p-6 lg:p-8 space-y-6">
      <Suspense fallback={null}>
        <PaymentStatusModal />
      </Suspense>
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-[#1B3A24]">Training Tracks</h1>
          <p className="text-sm text-[#64748b] mt-1">
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

        {/* Tab bar */}
        <div className="flex gap-1 bg-[#f1f5f9] rounded-xl p-1 mb-6">
          <a
            href="/training/tracks"
            className={`flex-1 text-center py-2.5 px-4 rounded-lg text-sm font-semibold transition ${
              activeTab === 'tracks'
                ? 'bg-white text-[#1B3A24] shadow-sm'
                : 'text-[#64748b] hover:text-[#1B3A24]'
            }`}
          >
            Training Tracks
          </a>
          <a
            href="/training/tracks?tab=general-modules"
            className={`flex-1 text-center py-2.5 px-4 rounded-lg text-sm font-semibold transition ${
              activeTab === 'general-modules'
                ? 'bg-white text-[#1B3A24] shadow-sm'
                : 'text-[#64748b] hover:text-[#1B3A24]'
            }`}
          >
            General Modules
          </a>
        </div>

        {activeTab === 'general-modules' ? (
          <GeneralModulesTab />
        ) : (
          <>
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

                          {/* Prerequisites */}
                          {(track.prerequisite_gm_ids ?? []).length > 0 && (
                            <TrackPrerequisiteChips
                              prerequisites={(track.prerequisite_gm_ids ?? []).map(gmId => {
                                const gm = gmStatusMap.get(gmId)
                                return {
                                  id: gmId,
                                  title: gm?.title ?? 'Unknown',
                                  completed: gm?.completed ?? false,
                                  completed_at: gm?.completed_at ?? null,
                                  enrolled: gm?.enrolled ?? false,
                                  paid: gm?.paid ?? false,
                                }
                              })}
                            />
                          )}

                          {/* Action */}
                          {isEnrolled ? (
                            <div className="flex items-center gap-3">
                              <EnrollButton trackId={track.id} enrolled={isEnrolled} />
                              <Link
                                href={`/training/modules?tpa=${encodeURIComponent(tpa)}`}
                                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2D6A3F] hover:text-[#1B3A24] transition"
                              >
                                View Modules
                                <span className="material-symbols-outlined text-sm">arrow_forward</span>
                              </Link>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-bold text-[#1B3A24]">
                                RM {track.total_price_myr.toLocaleString('en-MY')}
                                <span className="text-xs font-normal text-[#94a3b8] ml-1">
                                  {track.price_per_module != null
                                    ? `${track.module_count} × RM ${track.price_per_module}`
                                    : 'one-time'}
                                </span>
                              </span>
                              <BundleEnrollButton
                                trackId={track.id}
                                trackPrice={track.total_price_myr}
                                prerequisites={(track.prerequisite_gm_ids ?? []).map(gmId => {
                                  const gm = gmStatusMap.get(gmId)
                                  return {
                                    id: gmId,
                                    title: gm?.title ?? 'Unknown',
                                    price_myr: gm?.price_myr ?? 0,
                                    completed: gm?.completed ?? false,
                                    enrolled: gm?.enrolled ?? false,
                                    paid: gm?.paid ?? false,
                                  }
                                })}
                                allPrereqsMet={(track.prerequisite_gm_ids ?? []).every(gmId => gmStatusMap.get(gmId)?.completed)}
                                isEnrolled={isEnrolled}
                              />
                            </div>
                          )}
                        </article>
                      )
                    })}
                  </div>
                </section>
              ))
            )}
          </>
        )}
    </section>
  )
}
