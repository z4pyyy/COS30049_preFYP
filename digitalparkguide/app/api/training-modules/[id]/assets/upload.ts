import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasMinRole } from '@/types/roles'
import { validateFile, generateStoragePath } from '@/lib/file-upload'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
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

    // Verify module exists
    const { data: module, error: moduleError } = await supabase
      .from('training_modules')
      .select('id, track_id')
      .eq('id', moduleId)
      .single()

    if (moduleError || !module) {
      return NextResponse.json({ error: 'Training module not found' }, { status: 404 })
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file
    const validation = validateFile(file)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const fileType = validation.fileType!
    const storagePath = generateStoragePath(moduleId, fileType, file.name)

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('training-media')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json(
        { error: 'Failed to upload file to storage' },
        { status: 500 }
      )
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from('training-media').getPublicUrl(storagePath)

    // Insert asset record in database
    const { data: asset, error: dbError } = await supabase
      .from('training_module_assets')
      .insert({
        module_id: moduleId,
        file_name: file.name,
        file_type: fileType,
        mime_type: file.type,
        file_size: file.size,
        storage_path: storagePath,
        storage_url: publicUrl,
        uploaded_by: user.id,
      })
      .select('*')
      .single()

    if (dbError) {
      // Try to delete the uploaded file since DB insert failed
      await supabase.storage.from('training-media').remove([storagePath])
      
      console.error('Database insert error:', dbError)
      return NextResponse.json(
        { error: 'Failed to save file metadata' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        asset: {
          id: asset.id,
          module_id: asset.module_id,
          file_name: asset.file_name,
          file_type: asset.file_type,
          mime_type: asset.mime_type,
          file_size: asset.file_size,
          storage_url: asset.storage_url,
          created_at: asset.created_at,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Server error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}