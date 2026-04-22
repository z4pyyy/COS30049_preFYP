'use client'

// Quiz Results dashboard — visible to HoD (all attempts) and
// Senior Guide (their group only, via RLS on quiz_attempts).
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

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
  // Joined
  profiles:  { full_name: string | null } | null
  quizzes:   { title: string; module_id: string | null; passing_score: number } | null
}

export default function QuizResultsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [rows, setRows]       = useState<AttemptRow[]>([])
  const [filter, setFilter]   = useState<'all' | 'passed' | 'failed' | 'expired'>('all')

  useEffect(() => {
    let cancelled = false
    async function load() {
      // RLS decides what's visible: HoD+ gets everything, Senior
      // gets group-only, Guide gets their own attempts. 
      const { data, error } = await supabase
        .from('quiz_attempts')
        .select(`
          id, user_id, quiz_id, score, passed, attempt_number,
          time_taken_seconds, status, started_at, submitted_at,
          profiles:user_id ( full_name ),
          quizzes ( title, module_id, passing_score )
        `)
        .in('status', ['submitted', 'expired'])
        .order('submitted_at', { ascending: false, nullsFirst: false })
        .limit(500)

      if (!cancelled && !error) setRows((data as unknown as AttemptRow[]) ?? [])
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [supabase])

  const filtered = rows.filter((r) => {
    if (filter === 'passed')  return r.passed
    if (filter === 'failed')  return !r.passed && r.status === 'submitted'
    if (filter === 'expired') return r.status === 'expired'
    return true
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-[#2D6A3F] text-4xl">progress_activity</span>
      </div>
    )
  }

  const counts = {
    all:     rows.length,
    passed:  rows.filter((r) => r.passed).length,
    failed:  rows.filter((r) => !r.passed && r.status === 'submitted').length,
    expired: rows.filter((r) => r.status === 'expired').length,
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <p className="text-xs uppercase tracking-widest text-[#8DC63F] font-bold">Results</p>
          <h1 className="text-3xl font-black text-[#1B3A24] mt-1">Quiz Results</h1>
          <p className="text-sm text-[#64748b] mt-1">
            Senior Guides see results for their group · HoD sees every attempt across all parks.
          </p>
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 flex-wrap">
          {([
            { key: 'all',     label: 'All',      cls: 'bg-slate-200 text-slate-800' },
            { key: 'passed',  label: 'Passed',   cls: 'bg-emerald-100 text-emerald-800' },
            { key: 'failed',  label: 'Failed',   cls: 'bg-red-100 text-red-800' },
            { key: 'expired', label: 'Expired',  cls: 'bg-amber-100 text-amber-800' },
          ] as const).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider ${
                filter === f.key ? f.cls : 'bg-white border border-[#cbd5e1] text-[#64748b] hover:bg-slate-50'
              }`}
            >
              {f.label} · {counts[f.key]}
            </button>
          ))}
        </div>

        {/* Results table */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#e2e8f0] p-12 text-center">
            <span className="material-symbols-outlined text-4xl text-[#cbd5e1] mb-2 block">quiz</span>
            <p className="font-semibold text-[#1B3A24]">No results to show</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#e2e8f0] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                  <th className="px-5 py-3 text-left text-xs font-bold text-[#1B3A24]">Guide</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-[#1B3A24]">Quiz</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-[#1B3A24]">Score</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-[#1B3A24]">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-[#1B3A24]">Attempt</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-[#1B3A24]">Time Taken</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-[#1B3A24]">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, idx) => (
                  <tr key={r.id} className={`border-b border-[#e2e8f0] ${idx % 2 === 0 ? 'bg-white' : 'bg-[#f8fafc]'}`}>
                    <td className="px-5 py-3 text-sm font-semibold text-[#1B3A24]">
                      {r.profiles?.full_name || r.user_id.slice(0, 8)}
                    </td>
                    <td className="px-5 py-3 text-sm text-[#475569]">{r.quizzes?.title || '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`text-sm font-black ${
                        r.passed ? 'text-emerald-700' : 'text-red-700'
                      }`}>
                        {r.score}%
                      </span>
                      {r.quizzes && (
                        <span className="text-xs text-[#94a3b8] ml-1">/ {r.quizzes.passing_score}%</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {r.status === 'expired' ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold uppercase tracking-wider">
                          Expired
                        </span>
                      ) : r.passed ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold uppercase tracking-wider">
                          Passed
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-bold uppercase tracking-wider">
                          Failed
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm text-[#64748b] font-mono">#{r.attempt_number}</td>
                    <td className="px-5 py-3 text-sm text-[#64748b] font-mono">
                      {r.time_taken_seconds != null
                        ? `${Math.floor(r.time_taken_seconds / 60)}m ${r.time_taken_seconds % 60}s`
                        : '—'}
                    </td>
                    <td className="px-5 py-3 text-xs text-[#94a3b8]">
                      {r.submitted_at
                        ? new Date(r.submitted_at).toLocaleString('en-MY', {
                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                          })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}