import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: RouteParams) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: applicationId } = await params

  // Verify the applicant owns this application
  const { data: app } = await supabase
    .from('guide_applications')
    .select('applicant_id, status')
    .eq('id', applicationId)
    .single()

  if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  if (app.applicant_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  // Don't allow adding docs after review is done
  if (app.status === 'APPROVED' || app.status === 'REJECTED') {
    return NextResponse.json(
      { error: 'Application has already been reviewed — uploads are closed.' },
      { status: 409 },
    )
  }

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file field missing' }, { status: 400 })
  }

  const MAX_BYTES = 10 * 1024 * 1024  // 10 MB per file
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File exceeds 10 MB limit' }, { status: 413 })
  }

  // Basic MIME allow-list — PDFs, images, Office docs
  const allowed = [
    'application/pdf',
    'image/png', 'image/jpeg', 'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]
  if (!allowed.includes(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type (${file.type}). Allowed: PDF, JPG/PNG/WebP, DOC/DOCX.` },
      { status: 415 },
    )
  }

  const safeName = file.name.replace(/[^\w.\- ]/g, '_').slice(0, 80)
  const storagePath = `${applicationId}/${crypto.randomUUID()}-${safeName}`

  const bytes = Buffer.from(await file.arrayBuffer())
  const { error: upErr } = await supabase.storage
    .from('application-documents')
    .upload(storagePath, bytes, {
      contentType: file.type,
      cacheControl: '3600',
    })

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 })
  }

  // Metadata row (trigger bumps document_count)
  const { data: doc, error: insErr } = await supabase
    .from('guide_application_documents')
    .insert({
      application_id: applicationId,
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.type,
      file_size: file.size,
      uploaded_by: user.id,
    })
    .select()
    .single()

  if (insErr) {
    // Try to clean up the orphan storage object
    await supabase.storage.from('application-documents').remove([storagePath])
    return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  return NextResponse.json({ document: doc })
}

// Returns the list of documents (with short-lived signed URLs) so the applicant status page and the HoD review panel can display them
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: applicationId } = await params

  const { data: docs, error } = await supabase
    .from('guide_application_documents')
    .select('*')
    .eq('application_id', applicationId)
    .order('uploaded_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Generate 5-minute signed URLs so can show/download the files
  const enriched = await Promise.all((docs ?? []).map(async (d) => {
    const { data } = await supabase.storage
      .from('application-documents')
      .createSignedUrl(d.storage_path, 300)
    return { ...d, signed_url: data?.signedUrl ?? null }
  }))

  return NextResponse.json({ documents: enriched })
}