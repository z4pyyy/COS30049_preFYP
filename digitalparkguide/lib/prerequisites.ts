import { createClient } from '@/lib/supabase/server'
import type { PrerequisiteStatus, TrackPrerequisiteStatus } from '@/types/database'

export async function checkTrackPrerequisites(
  userId: string,
  trackId: string
): Promise<TrackPrerequisiteStatus> {
  const supabase = await createClient()

  const { data: track, error: trackError } = await supabase
    .from('training_tracks')
    .select('prerequisite_gm_ids')
    .eq('id', trackId)
    .single()

  if (trackError) throw new Error(trackError.message)

  const requiredIds: string[] = track?.prerequisite_gm_ids ?? []
  if (requiredIds.length === 0) {
    return { satisfied: true, prerequisites: [] }
  }

  const { data: modules, error: modError } = await supabase
    .from('general_modules')
    .select('*')
    .in('id', requiredIds)
    .order('order_index', { ascending: true })

  if (modError) throw new Error(modError.message)

  const { data: completions } = await supabase
    .from('general_module_completions')
    .select('module_id, completed_at')
    .eq('user_id', userId)

  const completionMap = new Map(
    (completions ?? []).map(c => [c.module_id, c.completed_at])
  )

  const { data: enrollments } = await supabase
    .from('general_module_enrollments')
    .select('module_id, payment_status')
    .eq('guide_id', userId)

  const enrollmentMap = new Map(
    (enrollments ?? []).map(e => [e.module_id, e.payment_status])
  )

  const prerequisites = (modules ?? []).map(mod => ({
    module: mod,
    completed: completionMap.has(mod.id),
    completed_at: completionMap.get(mod.id) ?? null,
    enrolled: enrollmentMap.has(mod.id),
    paid: enrollmentMap.get(mod.id) === 'paid',
  }))

  return {
    satisfied: prerequisites.every(p => p.completed),
    prerequisites,
  }
}

export async function checkGeneralModulePrerequisites(
  userId: string
): Promise<PrerequisiteStatus> {
  const supabase = await createClient()

  const { data: allModules, error: modulesError } = await supabase
    .from('general_modules')
    .select('*')
    .order('order_index', { ascending: true })

  if (modulesError) throw new Error(modulesError.message)
  if (!allModules || allModules.length === 0) {
    return { satisfied: true, completed_count: 0, total_count: 0, incomplete_modules: [] }
  }

  const { data: completions, error: completionsError } = await supabase
    .from('general_module_completions')
    .select('module_id')
    .eq('user_id', userId)

  if (completionsError) throw new Error(completionsError.message)

  const completedIds = new Set(completions?.map(c => c.module_id) ?? [])
  const incompleteModules = allModules.filter(m => !completedIds.has(m.id))

  return {
    satisfied: incompleteModules.length === 0,
    completed_count: allModules.length - incompleteModules.length,
    total_count: allModules.length,
    incomplete_modules: incompleteModules,
  }
}
