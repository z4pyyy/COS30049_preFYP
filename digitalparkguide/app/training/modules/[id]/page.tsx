import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { hasMinRole, type AppRole } from '@/types/roles'
import { ModuleContentViewer, type Asset } from '@/components/ModuleContentViewer'

interface PageProps { params: Promise<{ id: string }> }

export default async function ModuleDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/training/modules/${id}`)

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !hasMinRole(profile.role as unknown as AppRole, 'GUIDE')) redirect('/unauthorized')

  const { data: module, error } = await supabase
    .from('training_modules')
    .select(`
      id, title, description, content, order_index, duration_hours, is_active, track_id,
      training_tracks ( id, title, tpa_name, track_type )
    `)
    .eq('id', id)
    .eq('is_active', true)
    .single()

  if (error || !module) notFound()

  // Fetch assets for this module
  const { data: assets } = await supabase
    .from('training_module_assets')
    .select('id, file_name, file_type, mime_type, file_size, storage_url')
    .eq('module_id', id)
    .order('created_at', { ascending: true })

  // Fetch user's current progress
  const { data: progress } = await supabase
    .from('guide_module_progress')
    .select('assets_consumed, completed, completed_at')
    .eq('guide_id', user.id)
    .eq('module_id', id)
    .maybeSingle()

  // Module-scoped quiz: look up quiz linked to this module
  const { data: quiz } = await supabase
    .from('quizzes').select('id').eq('module_id', id).maybeSingle()

  // Quiz unlocks when THIS module is completed
  let moduleQuizUnlocked = false
  if (quiz) {
    const { data: unlocked } = await supabase.rpc('module_quiz_unlocked', {
      p_module: id,
      p_user: user.id,
    })
    moduleQuizUnlocked = !!unlocked
  }

  // Bug 2: distinct "quiz passed" state.
  let quizPassedAt: string | null = null
  if (quiz) {
    const { data: pass } = await supabase
      .from('quiz_attempts')
      .select('submitted_at')
      .eq('quiz_id', quiz.id)
      .eq('user_id', user.id)
      .eq('passed', true)
      .eq('status', 'submitted')
      .order('submitted_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    quizPassedAt = pass?.submitted_at ?? null
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const track = (module.training_tracks as any)

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <main className="max-w-4xl mx-auto px-6 py-10">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-[#64748b] mb-6">
          <Link href="/training/modules" className="hover:text-[#2D6A3F] transition">Training Modules</Link>
          <span className="material-symbols-outlined text-sm" translate="no">chevron_right</span>
          <span className="text-[#1B3A24] font-medium">{module.title}</span>
        </div>

      {/* Page title */}
      <div>
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-[#1B3A24]">{module.title}</h1>
        {track && (
          <p className="text-sm text-[#64748b] mt-1">{track.tpa_name} · {track.track_type?.replace('_', ' ')}</p>
        )}
      </div>

      {/* Module metadata card */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6 shadow-sm flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1">
          {module.description && (
            <p className="text-[#64748b] leading-relaxed">{module.description}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 text-sm text-[#64748b]">
          {module.duration_hours && (
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">schedule</span>
              {module.duration_hours}h estimated
            </span>
          )}
          {progress?.completed && (
            <span className="flex items-center gap-1 text-[#2D6A3F] font-semibold">
              <span className="material-symbols-outlined text-sm">verified</span>
              Completed
            </span>
          )}
        </div>
      </div>

      {/* Content Viewer */}
      <ModuleContentViewer
          moduleId={id}
          content={module.content || ''}
          assets={(assets ?? []) as Asset[]}
          initialProgress={progress ?? null}
          quizId={quiz?.id ?? null}
          trackQuizUnlocked={moduleQuizUnlocked}
          quizPassedAt={quizPassedAt}
        />
      </main>
    </div>
  )
}
