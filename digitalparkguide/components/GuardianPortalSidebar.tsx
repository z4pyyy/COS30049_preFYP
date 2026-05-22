'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { hasMinRole, type AppRole } from '@/types/roles'
import BackToSiteButton from '@/components/BackToSiteButton'

interface Props {
  fullName?: string
  initials?: string
}

export function GuardianPortalSidebar({ fullName = '', initials = 'G' }: Props) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const action = searchParams.get('action')
  const router = useRouter()
  const supabase = createClient()
  const [userRole, setUserRole] = useState<AppRole>('GUIDE')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function loadRole() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      if (!cancelled && data?.role) setUserRole(data.role as AppRole)
    }
    loadRole()
    return () => { cancelled = true }
  }, [supabase])

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isDashboardRoot = pathname === '/dashboard' && !action
  const isHod = hasMinRole(userRole, 'HOD')
  const isSenior = userRole === 'SENIOR_GUIDE'
  // Accurate role label for the user card at the bottom
  const roleLabel = isHod ? 'HoD' : isSenior ? 'Senior Guide' : 'Guide'

  // Senior Guide gets a dedicated "My Group" entry that no
  // other role sees. HoD gets a "Groups" entry to reassign.
  const items = [
    { href: '/dashboard', icon: 'dashboard', label: 'Overview', active: isDashboardRoot },

    // Senior-only: monitor guides under them
    ...(isSenior ? [
      {
        href: '/dashboard/senior',
        icon: 'groups',
        label: 'My Group',
        active: pathname.startsWith('/dashboard/senior'),
      },
      {
        href: '/senior-guide/interviews',
        icon: 'event',
        label: 'Interviews',
        active: pathname.startsWith('/senior-guide/interviews'),
      },
    ] : []),

    { href: isHod ? '/dashboard?action=tracks' : '/training/tracks', icon: 'trophy', label: 'Tracks', active: isHod ? action === 'tracks' : pathname.startsWith('/training/tracks') || pathname.startsWith('/dashboard/tracks') },
    { href: '/monitor',            icon: 'videocam',           label: 'AI Monitor',       active: pathname.startsWith('/monitor') },
    { href: '/dashboard/evidence', icon: 'shield',             label: 'Evidence Review',  active: pathname.startsWith('/dashboard/evidence') },

    // Guides + Seniors see their learning modules
    ...(!isHod ? [
      { href: '/training/modules', icon: 'school', label: 'Training Modules', active: pathname.startsWith('/training/modules') },
      { href: '/dashboard/my-certifications', icon: 'workspace_premium', label: 'My Certifications', active: pathname.startsWith('/dashboard/my-certifications') },
      { href: '/dashboard/quiz-result', icon: 'analytics', label: 'Quiz Results', active: pathname.startsWith('/dashboard/quiz-result') },
    ] : []),

    // HoD admin tools
    ...(isHod ? [
      { href: '/dashboard?action=general-modules', icon: 'menu_book', label: 'General Modules', active: action === 'general-modules' },
      { href: '/dashboard?action=modules',      icon: 'school',     label: 'Training Modules', active: action === 'modules' || action === 'edit' || action === 'new' },
      { href: '/dashboard?action=applications', icon: 'person_add', label: 'Applications',      active: action === 'applications' },
      { href: '/dashboard/hod/badge-track',     icon: 'workspace_premium', label: 'Badge Track', active: pathname.startsWith('/dashboard/hod/badge-track') },
      { href: '/dashboard/hod/groups',          icon: 'groups',     label: 'Guide Groups',      active: pathname.startsWith('/dashboard/hod/groups') },
      { href: '/dashboard/hod/announcements',   icon: 'campaign',   label: 'Announcements',     active: pathname.startsWith('/dashboard/hod/announcements') },
      { href: '/dashboard/quiz-builder',        icon: 'edit_note',  label: 'Quiz Builder',      active: pathname === '/dashboard/quiz-builder' },
      { href: '/dashboard/quiz-builder/manage', icon: 'list_alt',   label: 'Quiz Management',   active: pathname.startsWith('/dashboard/quiz-builder/manage') },
      { href: '/dashboard/quiz-result',         icon: 'analytics',  label: 'Quiz Results',      active: pathname.startsWith('/dashboard/quiz-result') },
    ] : []),
  ]

  return (
    <>
      {/* Mobile menu trigger */}
      <div className="lg:hidden sticky top-(--nav-height) z-30 h-14 bg-slate-50 border-b border-outline-variant/20 flex items-center px-4">
        <button
          type="button"
          aria-label="Open navigation"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-emerald-50 text-slate-700"
        >
          <span className="material-symbols-outlined" translate="no">menu</span>
        </button>
        <p className="ml-3 text-[0.6875rem] uppercase tracking-widest text-slate-500 font-bold">
          {isHod ? 'HoD Menu' : isSenior ? 'Senior Menu' : 'Guide Menu'}
        </p>
      </div>

      {open && (
        <div
          className="lg:hidden fixed inset-0 z-[65] bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed left-0 top-0 lg:top-(--nav-height) z-70 lg:z-30 h-screen lg:h-[calc(100vh-var(--nav-height))] w-72 bg-slate-50 flex flex-col p-4 border-r border-outline-variant/20 transition-transform duration-300 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-2 px-4 flex items-start justify-end lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-emerald-50 text-slate-600 -mr-2"
          >
            <span className="material-symbols-outlined text-lg" translate="no">close</span>
          </button>
        </div>

        <nav className="flex-1 space-y-1 pt-2">
          {items.map(({ href, icon, label, active }) => (
            <Link
              key={label}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 text-xs font-medium uppercase tracking-wide ${
                active ? 'bg-emerald-100 text-emerald-900 translate-x-1' : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-900'
              }`}
            >
              <span className={`material-symbols-outlined text-xl shrink-0 ${active ? '' : 'group-hover:text-emerald-700'}`} translate="no">{icon}</span>
              <span className="whitespace-nowrap">{label}</span>
            </Link>
          ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-outline-variant/20">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 text-slate-500 px-4 py-2 hover:bg-slate-100 rounded-xl transition-all"
          >
            <span className="material-symbols-outlined text-base shrink-0" translate="no">logout</span>
            <span className="font-medium text-[0.6875rem] uppercase tracking-widest">Sign Out</span>
          </button>
          <BackToSiteButton />
          <div className="flex items-center gap-3 px-4 py-3 mt-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-black">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-on-surface truncate">{fullName || 'Guide'}</p>
              <p className="text-[0.625rem] text-on-surface-variant uppercase tracking-widest">{roleLabel}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}