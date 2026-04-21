'use client'

import { useEffect, useState } from 'react'

interface GroupMember {
  guide_id: string
  guide_name: string
  guide_phone: string | null
  tpa_name: string
  assigned_at: string
  assignment_type: 'auto' | 'manual'
  avg_completion_pct: number
  active_tracks: number
  last_activity_at: string | null
}

export default function SeniorGroupPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [rows, setRows]       = useState<GroupMember[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/guide-groups/senior', { cache: 'no-store' })
        const body = await res.json()
        if (!res.ok) throw new Error(body.error || 'Failed to load group')
        if (!cancelled) setRows(body.rows ?? [])
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Load failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-[#2D6A3F] text-4xl">progress_activity</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f8fafc] p-6">
        <div className="max-w-3xl mx-auto bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-700">
          {error}
        </div>
      </div>
    )
  }

  // Quick KPIs for the header
  const total = rows.length
  const avg = total === 0
    ? 0
    : Math.round(rows.reduce((s, r) => s + Number(r.avg_completion_pct), 0) / total)
  const stalled = rows.filter((r) => {
    if (r.avg_completion_pct >= 100) return false
    if (!r.last_activity_at) return true
    const diffDays = (Date.now() - new Date(r.last_activity_at).getTime()) / 86_400_000
    return diffDays > 14
  }).length

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <p className="text-xs uppercase tracking-widest text-[#8DC63F] font-bold">Senior Portal</p>
          <h1 className="text-3xl font-black text-[#1B3A24] mt-1">My Group</h1>
          <p className="text-sm text-[#64748b] mt-1">
            Guides currently assigned to your leadership. Reassignments are handled by HoD.
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Guides Under You" value={total.toString()}       tone="green" />
          <StatCard label="Avg Completion"   value={`${avg}%`}              tone="green" />
          <StatCard label="Needs Attention"  value={stalled.toString()}
                    tone={stalled > 0 ? 'red' : 'green'} />
        </div>

        {/* Roster */}
        <div className="bg-white rounded-2xl border border-[#e2e8f0] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#e2e8f0]">
            <h2 className="font-bold text-[#1B3A24]">Group Roster</h2>
            <p className="text-xs text-[#64748b]">
              Sorted by completion % (lowest first) — focus your follow-ups here.
            </p>
          </div>

          {rows.length === 0 ? (
            <div className="p-12 text-center">
              <span className="material-symbols-outlined text-4xl text-[#cbd5e1] mb-2 block">group_off</span>
              <p className="font-semibold text-[#1B3A24]">No guides assigned yet</p>
              <p className="text-sm text-[#64748b] mt-1">
                New guides approved for your TPA will be auto-assigned here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#e2e8f0]">
              {rows.map((r) => (
                <div key={r.guide_id} className="px-6 py-4 flex items-center gap-4">
                  <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {r.guide_name.charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-[#1B3A24] text-sm truncate">{r.guide_name}</p>
                      {r.assignment_type === 'manual' && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold uppercase tracking-wider">
                          Manually assigned
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#64748b] truncate">
                      {r.tpa_name} · {r.active_tracks} active track{r.active_tracks === 1 ? '' : 's'}
                    </p>
                    <p className="text-[10px] text-[#94a3b8] mt-0.5">
                      Last activity:{' '}
                      {r.last_activity_at
                        ? new Date(r.last_activity_at).toLocaleDateString('en-MY', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })
                        : 'never'}
                    </p>
                  </div>

                  <div className="w-32 shrink-0 text-right">
                    <span className="text-lg font-black text-[#2D6A3F]">{r.avg_completion_pct}%</span>
                    <div className="h-1.5 bg-[#e2e8f0] rounded-full overflow-hidden mt-1">
                      <div
                        className={`h-full rounded-full transition-all ${
                          r.avg_completion_pct >= 80 ? 'bg-[#2D6A3F]' :
                          r.avg_completion_pct >= 40 ? 'bg-amber-500' :
                                                       'bg-red-500'
                        }`}
                        style={{ width: `${r.avg_completion_pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, tone }: { label: string; value: string; tone: 'green' | 'red' }) {
  const border = tone === 'red' ? 'border-[#DC2E27]' : 'border-[#2D6A3F]'
  const color  = tone === 'red' ? 'text-[#DC2E27]'  : 'text-[#1B3A24]'
  return (
    <div className={`bg-white p-5 rounded-2xl border-l-4 border-[#e2e8f0] ${border}`}>
      <p className="text-[10px] uppercase tracking-widest text-[#64748b] font-bold">{label}</p>
      <p className={`text-3xl font-black mt-1 ${color}`}>{value}</p>
    </div>
  )
}