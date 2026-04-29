'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { StatusPopup } from '@/components/StatusPopup'

interface QuizRow {
  id: string
  title: string
  passing_score: number
  max_attempts: number
  time_limit_seconds: number | null
  created_at: string
  module_id: string | null
  module_title: string | null
  track_title: string | null
  track_tpa: string | null
  question_count: number
}

export default function QuizManagePage() {
  const supabase = createClient()
  const [rows, setRows] = useState<QuizRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [popup, setPopup] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const clearPopup = useCallback(() => setPopup(null), [])
  const [deleting, setDeleting] = useState<string | null>(null)

  const showToast = (msg: string, ok: boolean) => {
    setPopup({ msg, type: ok ? 'success' : 'error' })
  }

  const loadQuizzes = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error: quizErr } = await supabase
      .from('quizzes')
      .select(`
        id, title, passing_score, max_attempts, time_limit_seconds, created_at,
        module_id,
        training_modules:module_id ( id, title, training_tracks ( title, tpa_name ) )
      `)
      .order('created_at', { ascending: false })

    if (quizErr) {
      setError(quizErr.message)
      setLoading(false)
      return
    }

    const quizIds = (data ?? []).map(q => q.id)
    const counts = new Map<string, number>()
    if (quizIds.length > 0) {
      const { data: qrows } = await supabase
        .from('questions')
        .select('quiz_id')
        .in('quiz_id', quizIds)
      for (const row of (qrows ?? [])) {
        counts.set(row.quiz_id, (counts.get(row.quiz_id) ?? 0) + 1)
      }
    }

    const mapped: QuizRow[] = (data ?? []).map((q: unknown) => {
      const quiz = q as {
        id: string
        title: string
        passing_score: number
        max_attempts: number
        time_limit_seconds: number | null
        created_at: string
        module_id: string | null
        training_modules: {
          id: string
          title: string
          training_tracks: { title: string; tpa_name: string } | null
        } | null
      }
      return {
        id: quiz.id,
        title: quiz.title,
        passing_score: quiz.passing_score,
        max_attempts: quiz.max_attempts,
        time_limit_seconds: quiz.time_limit_seconds,
        created_at: quiz.created_at,
        module_id: quiz.module_id,
        module_title: quiz.training_modules?.title ?? null,
        track_title: quiz.training_modules?.training_tracks?.title ?? null,
        track_tpa: quiz.training_modules?.training_tracks?.tpa_name ?? null,
        question_count: counts.get(quiz.id) ?? 0,
      }
    })

    setRows(mapped)
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadQuizzes() }, [loadQuizzes])

  const deleteQuiz = async (id: string, title: string) => {
    if (!confirm(`Delete quiz "${title}"? This cannot be undone.`)) return
    setDeleting(id)
    await supabase.from('questions').delete().eq('quiz_id', id)
    const { error: delErr } = await supabase.from('quizzes').delete().eq('id', id)
    setDeleting(null)
    if (delErr) {
      showToast('Failed to delete: ' + delErr.message, false)
      return
    }
    showToast('Quiz deleted.', true)
    setRows(prev => prev.filter(r => r.id !== id))
  }

  const fmtTime = (secs: number | null) => {
    if (!secs) return 'No limit'
    const mins = Math.round(secs / 60)
    return `${mins} min`
  }

  return (
    <div className="max-w-6xl mx-auto p-8">
      <StatusPopup message={popup?.msg ?? null} type={popup?.type ?? 'success'} onClose={clearPopup} />

      <div className="flex items-end justify-between mb-8 border-b pb-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800">Quiz Management</h1>
          <p className="text-slate-500">View and delete quizzes. Each quiz is linked to a training module.</p>
        </div>
        <Link
          href="/dashboard/quiz-builder"
          className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-emerald-700 inline-flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          New Quiz
        </Link>
      </div>

      {loading ? (
        <p className="text-slate-500 py-12 text-center">Loading quizzes…</p>
      ) : error ? (
        <p className="text-red-600 py-12 text-center">Error: {error}</p>
      ) : rows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <span className="material-symbols-outlined text-5xl text-slate-300 mb-3 block">quiz</span>
          <h2 className="text-xl font-bold text-slate-700 mb-2">No quizzes yet</h2>
          <p className="text-slate-500 mb-6">Head to the Quiz Builder to create your first one.</p>
          <Link
            href="/dashboard/quiz-builder"
            className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-emerald-700 inline-flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Create Quiz
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3">Title</th>
                <th className="text-left px-4 py-3">Module</th>
                <th className="text-left px-4 py-3">Track / Park</th>
                <th className="text-left px-4 py-3">Questions</th>
                <th className="text-left px-4 py-3">Pass %</th>
                <th className="text-left px-4 py-3">Attempts</th>
                <th className="text-left px-4 py-3">Time</th>
                <th className="text-left px-4 py-3">Created</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-semibold text-slate-800">{r.title}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.module_title ?? <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.track_title ? (
                      <>
                        <span className="font-medium">{r.track_title}</span>
                        {r.track_tpa && (
                          <span className="block text-xs text-emerald-600 uppercase tracking-wider">
                            {r.track_tpa}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.question_count}</td>
                  <td className="px-4 py-3 text-slate-600">{r.passing_score}%</td>
                  <td className="px-4 py-3 text-slate-600">{r.max_attempts}</td>
                  <td className="px-4 py-3 text-slate-600">{fmtTime(r.time_limit_seconds)}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <Link
                      href={`/dashboard/quiz-builder/edit?id=${r.id}`}
                      className="text-emerald-600 hover:text-emerald-700 hover:underline text-sm font-semibold"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => deleteQuiz(r.id, r.title)}
                      disabled={deleting === r.id}
                      className="text-red-600 hover:text-red-700 hover:underline text-sm font-semibold disabled:opacity-50"
                    >
                      {deleting === r.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
