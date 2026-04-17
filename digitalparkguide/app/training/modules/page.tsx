import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasMinRole } from '@/types/roles'

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
  training_tracks?: Array<{
    id: string
    title: string
    tpa_name: string
    track_type: string
  }>
}

interface SearchParams {
  tpa?: string
}

export default async function GuideTrainingModulesPage({ searchParams }: { searchParams?: SearchParams }) {
  const tpaFilter = searchParams?.tpa || ''
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect(`/login?next=/training/modules${tpaFilter ? `?tpa=${encodeURIComponent(tpaFilter)}` : ''}`)
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile || !hasMinRole(profile.role as any, 'GUIDE')) {
    redirect('/unauthorized')
  }

  const { data: tracks } = await supabase
    .from('training_tracks')
    .select('tpa_name')
    .order('tpa_name')

  const availableTpas = Array.from(
    new Set((tracks || []).map((track) => track.tpa_name).filter(Boolean))
  )

  let query = supabase
    .from('training_modules')
    .select(`
      id,
      title,
      description,
      order_index,
      duration_hours,
      training_tracks (
        id,
        title,
        tpa_name,
        track_type
      )
    `)
    .eq('is_active', true)
    .order('order_index', { ascending: true })

  if (tpaFilter) {
    query = query.eq('training_tracks.tpa_name', tpaFilter)
  }

  const { data: modules, error: modulesError } = await query

  if (modulesError) {
    return (
      <div className="min-h-screen bg-background py-16 px-6">
        <div className="max-w-4xl mx-auto rounded-3xl bg-white p-10 shadow-lg">
          <h1 className="text-3xl font-bold text-[#1B3A24] mb-4">Guide Training Modules</h1>
          <p className="text-[#64748b] mb-6">Unable to load modules right now.</p>
          <p className="text-sm text-[#475569]">Please try again later or contact your administrator.</p>
        </div>
      </div>
    )
  }

  const groupedByTpa = (modules as TrainingModule[]).reduce<Record<string, TrainingModule[]>>((acc, module) => {
    const tpa = module.training_tracks?.[0]?.tpa_name || 'Unknown TPA'
    ;(acc[tpa] ??= []).push(module)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-[#8DC63F]">Guide Portal</p>
              <h1 className="text-4xl font-black text-[#1B3A24] mt-3">Training Modules by TPA</h1>
              <p className="text-[#64748b] mt-3 max-w-2xl">
                Browse available guide certification modules organised by Totally Protected Area and certification track.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/training"
                className="inline-flex items-center gap-2 rounded-full border border-[#cbd5e1] bg-white px-5 py-3 text-sm font-semibold text-[#1B3A24] hover:border-[#94a3b8] transition"
              >
                Back to Training Programmes
              </Link>
              <Link
                href="/dashboard/hod/modules"
                className="inline-flex items-center gap-2 rounded-full bg-[#2D6A3F] px-5 py-3 text-sm font-semibold text-white hover:bg-[#1B3A24] transition"
              >
                Manage Modules
              </Link>
            </div>
          </div>
        </div>

        <form action="/training/modules" className="mb-8">
          <label className="block text-sm font-semibold text-[#1B3A24] mb-2">Filter by TPA</label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              name="tpa"
              defaultValue={tpaFilter}
              className="w-full rounded-xl border border-[#cbd5e1] bg-white px-4 py-3 text-[#1B3A24]"
            >
              <option value="">All TPAs</option>
              {availableTpas.map((tpa) => (
                <option key={tpa} value={tpa}>
                  {tpa}
                </option>
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
            <h2 className="text-2xl font-bold text-[#1B3A24] mb-3">No modules found</h2>
            <p className="text-[#64748b]">
              There are no active modules for the selected TPA. Try another filter or check back later.
            </p>
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
                {tpaModules.map((module) => {
                  const trainingTrack = module.training_tracks?.[0]
                  return (
                    <article key={module.id} className="rounded-3xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm uppercase tracking-[0.2em] text-[#8b5cf6]">
                            {trainingTrack?.track_type.replace('_', ' ') || 'Track'}
                          </p>
                          <h3 className="text-xl font-semibold text-[#1B3A24] mt-2">{module.title}</h3>
                        </div>
                        <span className="rounded-full bg-[#e0f2fe] px-3 py-1 text-xs font-semibold text-[#0369a1]">
                          {trainingTrack?.title || 'Unknown Track'}
                        </span>
                      </div>
                      <p className="text-[#475569] leading-relaxed mb-5 line-clamp-3">{module.description}</p>
                      {module.duration_hours != null && (
                        <div className="text-sm text-[#64748b] mb-4">
                          Estimated duration: {module.duration_hours} hour{module.duration_hours === 1 ? '' : 's'}
                        </div>
                      )}
                      <Link
                        href={`/training/modules?tpa=${encodeURIComponent(trainingTrack?.tpa_name || '')}`}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#1B3A24] px-4 py-3 text-sm font-semibold text-white hover:bg-[#111827] transition"
                      >
                        View track modules
                        <span className="material-symbols-outlined text-sm">arrow_forward</span>
                      </Link>
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
