import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasMinRole, type AppRole } from '@/types/roles'

const MAX_BYTES = 50 * 1024 * 1024 // 50 MB
const BUCKET = 'announcement-attachments'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !hasMinRole(profile.role as AppRole, 'HOD')) {
    return NextResponse.json({ error: 'HOD role required' }, { status: 403 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File exceeds 50 MB limit' }, { status: 400 })
  }

  const safeName = file.name.toLowerCase().replace(/[^a-z0-9.-]/g, '_').slice(0, 80)
  const path = `${user.id}/${Date.now()}_${safeName}`

  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    console.error('Upload error:', uploadError)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)

  return NextResponse.json({
    attachment: {
      name: file.name,
      url: publicUrl,
      path,
      size: file.size,
      mime: file.type,
    },
  }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !hasMinRole(profile.role as AppRole, 'HOD')) {
    return NextResponse.json({ error: 'HOD role required' }, { status: 403 })
  }

  const { path } = await request.json() as { path?: string }
  if (!path) {
    return NextResponse.json({ error: 'path required' }, { status: 400 })
  }

  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) {
    console.error('Remove error:', error)
    return NextResponse.json({ error: 'Remove failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
