'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import ThemedSelect from '@/components/ThemedSelect'
import { createClient } from '@/lib/supabase/client'
import { StatusPopup } from '@/components/StatusPopup'

interface QuestionRow {
  id: string
  question_text: string
  options: string[]
  correct_option_index: number
}

interface TrainingModule {
  id: string
  title: string
  track_id: string
  track_title: string
  tpa_name: string
}

function EditQuizInner() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const router = useRouter()
  const quizId = searchParams.get('id')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [popup, setPopup] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const clearPopup = useCallback(() => setPopup(null), [])

  const [title, setTitle] = useState('')
  const [moduleId, setModuleId] = useState('')
  const [passingScore, setPassingScore] = useState(80)
  const [maxAttempts, setMaxAttempts] = useState(3)
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number | ''>(10)
  const [questions, setQuestions] = useState<QuestionRow[]>([])
  const [deletedQuestionIds, setDeletedQuestionIds] = useState<string[]>([])
  const [modules, setModules] = useState<TrainingModule[]>([])
  const [existingQuizModuleIds, setExistingQuizModuleIds] = useState<Set<string>>(new Set())

  const showToast = (msg: string, ok: boolean) => {
    setPopup({ msg, type: ok ? 'success' : 'error' })
  }

  useEffect(() => {
    if (!quizId) return
    async function load() {
      const [{ data: quiz }, { data: qs }, { data: mods }, { data: allQuizzes }] = await Promise.all([
        supabase.from('quizzes').select('*').eq('id', quizId!).single(),
        supabase.from('questions').select('id, question_text, options, correct_option_index').eq('quiz_id', quizId!),
        supabase.from('training_modules').select('id, title, track_id, training_tracks(title, tpa_name)').eq('is_active', true).eq('is_archived', false).order('order_index', { ascending: true }),
        supabase.from('quizzes').select('module_id'),
      ])

      if (quiz) {
        setTitle(quiz.title)
        setModuleId(quiz.module_id ?? '')
        setPassingScore(quiz.passing_score ?? 80)
        setMaxAttempts(quiz.max_attempts ?? 3)
        setTimeLimitMinutes(quiz.time_limit_seconds ? Math.round(quiz.time_limit_seconds / 60) : '')
      }

      if (qs?.length) {
        setQuestions(qs.map(q => ({
          id: q.id,
          question_text: q.question_text,
          options: Array.isArray(q.options) ? q.options : JSON.parse(q.options as unknown as string),
          correct_option_index: q.correct_option_index,
        })))
      }

      const mapped: TrainingModule[] = (mods ?? []).map((m: Record<string, unknown>) => {
        const track = m.training_tracks as { title: string; tpa_name: string } | null
        return { id: m.id as string, title: m.title as string, track_id: m.track_id as string, track_title: track?.title ?? '', tpa_name: track?.tpa_name ?? '' }
      })
      setModules(mapped)

      const otherQuizModuleIds = (allQuizzes ?? [])
        .filter(q => q.module_id && q.module_id !== quiz?.module_id)
        .map(q => q.module_id)
      setExistingQuizModuleIds(new Set(otherQuizModuleIds))

      setLoading(false)
    }
    load()
  }, [quizId, supabase])

  const addQuestion = () =>
    setQuestions([...questions, { id: `new-${Date.now()}`, question_text: '', options: ['', '', '', ''], correct_option_index: 0 }])

  const updateQuestion = (idx: number, field: string, value: unknown) => {
    const next = [...questions]
    ;(next[idx] as unknown as Record<string, unknown>)[field] = value
    setQuestions(next)
  }

  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    const next = [...questions]
    next[qIdx].options = [...next[qIdx].options]
    next[qIdx].options[oIdx] = value
    setQuestions(next)
  }

  const removeQuestion = (idx: number) => {
    if (questions.length <= 1) { showToast('A quiz must have at least one question.', false); return }
    const q = questions[idx]
    if (!q.id.startsWith('new-')) setDeletedQuestionIds(prev => [...prev, q.id])
    setQuestions(questions.filter((_, i) => i !== idx))
  }

  const saveQuiz = async () => {
    if (!title.trim()) { showToast('Please enter a quiz title.', false); return }
    if (!moduleId) { showToast('Please assign this quiz to a module.', false); return }
    if (questions.some(q => !q.question_text.trim() || q.options.some(o => !o.trim()))) {
      showToast('All questions and options must be filled in.', false)
      return
    }
    if (maxAttempts < 1) { showToast('Max attempts must be at least 1.', false); return }

    const timeLimitSec = timeLimitMinutes === '' || timeLimitMinutes === 0 ? null : Math.round(Number(timeLimitMinutes) * 60)
    if (timeLimitSec !== null && (timeLimitSec < 60 || timeLimitSec > 14400)) {
      showToast('Time limit must be 1–240 minutes (or blank for no limit).', false)
      return
    }

    setSaving(true)
    try {
      const selectedMod = modules.find(m => m.id === moduleId)
      const { error: quizErr } = await supabase
        .from('quizzes')
        .update({
          title: title.trim(),
          module_id: moduleId,
          track_id: selectedMod?.track_id ?? null,
          passing_score: passingScore,
          max_attempts: maxAttempts,
          time_limit_seconds: timeLimitSec,
        })
        .eq('id', quizId!)

      if (quizErr) { showToast('Error updating quiz: ' + quizErr.message, false); return }

      // Delete removed questions
      if (deletedQuestionIds.length > 0) {
        await supabase.from('questions').delete().in('id', deletedQuestionIds)
      }

      // Upsert questions
      for (const q of questions) {
        if (q.id.startsWith('new-')) {
          await supabase.from('questions').insert({
            quiz_id: quizId!,
            question_text: q.question_text.trim(),
            options: q.options,
            correct_option_index: q.correct_option_index,
          })
        } else {
          await supabase.from('questions').update({
            question_text: q.question_text.trim(),
            options: q.options,
            correct_option_index: q.correct_option_index,
          }).eq('id', q.id)
        }
      }

      showToast('Quiz updated successfully!', true)
      setDeletedQuestionIds([])
      setTimeout(() => router.push('/dashboard/quiz-builder/manage'), 1500)
    } finally {
      setSaving(false)
    }
  }

  const selectedModule = modules.find(m => m.id === moduleId)
  const modulesByTpa = modules.reduce<Record<string, TrainingModule[]>>((acc, m) => {
    const key = m.tpa_name || 'Unassigned'
    ;(acc[key] ??= []).push(m)
    return acc
  }, {})

  if (!quizId) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center">
        <p className="text-red-600 font-semibold">No quiz ID provided.</p>
        <Link href="/dashboard/quiz-builder/manage" className="text-emerald-600 hover:underline mt-4 inline-block">Back to Quiz Management</Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center py-24">
        <span className="material-symbols-outlined animate-spin text-[#2D6A3F] text-4xl">progress_activity</span>
        <p className="text-slate-500 mt-4">Loading quiz…</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-8 pb-24 relative">
      <StatusPopup message={popup?.msg ?? null} type={popup?.type ?? 'success'} onClose={clearPopup} />

      <div className="flex justify-between items-end mb-8 border-b pb-4">
        <div>
          <Link href="/dashboard/quiz-builder/manage" className="text-xs text-emerald-600 hover:underline uppercase tracking-wider font-bold">
            ← Back to Management
          </Link>
          <h1 className="text-3xl font-black text-slate-800 mt-2">Edit Quiz</h1>
          <p className="text-slate-500">Modify quiz details, questions, and correct answers.</p>
        </div>
        <button
          onClick={saveQuiz}
          disabled={saving}
          className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      {/* Row 1 — title + module */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-slate-400">Quiz Title *</label>
          <input
            className="border p-2 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-slate-400">Assign to Module *</label>
          <ThemedSelect
            value={moduleId}
            onChange={v => setModuleId(v)}
          >
            <option value="">— Select a module —</option>
            {Object.entries(modulesByTpa).map(([tpa, mods]) => (
              <optgroup key={tpa} label={tpa}>
                {mods.map(m => (
                  <option key={m.id} value={m.id} disabled={existingQuizModuleIds.has(m.id)}>
                    {m.title} — {m.track_title}{existingQuizModuleIds.has(m.id) ? ' (has quiz)' : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </ThemedSelect>
          {selectedModule && (
            <p className="text-xs text-emerald-600 mt-1">✓ {selectedModule.tpa_name} · {selectedModule.track_title}</p>
          )}
        </div>
      </div>

      {/* Row 2 — passing / attempts / time limit */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-slate-400">Passing Score (%)</label>
          <input type="number" min={1} max={100} className="border p-2 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500" value={passingScore} onChange={e => setPassingScore(Number(e.target.value))} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-slate-400">Max Attempts *</label>
          <input type="number" min={1} max={10} className="border p-2 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500" value={maxAttempts} onChange={e => setMaxAttempts(Number(e.target.value))} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-slate-400">Time Limit (minutes)</label>
          <input type="number" min={1} max={240} className="border p-2 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500" value={timeLimitMinutes} placeholder="Blank = no limit" onChange={e => setTimeLimitMinutes(e.target.value === '' ? '' : Number(e.target.value))} />
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-8">
        {questions.map((q, qIdx) => (
          <div key={q.id} className="p-6 bg-white border rounded-xl shadow-sm relative">
            <span className="absolute -left-3 top-6 bg-slate-800 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
              {qIdx + 1}
            </span>
            <button
              onClick={() => removeQuestion(qIdx)}
              className="absolute top-6 right-6 text-slate-300 hover:text-red-500 transition-colors"
              title="Remove Question"
            >
              <span className="material-symbols-outlined">delete</span>
            </button>
            <input
              className="w-full text-lg font-bold border-b mb-4 outline-none focus:border-emerald-500 pb-1"
              placeholder="Enter your question here…"
              value={q.question_text}
              onChange={e => updateQuestion(qIdx, 'question_text', e.target.value)}
            />
            <p className="text-xs text-slate-400 mb-2 font-semibold uppercase">Select correct answer:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {q.options.map((opt, oIdx) => (
                <div
                  key={oIdx}
                  onClick={() => updateQuestion(qIdx, 'correct_option_index', oIdx)}
                  className={`flex items-center border rounded-lg p-2 cursor-pointer transition-colors ${q.correct_option_index === oIdx ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <input
                    type="radio"
                    name={`correct-${q.id}`}
                    checked={q.correct_option_index === oIdx}
                    onChange={() => updateQuestion(qIdx, 'correct_option_index', oIdx)}
                    className="mr-3 accent-emerald-600"
                  />
                  <input
                    className="bg-transparent w-full outline-none text-sm"
                    value={opt}
                    onChange={e => updateOption(qIdx, oIdx, e.target.value)}
                    placeholder={`Option ${oIdx + 1}`}
                  />
                  {q.correct_option_index === oIdx && (
                    <span className="ml-2 text-xs text-emerald-600 font-bold shrink-0">✓ Correct</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={addQuestion}
        className="mt-8 w-full py-4 border-2 border-dashed border-slate-300 rounded-xl text-slate-400 font-bold hover:bg-slate-50 hover:border-slate-400 transition"
      >
        + Add Another Question
      </button>
    </div>
  )
}

export default function EditQuizPage() {
  return (
    <Suspense fallback={
      <div className="max-w-4xl mx-auto p-8 text-center py-24">
        <span className="material-symbols-outlined animate-spin text-[#2D6A3F] text-4xl">progress_activity</span>
      </div>
    }>
      <EditQuizInner />
    </Suspense>
  )
}
