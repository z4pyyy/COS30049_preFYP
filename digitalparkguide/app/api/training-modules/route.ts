import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasMinRole } from '@/types/roles'
import { createTrainingModuleVersion } from '@/lib/training-module-history'

export async function GET(request: NextRequest) {
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

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const trackId = searchParams.get('track_id')
    const tpaName = searchParams.get('tpa_name')
    const isActive = searchParams.get('is_active')

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
      .order('order_index', { ascending: true })

    // Filter by track if provided
    if (trackId) {
      query = query.eq('track_id', trackId)
    }

    // Filter by TPA if provided
    if (tpaName) {
      query = query.eq('training_tracks.tpa_name', tpaName)
    }

    // Filter by active status if provided
    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true')
    }

    // For non-HOD users, only show active modules
    if (!hasMinRole(userRole, 'HOD')) {
      query = query.eq('is_active', true)
    }

    const { data: modules, error } = await query

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to fetch training modules' }, { status: 500 })
    }

    return NextResponse.json({ modules })
  } catch (error) {
    console.error('Server error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user role and editor name
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

    const body = await request.json()
    const { track_id, title, description, content, order_index, duration_hours, is_active } = body

    // Validate required fields
    if (!track_id || !title) {
      return NextResponse.json({ error: 'track_id and title are required' }, { status: 400 })
    }

    // Verify track exists
    const { data: track, error: trackError } = await supabase
      .from('training_tracks')
      .select('id')
      .eq('id', track_id)
      .single()

    if (trackError || !track) {
      return NextResponse.json({ error: 'Invalid track_id' }, { status: 400 })
    }

    const { data: module, error } = await supabase
      .from('training_modules')
      .insert({
        track_id,
        title,
        description: description || '',
        content: content || '',
        order_index: order_index || 0,
        duration_hours: duration_hours || null,
        is_active: is_active !== undefined ? is_active : true,
        created_by: user.id
      })
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
          tpa_name
        )
      `)
      .single()

    if (error || !module) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to create training module' }, { status: 500 })
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
      'create'
    )

    return NextResponse.json({ module }, { status: 201 })
  } catch (error) {
    console.error('Server error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}