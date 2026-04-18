'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { hasMinRole, type AppRole } from '@/types/roles'

export function GuardianPortalSidebar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const action = searchParams.get('action')
  const router = useRouter()
  const supabase = createClient()
  const [userRole, setUserRole] = useState<AppRole>('GUIDE')

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

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isDashboardRoot = pathname === '/dashboard' && !action

  const items = [
    { href: '/dashboard', icon: 'dashboard', label: 'Overview', active: isDashboardRoot },
    { href: '/dashboard/training', icon: 'forest', label: 'Ranger Track', active: pathname.startsWith('/dashboard/training') },
    { href: '/dashboard/guides', icon: 'explore', label: 'Guide Track', active: pathname.startsWith('/dashboard/guides') },
    { href: '/dashboard/tracks', icon: 'trophy', label: 'Tracks', active: pathname.startsWith('/dashboard/tracks') },
    ...(hasMinRole(userRole, 'HOD') ? [
      { href: '/dashboard?action=modules', icon: 'school', label: 'Training Modules', active: action === 'modules' || action === 'edit' || action === 'new' },
      { href: '/dashboard?action=applications', icon: 'person_add', label: 'Applications', active: action === 'applications' },
      { href: '/dashboard/hod/announcements', icon: 'campaign', label: 'Announcements', active: pathname.startsWith('/dashboard/hod/announcements') },
      { href: '/dashboard/quiz-builder', icon: 'edit_note', label: 'Quiz Builder', active: pathname.startsWith('/dashboard/quiz-builder') },
      { href: '/dashboard/quiz-result', icon: 'analytics', label: 'Quiz Results', active: pathname.startsWith('/dashboard/quiz-result') },
    ] : []),
  ]

  return (
    <aside className="h-screen w-64 fixed left-0 top-0 z-40 bg-slate-50 flex flex-col p-4">
      <div className="mb-10 px-4">
        <h1 className="font-black text-emerald-900 text-xl tracking-tighter">Guardian Portal</h1>
        <p className="text-[0.6875rem] uppercase tracking-widest text-slate-500 font-medium">Biodiversity Unit</p>
      </div>

      <nav className="flex-1 space-y-2">
        {items.map(({ href, icon, label, active }) => (
          <Link
            key={label}
            href={href}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 text-sm font-medium uppercase tracking-widest ${
              active ? 'bg-emerald-100 text-emerald-900 translate-x-1' : 'text-slate-500 hover:bg-slate-200'
            }`}
          >
            <span className="material-symbols-outlined">{icon}</span>
            {label}
          </Link>
        ))}
      </nav>

      <div className="mt-auto space-y-2 pt-6">
        <button className="w-full bg-[#DC2E27] text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all text-sm">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>emergency</span>
          Live Incident
        </button>
        <div className="pt-4 space-y-1">
          <a href="#" className="flex items-center gap-3 text-slate-500 px-4 py-2 hover:bg-slate-200 rounded-xl transition-all text-[0.6875rem] uppercase tracking-widest font-medium">
            <span className="material-symbols-outlined text-sm">help</span> Support
          </a>
          <button onClick={handleSignOut} className="w-full flex items-center gap-3 text-slate-500 px-4 py-2 hover:bg-slate-200 rounded-xl transition-all text-[0.6875rem] uppercase tracking-widest font-medium">
            <span className="material-symbols-outlined text-sm">logout</span> Sign Out
          </button>
        </div>
      </div>
    </aside>
  )
}
