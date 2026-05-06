'use client'

import { useState, useMemo } from 'react'
import type { CertRow } from './page'

const STAGE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  AWAITING_PAYMENT:      { label: 'Awaiting Payment',    color: 'text-gray-600',    bg: 'bg-gray-100' },
  PAID:                  { label: 'Paid',                color: 'text-blue-700',    bg: 'bg-blue-50' },
  MODULES_COMPLETED:     { label: 'Modules Done',        color: 'text-indigo-700',  bg: 'bg-indigo-50' },
  QUIZZES_PASSED:        { label: 'Quizzes Passed',      color: 'text-purple-700',  bg: 'bg-purple-50' },
  PENDING_INTERVIEW:     { label: 'Pending Interview',   color: 'text-amber-700',   bg: 'bg-amber-50' },
  INTERVIEW_PASSED:      { label: 'Interview Passed',    color: 'text-teal-700',    bg: 'bg-teal-50' },
  PENDING_BADGE_APPROVAL:{ label: 'Pending Badge',       color: 'text-orange-700',  bg: 'bg-orange-50' },
  BADGE_ISSUED:          { label: 'Badge Issued',        color: 'text-emerald-700', bg: 'bg-emerald-50' },
  REJECTED:              { label: 'Rejected',            color: 'text-red-700',     bg: 'bg-red-50' },
}

const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: 'Superadmin',
  HOD: 'HoD',
  SENIOR_GUIDE: 'Senior Guide',
  GUIDE: 'Guide',
  PUBLIC_USER: 'Public',
}

function StageBadge({ stage }: { stage: string }) {
  const cfg = STAGE_CONFIG[stage] ?? { label: stage, color: 'text-gray-600', bg: 'bg-gray-100' }
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.color} ${cfg.bg}`}>
      {cfg.label}
    </span>
  )
}

function RoleBadge({ role }: { role: string }) {
  const isSenior = role === 'SENIOR_GUIDE'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
      isSenior ? 'text-amber-700 bg-amber-50' : 'text-slate-500 bg-slate-100'
    }`}>
      {ROLE_LABELS[role] ?? role}
    </span>
  )
}

type FilterStage = 'ALL' | 'BADGE_ISSUED' | 'IN_PROGRESS' | 'REJECTED'

export default function GuideTrackClient({ rows, fetchError }: { rows: CertRow[]; fetchError: string | null }) {
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState<FilterStage>('ALL')

  const tpaNames = useMemo(() => [...new Set(rows.map(r => r.tpa_name))].sort(), [rows])

  const filtered = useMemo(() => {
    let result = rows
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(r =>
        r.guide_name.toLowerCase().includes(q) ||
        r.tpa_name.toLowerCase().includes(q) ||
        r.certificate_no?.toLowerCase().includes(q)
      )
    }
    if (stageFilter === 'BADGE_ISSUED') {
      result = result.filter(r => r.stage === 'BADGE_ISSUED' && !r.revoked_at)
    } else if (stageFilter === 'IN_PROGRESS') {
      result = result.filter(r => r.stage !== 'BADGE_ISSUED' && r.stage !== 'REJECTED')
    } else if (stageFilter === 'REJECTED') {
      result = result.filter(r => r.stage === 'REJECTED')
    }
    return result
  }, [rows, search, stageFilter])

  const grouped = useMemo(() => {
    const map = new Map<string, CertRow[]>()
    for (const tpa of tpaNames) map.set(tpa, [])
    for (const r of filtered) {
      if (!map.has(r.tpa_name)) map.set(r.tpa_name, [])
      map.get(r.tpa_name)!.push(r)
    }
    return map
  }, [filtered, tpaNames])

  const badgeCount = rows.filter(r => r.stage === 'BADGE_ISSUED' && !r.revoked_at).length
  const inProgressCount = rows.filter(r => r.stage !== 'BADGE_ISSUED' && r.stage !== 'REJECTED').length

  if (fetchError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-700">
        {fetchError}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Certifications" value={rows.length} icon="description" />
        <StatCard label="Badges Issued" value={badgeCount} icon="workspace_premium" accent />
        <StatCard label="In Progress" value={inProgressCount} icon="pending" />
        <StatCard label="TPAs" value={tpaNames.length} icon="park" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-base text-[#94a3b8]">search</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, TPA, or certificate no..."
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-[#d1d9e0] rounded-xl focus:outline-none focus:border-[#2D6A3F] focus:ring-1 focus:ring-[#2D6A3F] bg-white"
          />
        </div>
        <div className="flex gap-1.5">
          {([
            ['ALL', 'All'],
            ['BADGE_ISSUED', 'Badge Holders'],
            ['IN_PROGRESS', 'In Progress'],
            ['REJECTED', 'Rejected'],
          ] as [FilterStage, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setStageFilter(key)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                stageFilter === key
                  ? 'bg-[#2D6A3F] text-white'
                  : 'bg-white border border-[#d1d9e0] text-[#64748b] hover:border-[#2D6A3F] hover:text-[#1B3A24]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Grouped by TPA */}
      {[...grouped.entries()].map(([tpa, certRows]) => {
        if (certRows.length === 0 && stageFilter !== 'ALL') return null
        const tpaBadges = certRows.filter(r => r.stage === 'BADGE_ISSUED' && !r.revoked_at).length
        return (
          <div key={tpa} className="bg-white rounded-2xl border border-[#e2e8f0] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-xl text-[#2D6A3F]">park</span>
                <div>
                  <h2 className="font-bold text-[#1B3A24]">{tpa}</h2>
                  <p className="text-xs text-[#64748b]">
                    {certRows.length} certification{certRows.length === 1 ? '' : 's'} · {tpaBadges} badge{tpaBadges === 1 ? '' : 's'} issued
                  </p>
                </div>
              </div>
            </div>

            {certRows.length === 0 ? (
              <div className="px-6 py-6 text-sm text-[#94a3b8]">No certifications match filter.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#f8fafc] text-left text-[11px] uppercase tracking-widest text-[#64748b]">
                      <th className="px-6 py-3 font-semibold">Guide</th>
                      <th className="px-4 py-3 font-semibold">Role</th>
                      <th className="px-4 py-3 font-semibold">Stage</th>
                      <th className="px-4 py-3 font-semibold">Certificate</th>
                      <th className="px-4 py-3 font-semibold">Badge Issued</th>
                      <th className="px-4 py-3 font-semibold">Enrolled</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2e8f0]">
                    {certRows.map(r => (
                      <tr key={r.id} className="hover:bg-[#f8fafc] transition-colors">
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
                              {r.guide_name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium text-[#1B3A24]">{r.guide_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3"><RoleBadge role={r.guide_role} /></td>
                        <td className="px-4 py-3"><StageBadge stage={r.stage} /></td>
                        <td className="px-4 py-3 text-[#64748b] font-mono text-xs">
                          {r.certificate_no ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-[#64748b] text-xs">
                          {r.badge_issued_at
                            ? new Date(r.badge_issued_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
                            : '—'}
                          {r.revoked_at && (
                            <span className="ml-1 text-red-500 font-semibold">(Revoked)</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[#64748b] text-xs">
                          {new Date(r.created_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}

      {filtered.length === 0 && (
        <div className="bg-white rounded-2xl border border-[#e2e8f0] p-12 text-center">
          <span className="material-symbols-outlined text-4xl text-[#cbd5e1] mb-2 block">search_off</span>
          <p className="font-semibold text-[#1B3A24]">No certifications found</p>
          <p className="text-sm text-[#64748b] mt-1">
            {search ? 'Try adjusting your search.' : 'No guides have enrolled in any TPA yet.'}
          </p>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, icon, accent }: { label: string; value: number; icon: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-[#e2e8f0]'}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`material-symbols-outlined text-base ${accent ? 'text-emerald-600' : 'text-[#94a3b8]'}`}>{icon}</span>
        <span className="text-[11px] uppercase tracking-widest text-[#64748b] font-semibold">{label}</span>
      </div>
      <p className={`text-2xl font-black ${accent ? 'text-emerald-700' : 'text-[#1B3A24]'}`}>{value}</p>
    </div>
  )
}
