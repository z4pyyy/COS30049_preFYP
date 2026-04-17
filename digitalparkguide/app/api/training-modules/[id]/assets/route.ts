import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasMinRole } from '@/types/roles'

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

    // Check if user has permission to view
    if (!hasMinRole(userRole, 'GUIDE')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { id: moduleId } = await params

    // Verify module exists
    const { data: module, error: moduleError } = await supabase
      .from('training_modules')
      .select('id, is_active')
      .eq('id', moduleId)
      .single()

    if (moduleError || !module) {
      return NextResponse.json({ error: 'Training module not found' }, { status: 404 })
    }

    // For non-HOD users, only show assets from active modules
    if (!hasMinRole(userRole, 'HOD') && !module.is_active) {
      return NextResponse.json({ error: 'Module not accessible' }, { status: 403 })
    }

    // Get all assets for the module
    const { data: assets, error } = await supabase
      .from('training_module_assets')
      .select('*')
      .eq('module_id', moduleId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 })
    }

    return NextResponse.json({ assets })
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
      return NextResponse.json(
        { error: 'Insufficient permissions. HOD role required.' },
        { status: 403 }
      )
    }

    const { id: moduleId } = await params
    const { searchParams } = new URL(request.url)
    const assetId = searchParams.get('asset_id')

    if (!assetId) {
      return NextResponse.json({ error: 'asset_id query parameter required' }, { status: 400 })
    }

    // Get asset details
    const { data: asset, error: assetError } = await supabase
      .from('training_module_assets')
      .select('*')
      .eq('id', assetId)
      .eq('module_id', moduleId)
      .single()

    if (assetError || !asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('training-media')
      .remove([asset.storage_path])

    if (storageError) {
      console.error('Storage deletion error:', storageError)
      // Continue with DB deletion even if storage deletion fails
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('training_module_assets')
      .delete()
      .eq('id', assetId)

    if (dbError) {
      console.error('Database deletion error:', dbError)
      return NextResponse.json(
        { error: 'Failed to delete asset' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Server error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}