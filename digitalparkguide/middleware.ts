// Middleware: session refresh + dynamic RBAC from page_access table
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { hasMinRole, type AppRole } from './types/roles'

const ALWAYS_SKIP = ['/auth/', '/unauthorized', '/verify-otp', '/_next', '/favicon']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // Skip internal/auth paths entirely
  if (ALWAYS_SKIP.some(p => pathname.startsWith(p))) {
    return supabaseResponse
  }

  // Lazy role — only queries DB once per request
  let _role: AppRole | null = null
  async function getRole(): Promise<AppRole> {
    if (_role) return _role
    if (!user) return 'PUBLIC_USER'
    const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    _role = (data?.role ?? 'PUBLIC_USER') as AppRole
    return _role
  }

  // Authenticated users on auth pages → redirect to appropriate home
  if (user && (pathname === '/login' || pathname === '/register')) {
    const role = await getRole()
    const dest = role === 'SUPERADMIN' ? '/admin' : '/'
    return NextResponse.redirect(new URL(dest, request.url))
  }

  // Fetch page_access rules (small table, ~10 rows)
  // Sorted by route length DESC so more specific routes match first
  let rules: Array<{ route: string; min_role: string; is_disabled: boolean }> = []
  try {
    const { data } = await supabase
      .from('page_access')
      .select('route, min_role, is_disabled')
    rules = (data ?? []).sort((a, b) => b.route.length - a.route.length)
  } catch {
    // Fallback if table doesn't exist yet
    rules = [
      { route: '/admin',     min_role: 'SUPERADMIN', is_disabled: false },
      { route: '/dashboard', min_role: 'GUIDE',      is_disabled: false },
    ]
  }

  // Best-match prefix (exact or with trailing slash separator to avoid /admin matching /admin-xyz)
  const match = rules.find(r =>
    pathname === r.route || pathname.startsWith(r.route + '/')
  )

  if (match) {
    if (!user) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
    }

    const role = await getRole()

    if (match.is_disabled && role !== 'SUPERADMIN') {
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }

    if (!match.is_disabled && !hasMinRole(role, match.min_role as AppRole)) {
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
