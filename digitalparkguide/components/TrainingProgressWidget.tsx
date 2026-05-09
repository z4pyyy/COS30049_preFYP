'use client'

// Reusable training-progress panel for /dashboard.
// Two modes:
//   mode="guide" — current user's own tracks + completion %
//   mode="hod"   — aggregate view across every enrolled guide
// Data is fetched from the /api/training-progress endpoints which
// lean on the guide_progress_summary view (migration 007).

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface GuideRow {
  guide_id: string
  guide_name: string
  track_id: string
  track_title: string
  tpa_name: string
  total_modules: number
  completed_modules: number
  in_progress_modules: number
  completion_pct: number
  last_activity_at: string | null
  enrollment_status: string
}

interface HodStats {
  total_guides: number
  active_enrollments: number
  avg_completion_pct: number
  fully_certified_guides: number
  stalled_guides: number
}

interface GroupStats {
  senior_id: string
  senior_name: string
  guides: number
  enrollments: number
  avg_completion_pct: number
  stalled: number
}

interface Props {
  mode: 'guide' | 'hod'
}

export default function TrainingProgressWidget({ mode }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<GuideRow[]>([])
  const [stats, setStats] = useState<HodStats | null>(null)
  const [groups, setGroups] = useState<GroupStats[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        const url = mode === 'hod'
          ? '/api/training-progress/summary'
          : '/api/training-progress/me'
        const res = await fetch(url, { cache: 'no-store' })
        const body = await res.json()
        if (!res.ok) throw new Error(body.error || 'Failed to load progress')
        if (cancelled) return
        setRows(body.rows ?? [])
        setStats(body.stats ?? null)
        setGroups(body.groups ?? [])
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Load failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [mode])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-[#e2e8f0] p-10 text-center">
        <span className="material-symbols-outlined animate-spin text-[#2D6A3F] text-3xl">progress_activity</span>
        <p className="text-sm text-[#64748b] mt-2">Loading training progress…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-sm text-red-700">
        {error}
      </div>
    )
  }

  // ── Guide view — personal tracks ─────────────────────────────
  if (mode === 'guide') {
    if (rows.length === 0) {
      return (
        <div className="bg-white rounded-2xl border border-[#e2e8f0] p-8 text-center">
          <span className="material-symbols-outlined text-4xl text-[#cbd5e1] mb-2 block">school</span>
          <h3 className="font-bold text-[#1B3A24] mb-1">No active tracks yet</h3>
          <p className="text-sm text-[#64748b] mb-4">
            Activate a training track to start earning park badges.
          </p>
          <Link
            href="/training/tracks"
            className="inline-flex items-center gap-2 rounded-xl bg-[#2D6A3F] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1B3A24] transition"
          >
            <span className="material-symbols-outlined text-sm">add_circle</span>
            Browse Tracks
          </Link>
        </div>
      )
    }

    const overallPct = Math.round(
      rows.reduce((sum, r) => sum + r.completion_pct, 0) / rows.length
    )

    return (
      <div className="space-y-6">
        {/* Overall headline — Tailwind v4 uses bg-linear-to-r (not bg-gradient-to-r) */}
        <div className="bg-linear-to-r from-[#1B3A24] to-[#2D6A3F] rounded-2xl p-6 text-white">
          <p className="text-[10px] uppercase tracking-widest opacity-70">My Overall Training Progress</p>
          <div className="flex items-end gap-4 mt-2">
            <span className="text-5xl font-black">{overallPct}%</span>
            <span className="text-sm opacity-80 pb-2">
              across {rows.length} active track{rows.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="h-2 bg-white/20 rounded-full mt-4 overflow-hidden">
            <div
              className="h-full bg-[#8DC63F] rounded-full transition-all duration-500"
              style={{ width: `${overallPct}%` }}
            />
          </div>
        </div>

        {/* Per-track breakdown */}
        <div className="bg-white rounded-2xl border border-[#e2e8f0] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
            <h3 className="font-bold text-[#1B3A24]">My Tracks</h3>
            <Link
              href="/training/modules"
              className="text-xs font-semibold text-[#2D6A3F] hover:underline flex items-center gap-1"
            >
              View all modules
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>
          </div>
          <div className="divide-y divide-[#e2e8f0]">
            {rows.map((r) => (
              <div key={r.track_id} className="px-6 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-widest text-[#8DC63F] font-bold">
                    {r.tpa_name}
                  </p>
                  <p className="font-semibold text-[#1B3A24] text-sm truncate">{r.track_title}</p>
                  <p className="text-xs text-[#64748b] mt-0.5">
                    {r.completed_modules}/{r.total_modules} modules completed
                    {r.in_progress_modules > 0 && ` · ${r.in_progress_modules} in progress`}
                  </p>
                </div>
                <div className="w-32 shrink-0">
                  <div className="flex items-center justify-end mb-1">
                    <span className="text-sm font-bold text-[#2D6A3F]">{r.completion_pct}%</span>
                  </div>
                  <div className="h-1.5 bg-[#e2e8f0] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#2D6A3F] rounded-full transition-all"
                      style={{ width: `${r.completion_pct}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── HoD view — aggregate across all guides ────────────────────
  if (!stats) {
    return (
      <div className="bg-white rounded-2xl border border-[#e2e8f0] p-8 text-center text-sm text-[#64748b]">
        No guide enrollments yet.
      </div>
    )
  }

  const topStalled = rows
    .filter((r) => r.enrollment_status === 'active' && r.completion_pct < 100)
    .sort((a, b) => {
      const ta = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0
      const tb = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0
      return ta - tb
    })
    .slice(0, 5)

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Active Guides"       value={stats.total_guides.toString()}         tone="green" />
        <KpiCard label="Active Enrollments"  value={stats.active_enrollments.toString()}   tone="blue" />
        <KpiCard label="Avg Completion"      value={`${stats.avg_completion_pct}%`}        tone="green" />
        <KpiCard label="Needs Attention"     value={stats.stalled_guides.toString()}
                 tone={stats.stalled_guides > 0 ? 'red' : 'green'} />
      </div>

      {/* Group progress breakdown */}
      {groups.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#e2e8f0] overflow-x-auto">
          <div className="px-4 sm:px-6 py-4 border-b border-[#e2e8f0]">
            <h3 className="font-bold text-[#1B3A24]">Progress by Senior Guide Group</h3>
            <p className="text-xs text-[#64748b]">Training completion aggregated across each senior guide&apos;s assigned group</p>
          </div>
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                <th className="px-6 py-3 text-left text-xs font-bold text-[#1B3A24]">Senior Guide</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-[#1B3A24]">Guides</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-[#1B3A24]">Enrollments</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-[#1B3A24]">Avg Completion</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-[#1B3A24]">Stalled</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g, idx) => (
                <tr key={g.senior_id} className={`border-b border-[#e2e8f0] ${idx % 2 === 0 ? 'bg-white' : 'bg-[#f8fafc]'}`}>
                  <td className="px-6 py-3 text-sm font-semibold text-[#1B3A24]">{g.senior_name}</td>
                  <td className="px-6 py-3 text-sm text-[#64748b] font-mono">{g.guides}</td>
                  <td className="px-6 py-3 text-sm text-[#64748b] font-mono">{g.enrollments}</td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-[#e2e8f0] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${g.avg_completion_pct >= 80 ? 'bg-[#2D6A3F]' : g.avg_completion_pct >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${g.avg_completion_pct}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-[#2D6A3F]">{g.avg_completion_pct}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    {g.stalled > 0 ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold">{g.stalled}</span>
                    ) : (
                      <span className="text-xs text-[#94a3b8]">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Stalled guides */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
          <div>
            <h3 className="font-bold text-[#1B3A24]">Guides Needing Follow-up</h3>
            <p className="text-xs text-[#64748b]">Longest-inactive active enrollments</p>
          </div>
          <Link
            href="/dashboard?action=applications"
            className="text-xs font-semibold text-[#2D6A3F] hover:underline"
          >
            Full roster →
          </Link>
        </div>
        {topStalled.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-[#64748b]">
            Everyone is progressing — no stalled enrollments.
          </div>
        ) : (
          <div className="divide-y divide-[#e2e8f0]">
            {topStalled.map((r) => (
              <div key={`${r.guide_id}-${r.track_id}`} className="px-6 py-4 flex items-center gap-4">
                <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0">
                  {r.guide_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#1B3A24] text-sm truncate">{r.guide_name}</p>
                  <p className="text-xs text-[#64748b] truncate">
                    {r.tpa_name} · {r.track_title}
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
                <div className="w-24 shrink-0 text-right">
                  <span className="text-sm font-bold text-[#2D6A3F]">{r.completion_pct}%</span>
                  <div className="h-1.5 bg-[#e2e8f0] rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{ width: `${r.completion_pct}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function KpiCard({ label, value, tone }: { label: string; value: string; tone: 'green' | 'red' | 'blue' }) {
  const toneMap = {
    green: 'border-[#2D6A3F] text-[#1B3A24]',
    red:   'border-[#DC2E27] text-[#DC2E27]',
    blue:  'border-[#0369a1] text-[#0369a1]',
  }
  return (
    <div className={`bg-white p-5 rounded-2xl border-l-4 border-[#e2e8f0] ${toneMap[tone]}`}>
      <p className="text-[10px] uppercase tracking-widest text-[#64748b] font-bold">{label}</p>
      <p className="text-3xl font-black mt-1">{value}</p>
    </div>
  )
}