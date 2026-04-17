import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasMinRole } from '@/types/roles'
import { createTrainingModuleVersion } from '@/lib/training-module-history'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const userRole = profile.role as any
    if (!hasMinRole(userRole, 'HOD')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { id } = await params
    const { data: module, error: moduleError } = await supabase
      .from('training_modules')
      .select('id')
      .eq('id', id)
      .single()

    if (moduleError || !module) {
      return NextResponse.json({ error: 'Training module not found' }, { status: 404 })
    }

    const { data: versions, error } = await supabase
      .from('training_module_versions')
      .select(`
        id,
        version_number,
        change_type,
        source_version_id,
        track_id,
        title,
        order_index,
        duration_hours,
        is_active,
        edited_by,
        editor_name,
        editor_role,
        created_at,
        training_tracks (
          title,
          tpa_name,
          track_type
        )
      `)
      .eq('module_id', id)
      .order('version_number', { ascending: false })

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to fetch module history' }, { status: 500 })
    }

    return NextResponse.json({ versions })
  } catch (error) {
    console.error('Server error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const userRole = profile.role as any
    if (!hasMinRole(userRole, 'HOD')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const versionId = body?.version_id as string

    if (!versionId) {
      return NextResponse.json({ error: 'version_id is required' }, { status: 400 })
    }

    const { data: version, error: versionError } = await supabase
      .from('training_module_versions')
      .select('module_id, track_id, title, description, content, order_index, duration_hours, is_active')
      .eq('id', versionId)
      .eq('module_id', id)
      .single()

    if (versionError || !version) {
      return NextResponse.json({ error: 'Version not found for this module' }, { status: 404 })
    }

    const { data: updatedModule, error: updateError } = await supabase
      .from('training_modules')
      .update({
        track_id: version.track_id,
        title: version.title,
        description: version.description,
        content: version.content,
        order_index: version.order_index,
        duration_hours: version.duration_hours,
        is_active: version.is_active,
      })
      .eq('id', id)
      .select(`
        id,
        track_id,
        title,
        description,
        content,
        order_index,
        duration_hours,
        is_active,
        created_by,
        created_at,
        updated_at,
        training_tracks (
          title,
          tpa_name,
          track_type
        )
      `)
      .single()

    if (updateError || !updatedModule) {
      console.error('Database error:', updateError)
      return NextResponse.json({ error: 'Failed to restore version' }, { status: 500 })
    }

    await createTrainingModuleVersion(
      supabase,
      id,
      {
        track_id: version.track_id,
        title: version.title,
        description: version.description,
        content: version.content,
        order_index: version.order_index,
        duration_hours: version.duration_hours,
        is_active: version.is_active,
      },
      user.id,
      profile.full_name || '',
      profile.role as string,
      'rollback',
      versionId
    )

    return NextResponse.json({ module: updatedModule })
  } catch (error) {
    console.error('Server error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
