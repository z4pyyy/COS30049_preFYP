'use client'

// Bug 11: guide-facing badge panel. Shows issued badges with issue/renewal
// dates and an expiry badge that flips ACTIVE / EXPIRING / EXPIRED based on
// renewal_due_at. Read-only — issuance happens server-side via
// public.issue_guide_badge (migration 012_certification_enhancements).

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface BadgeRow {
  id: string
  track_id: string
  issue_date: string
  renewal_due_at: string
  status: 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'RENEWED' | 'REVOKED'
  training_tracks: { title: string; tpa_name: string } | null
}

export default function MyBadgesWidget() {
  const supabase = createClient()
  const [rows, setRows] = useState<BadgeRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { if (!cancelled) setLoading(false); return }
      const { data } = await supabase
        .from('guide_badges')
        .select('id, track_id, issue_date, renewal_due_at, status, training_tracks ( title, tpa_name )')
        .eq('guide_id', user.id)
        .order('issue_date', { ascending: false })
      if (cancelled) return
      setRows((data as unknown as BadgeRow[]) ?? [])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [supabase])

  if (loading) return null
  if (rows.length === 0) return null

  const daysUntil = (iso: string) => {
    const due = new Date(iso).getTime()
    const now = Date.now()
    return Math.ceil((due - now) / (1000 * 60 * 60 * 24))
  }

  const statusStyle = (s: BadgeRow['status'], days: number) => {
    if (s === 'EXPIRED' || days < 0) return { bg: 'bg-red-50 border-red-200', text: 'text-red-700', label: 'Expired' }
    if (s === 'REVOKED') return { bg: 'bg-gray-50 border-gray-200', text: 'text-gray-700', label: 'Revoked' }
    if (s === 'EXPIRING' || days <= 30) return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800', label: `Expiring in ${days}d` }
    return { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800', label: 'Active' }
  }

  return (
    <div className="bg-white rounded-2xl border border-[#e2e8f0] overflow-hidden">
      <div className="px-6 py-4 border-b border-[#e2e8f0]">
        <h3 className="font-bold text-[#1B3A24]">My Park Badges</h3>
        <p className="text-xs text-[#64748b]">Certifications issued for Totally Protected Areas. Renewal alerts fire 30 days ahead.</p>
      </div>
      <div className="divide-y divide-[#e2e8f0]">
        {rows.map(b => {
          const days = daysUntil(b.renewal_due_at)
          const s = statusStyle(b.status, days)
          return (
            <div key={b.id} className="px-6 py-4 flex items-center gap-4">
              <span className="material-symbols-outlined text-3xl text-[#2D6A3F] shrink-0">workspace_premium</span>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-widest text-[#8DC63F] font-bold">
                  {b.training_tracks?.tpa_name ?? '—'}
                </p>
                <p className="font-semibold text-[#1B3A24] text-sm truncate">
                  {b.training_tracks?.title ?? 'Badge'}
                </p>
                <p className="text-xs text-[#64748b] mt-0.5">
                  Issued {new Date(b.issue_date).toLocaleDateString('en-MY')} · Renewal due {new Date(b.renewal_due_at).toLocaleDateString('en-MY')}
                </p>
              </div>
              <span className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold ${s.bg} ${s.text}`}>
                {s.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
