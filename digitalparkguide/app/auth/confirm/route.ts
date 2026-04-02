// A1.3 — Email OTP / magic-link confirmation handler
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as 'email' | 'recovery' | 'signup' | null
  const next = searchParams.get('next') ?? '/'

  if (tokenHash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }

    // A1.5 — Invalid / expired OTP
    return NextResponse.redirect(
      `${origin}/verify-otp?error=invalid_otp&message=${encodeURIComponent(error.message)}`
    )
  }

  return NextResponse.redirect(`${origin}/verify-otp?error=missing_token`)
}
