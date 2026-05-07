import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const TEN_YEARS_SECONDS = 10 * 365 * 24 * 60 * 60

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { clipPath, thumbPath } = await req.json()
  if (!clipPath || !thumbPath) {
    return NextResponse.json({ error: 'clipPath and thumbPath required' }, { status: 400 })
  }

  // Verify user owns the path
  if (!clipPath.startsWith(user.id + '/')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  const { data: clipSigned, error: clipErr } = await admin.storage
    .from('evidence-clips')
    .createSignedUrl(clipPath, TEN_YEARS_SECONDS)

  if (clipErr) return NextResponse.json({ error: clipErr.message }, { status: 500 })

  const { data: thumbSigned, error: thumbErr } = await admin.storage
    .from('evidence-clips')
    .createSignedUrl(thumbPath, TEN_YEARS_SECONDS)

  if (thumbErr) return NextResponse.json({ error: thumbErr.message }, { status: 500 })

  return NextResponse.json({
    clipUrl: clipSigned.signedUrl,
    thumbnailUrl: thumbSigned.signedUrl,
  })
}
