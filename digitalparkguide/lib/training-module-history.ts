import type { SupabaseClient } from '@supabase/supabase-js'

export interface TrainingModuleVersionPayload {
  track_id: string
  title: string
  description: string
  content: string
  order_index: number
  duration_hours: number | null
  is_active: boolean
}

export async function createTrainingModuleVersion(
  supabase: SupabaseClient,
  moduleId: string,
  payload: TrainingModuleVersionPayload,
  editorId: string,
  editorName: string,
  editorRole: string,
  changeType: string = 'update',
  sourceVersionId?: string
) {
  const { data: latestVersion, error: latestError } = await supabase
    .from('training_module_versions')
    .select('version_number')
    .eq('module_id', moduleId)
    .order('version_number', { ascending: false })
    .limit(1)
    .single()

  if (latestError && latestError.code !== 'PGRST116') {
    throw latestError
  }

  const nextVersion = (latestVersion?.version_number ?? 0) + 1

  const { data, error } = await supabase
    .from('training_module_versions')
    .insert({
      module_id: moduleId,
      version_number: nextVersion,
      change_type: changeType,
      source_version_id: sourceVersionId || null,
      track_id: payload.track_id,
      title: payload.title,
      description: payload.description,
      content: payload.content,
      order_index: payload.order_index,
      duration_hours: payload.duration_hours,
      is_active: payload.is_active,
      edited_by: editorId,
      editor_name: editorName || '',
      editor_role: editorRole || 'HOD',
    })
    .select()
    .single()

  if (error) {
    throw error
  }

  return data
}
