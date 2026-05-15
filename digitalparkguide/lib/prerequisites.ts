import { createClient } from '@/lib/supabase/server'
import type { PrerequisiteStatus } from '@/types/database'

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
