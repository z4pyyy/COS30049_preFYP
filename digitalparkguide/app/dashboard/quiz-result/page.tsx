'use client'

import { useEffect, useMemo, useState } from 'react'
import type { AppRole } from '@/types/roles'
import { hasMinRole } from '@/types/roles'

interface AttemptRow {
  id: string
  user_id: string
  quiz_id: string
  score: number
  passed: boolean
  attempt_number: number
  time_taken_seconds: number | null
  status: 'in_progress' | 'submitted' | 'expired'
  started_at: string
  submitted_at: string | null
  guide_name: string
  quiz_title: string
  module_title: string
  tpa_name: string
  passing_score: number
}

interface GuideStats {
  guide_name: string
  user_id: string
  attempts: number
  best_score: number
  avg_score: number
  passed: boolean
}

interface TpaGroup {
  tpa_name: string
  attempts: AttemptRow[]
  stats: { mean: number; median: number; high: number; low: number; total_guides: number; passed_guides: number }
}

function computeStats(scores: number[]) {
  if (scores.length === 0) return { mean: 0, median: 0, high: 0, low: 0 }
  const sorted = [...scores].sort((a, b) => a - b)
  const mean = Math.round(sorted.reduce((s, v) => s + v, 0) / sorted.length)
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid]
  return { mean, median, high: sorted[sorted.length - 1], low: sorted[0] }
}

export default function QuizResultsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<AttemptRow[]>([])
  const [tpaFilter, setTpaFilter] = useState<string>('all')
  const [role, setRole] = useState<AppRole>('GUIDE')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/quiz-results', { cache: 'no-store' })
        const body = await res.json()
        if (!res.ok) throw new Error(body.error || 'Failed to load')
        if (cancelled) return
        setRows(body.rows ?? [])
        if (body.role) setRole(body.role as AppRole)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Load failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const isHod = hasMinRole(role, 'HOD')
  const isSenior = role === 'SENIOR_GUIDE'
  const isGuide = role === 'GUIDE'
  const showGuideColumn = !isGuide

  const tpaNames = useMemo(() => {
    const set = new Set(rows.map(r => r.tpa_name))
    return Array.from(set).sort()
  }, [rows])

  const filteredRows = useMemo(() => {
    if (tpaFilter === 'all') return rows
    return rows.filter(r => r.tpa_name === tpaFilter)
  }, [rows, tpaFilter])

  const tpaGroups: TpaGroup[] = useMemo(() => {
    const grouped = new Map<string, AttemptRow[]>()
    for (const r of filteredRows) {
      const arr = grouped.get(r.tpa_name) ?? []
      arr.push(r)
      grouped.set(r.tpa_name, arr)
    }

    return Array.from(grouped.entries()).map(([tpa_name, attempts]) => {
      // Best score per guide for stats
      const guideScores = new Map<string, number>()
      const guidePassed = new Map<string, boolean>()
      for (const a of attempts) {
        const prev = guideScores.get(a.user_id)
        if (prev === undefined || a.score > prev) guideScores.set(a.user_id, a.score)
        if (a.passed) guidePassed.set(a.user_id, true)
      }
      const scores = Array.from(guideScores.values())
      const baseStats = computeStats(scores)
      return {
        tpa_name,
        attempts,
        stats: {
          ...baseStats,
          total_guides: guideScores.size,
          passed_guides: Array.from(guidePassed.values()).filter(Boolean).length,
        },
      }
    }).sort((a, b) => a.tpa_name.localeCompare(b.tpa_name))
  }, [filteredRows])

  // Per-guide breakdown within a TPA
  const guideStatsForTpa = (attempts: AttemptRow[]): GuideStats[] => {
    const map = new Map<string, { scores: number[]; name: string; passed: boolean }>()
    for (const a of attempts) {
      const entry = map.get(a.user_id) ?? { scores: [], name: a.guide_name, passed: false }
      entry.scores.push(a.score)
      if (a.passed) entry.passed = true
      map.set(a.user_id, entry)
    }
    return Array.from(map.entries()).map(([user_id, { scores, name, passed }]) => ({
      guide_name: name,
      user_id,
      attempts: scores.length,
      best_score: Math.max(...scores),
      avg_score: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
      passed,
    })).sort((a, b) => b.best_score - a.best_score)
  }

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
        <div className="max-w-6xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-sm text-red-700">{error}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <p className="text-xs uppercase tracking-widest text-[#8DC63F] font-bold">Results</p>
          <h1 className="text-3xl font-black text-[#1B3A24] mt-1">
            {isGuide ? 'My Quiz Results' : 'Quiz Results'}
          </h1>
          <p className="text-sm text-[#64748b] mt-1">
            {isHod
              ? 'All guide quiz performance grouped by TPA. Best-score statistics per park.'
              : isSenior
                ? 'Your group\'s quiz performance grouped by TPA. Best-score statistics per park.'
                : 'Your quiz performance grouped by TPA. Best-score statistics per park.'}
          </p>
        </div>

        {/* TPA Filter */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setTpaFilter('all')}
            className={`text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider ${
              tpaFilter === 'all' ? 'bg-slate-200 text-slate-800' : 'bg-white border border-[#cbd5e1] text-[#64748b] hover:bg-slate-50'
            }`}
          >
            All TPAs · {rows.length}
          </button>
          {tpaNames.map(tpa => {
            const count = rows.filter(r => r.tpa_name === tpa).length
            return (
              <button
                key={tpa}
                onClick={() => setTpaFilter(tpa)}
                className={`text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider ${
                  tpaFilter === tpa ? 'bg-emerald-100 text-emerald-800' : 'bg-white border border-[#cbd5e1] text-[#64748b] hover:bg-slate-50'
                }`}
              >
                {tpa} · {count}
              </button>
            )
          })}
        </div>

        {tpaGroups.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#e2e8f0] p-12 text-center">
            <span className="material-symbols-outlined text-4xl text-[#cbd5e1] mb-2 block">quiz</span>
            <p className="font-semibold text-[#1B3A24]">No results to show</p>
          </div>
        ) : (
          tpaGroups.map(group => {
            const guides = guideStatsForTpa(group.attempts)
            return (
              <div key={group.tpa_name} className="space-y-4">
                {/* TPA Header + Stats */}
                <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-[#8DC63F] font-bold">{group.tpa_name}</p>
                      <p className="text-sm text-[#64748b] mt-1">
                        {group.stats.total_guides} guide{group.stats.total_guides !== 1 ? 's' : ''} ·{' '}
                        {group.stats.passed_guides} passed
                      </p>
                    </div>
                    <div className="grid grid-cols-4 gap-3 text-center">
                      {[
                        { label: 'Mean', value: group.stats.mean, color: 'text-[#1B3A24]' },
                        { label: 'Median', value: group.stats.median, color: 'text-[#2D6A3F]' },
                        { label: 'High', value: group.stats.high, color: 'text-emerald-600' },
                        { label: 'Low', value: group.stats.low, color: 'text-red-600' },
                      ].map(s => (
                        <div key={s.label} className="bg-[#f8fafc] rounded-xl px-4 py-2">
                          <p className="text-xs text-[#94a3b8] font-bold uppercase">{s.label}</p>
                          <p className={`text-xl font-black ${s.color}`}>{s.value}%</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Guide breakdown table */}
                <div className="bg-white rounded-2xl border border-[#e2e8f0] overflow-x-auto">
                  <table className="w-full min-w-[480px]">
                    <thead>
                      <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                        {showGuideColumn && <th className="px-5 py-3 text-left text-xs font-bold text-[#1B3A24]">Guide</th>}
                        <th className="px-5 py-3 text-left text-xs font-bold text-[#1B3A24]">Best Score</th>
                        <th className="px-5 py-3 text-left text-xs font-bold text-[#1B3A24]">Avg Score</th>
                        <th className="px-5 py-3 text-left text-xs font-bold text-[#1B3A24]">Attempts</th>
                        <th className="px-5 py-3 text-left text-xs font-bold text-[#1B3A24]">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {guides.map((g, idx) => (
                        <tr key={g.user_id} className={`border-b border-[#e2e8f0] ${idx % 2 === 0 ? 'bg-white' : 'bg-[#f8fafc]'}`}>
                          {showGuideColumn && <td className="px-5 py-3 text-sm font-semibold text-[#1B3A24]">{g.guide_name}</td>}
                          <td className="px-5 py-3">
                            <span className={`text-sm font-black ${g.passed ? 'text-emerald-700' : 'text-red-700'}`}>
                              {g.best_score}%
                            </span>
                          </td>
                          <td className="px-5 py-3 text-sm text-[#64748b] font-mono">{g.avg_score}%</td>
                          <td className="px-5 py-3 text-sm text-[#64748b] font-mono">{g.attempts}</td>
                          <td className="px-5 py-3">
                            {g.passed ? (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold uppercase tracking-wider">
                                Passed
                              </span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-bold uppercase tracking-wider">
                                Not Passed
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
