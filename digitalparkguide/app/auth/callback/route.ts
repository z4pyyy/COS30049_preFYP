// A1.2 — Supabase OAuth / magic-link redirect handler
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code     = searchParams.get('code')
  const next     = searchParams.get('next')     ?? '/'
  const fullName = searchParams.get('full_name') ?? ''

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // If full_name was passed (registration flow), save it to the profile
        if (fullName) {
          await supabase
            .from('profiles')
            .upsert({ id: user.id, full_name: fullName })
        }

        // Redirect to set-password if user has no password (exclude HOD & SUPERADMIN)
        const hasPassword = user.user_metadata?.has_password === true
        if (!hasPassword) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()
          const role = profile?.role as string | null
          if (role !== 'HOD' && role !== 'SUPERADMIN') {
            return NextResponse.redirect(`${origin}/set-password`)
          }
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }

    return NextResponse.redirect(
      `${origin}/login?error=oauth_failed&message=${encodeURIComponent(error.message)}`
    )
  }

  return NextResponse.redirect(`${origin}/login?error=no_code`)
}
