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

  if (!clipPath.startsWith(user.id + '/')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  const [clipSigned, thumbSigned] = await Promise.all([
    admin.storage.from('evidence-clips').createSignedUrl(clipPath, TEN_YEARS_SECONDS),
    admin.storage.from('evidence-clips').createSignedUrl(thumbPath, TEN_YEARS_SECONDS),
  ])

  if (clipSigned.error) return NextResponse.json({ error: clipSigned.error.message }, { status: 500 })
  if (thumbSigned.error) return NextResponse.json({ error: thumbSigned.error.message }, { status: 500 })

  return NextResponse.json({
    clipUrl: clipSigned.data!.signedUrl,
    thumbnailUrl: thumbSigned.data!.signedUrl,
  })
}
