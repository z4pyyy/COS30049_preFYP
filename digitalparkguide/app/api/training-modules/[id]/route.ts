import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasMinRole } from '@/types/roles'
import { createTrainingModuleVersion } from '@/lib/training-module-history'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const userRole = profile.role as any

    // Check if user has permission to view modules
    if (!hasMinRole(userRole, 'GUIDE')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { id } = await params

    let query = supabase
      .from('training_modules')
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
      .eq('id', id)

    // For non-HOD users, only show active modules
    if (!hasMinRole(userRole, 'HOD')) {
      query = query.eq('is_active', true)
    }

    const { data: module, error } = await query.single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Training module not found' }, { status: 404 })
      }
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to fetch training module' }, { status: 500 })
    }

    return NextResponse.json({ module })
  } catch (error) {
    console.error('Server error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const userRole = profile.role as any

    // Check if user has HOD role or higher
    if (!hasMinRole(userRole, 'HOD')) {
      return NextResponse.json({ error: 'Insufficient permissions. HOD role required.' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { track_id, title, description, content, order_index, duration_hours, is_active } = body

    // Validate required fields
    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }

    // If track_id is provided, verify it exists
    if (track_id) {
      const { data: track, error: trackError } = await supabase
        .from('training_tracks')
        .select('id')
        .eq('id', track_id)
        .single()

      if (trackError || !track) {
        return NextResponse.json({ error: 'Invalid track_id' }, { status: 400 })
      }
    }

    const updateData: any = {}
    if (track_id !== undefined) updateData.track_id = track_id
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (content !== undefined) updateData.content = content
    if (order_index !== undefined) updateData.order_index = order_index
    if (duration_hours !== undefined) updateData.duration_hours = duration_hours
    if (is_active !== undefined) updateData.is_active = is_active

    const { data: module, error } = await supabase
      .from('training_modules')
      .update(updateData)
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

    if (error || !module) {
      if (error?.code === 'PGRST116') {
        return NextResponse.json({ error: 'Training module not found' }, { status: 404 })
      }
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to update training module' }, { status: 500 })
    }

    await createTrainingModuleVersion(
      supabase,
      module.id,
      {
        track_id: module.track_id,
        title: module.title,
        description: module.description,
        content: module.content,
        order_index: module.order_index,
        duration_hours: module.duration_hours,
        is_active: module.is_active,
      },
      user.id,
      profile.full_name || '',
      profile.role as string,
      'update'
    )

    return NextResponse.json({ module })
  } catch (error) {
    console.error('Server error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const userRole = profile.role as any

    // Check if user has HOD role or higher
    if (!hasMinRole(userRole, 'HOD')) {
      return NextResponse.json({ error: 'Insufficient permissions. HOD role required.' }, { status: 403 })
    }

    const { id } = await params

    const { error } = await supabase
      .from('training_modules')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to delete training module' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Server error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}