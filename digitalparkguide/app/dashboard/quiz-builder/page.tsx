'use client'

// HoD Quiz Builder
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface QuestionDraft {
  question_text: string
  options: string[]
  correct_option_index: number
}

interface TrainingModule {
  id: string
  title: string
  training_tracks?: { tpa_name: string } | null
}

export default function QuizBuilder() {
  const supabase = createClient()
  const [title, setTitle] = useState('')
  const [moduleId, setModuleId] = useState('')
  const [passingScore, setPassingScore] = useState(80)
  const [maxAttempts, setMaxAttempts] = useState(3)
  // Task 5 — HoD-configurable time limit in minutes (null = unlimited)
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number | ''>(10)
  const [modules, setModules] = useState<TrainingModule[]>([])
  const [questions, setQuestions] = useState<QuestionDraft[]>([
    { question_text: '', options: ['', '', '', ''], correct_option_index: 0 },
  ])
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  useEffect(() => {
    supabase
      .from('training_modules')
      .select('id, title, training_tracks(tpa_name)')
      .eq('is_active', true)
      .eq('is_archived', false)
      .order('order_index')
      .then(({ data }) => setModules((data as unknown as TrainingModule[]) || []))
  }, [supabase])

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  const addQuestion = () =>
    setQuestions([...questions, { question_text: '', options: ['', '', '', ''], correct_option_index: 0 }])

  const updateQuestion = (qIdx: number, field: string, value: unknown) => {
    const next = [...questions]
    ;(next[qIdx] as unknown as Record<string, unknown>)[field] = value
    setQuestions(next)
  }

  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    const next = [...questions]
    next[qIdx].options[oIdx] = value
    setQuestions(next)
  }

  const removeQuestion = (index: number) => {
    if (questions.length <= 1) { showToast('A quiz must have at least one question.', false); return }
    setQuestions(questions.filter((_, i) => i !== index))
  }

  const saveQuiz = async () => {
    if (!title.trim()) { showToast('Please enter a quiz title.', false); return }
    if (!moduleId)     { showToast('Please assign this quiz to a module.', false); return }
    if (questions.some(q => !q.question_text.trim() || q.options.some(o => !o.trim()))) {
      showToast('All questions and options must be filled in.', false)
      return
    }
    if (maxAttempts < 1) { showToast('Max attempts must be at least 1.', false); return }

    // Validate time limit
    const timeLimitSec =
      timeLimitMinutes === '' || timeLimitMinutes === 0
        ? null
        : Math.round(Number(timeLimitMinutes) * 60)
    if (timeLimitSec !== null && (timeLimitSec < 60 || timeLimitSec > 14400)) {
      showToast('Time limit must be 1–240 minutes (or blank for no limit).', false)
      return
    }

    setSaving(true)
    try {
      const { data: quizData, error: quizErr } = await supabase
        .from('quizzes')
        .insert({
          title: title.trim(),
          module_id: moduleId,
          passing_score: passingScore,
          max_attempts: maxAttempts,
          time_limit_seconds: timeLimitSec, 
        })
        .select()
        .single()

      if (quizErr) { showToast('Error saving quiz: ' + quizErr.message, false); return }

      const questionsToSave = questions.map(q => ({
        quiz_id: quizData.id,
        question_text: q.question_text.trim(),
        options: q.options,
        correct_option_index: q.correct_option_index,
      }))

      const { error: qErr } = await supabase.from('questions').insert(questionsToSave)
      if (qErr) { showToast('Error saving questions: ' + qErr.message, false); return }

      showToast('Quiz published successfully!', true)
      setTitle(''); setModuleId('')
      setPassingScore(80); setMaxAttempts(3); setTimeLimitMinutes(10)
      setQuestions([{ question_text: '', options: ['', '', '', ''], correct_option_index: 0 }])
    } finally {
      setSaving(false)
    }
  }

  const selectedModule = modules.find(m => m.id === moduleId)

  return (
    <div className="max-w-4xl mx-auto p-8 pb-24 relative">
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${toast.ok ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex justify-between items-end mb-8 border-b pb-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800">Quiz Builder</h1>
          <p className="text-slate-500">HoD Tool — One quiz per module. Configure attempts and time limit.</p>
        </div>
        <button
          onClick={saveQuiz}
          disabled={saving}
          className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Publish Quiz'}
        </button>
      </div>

      {/* Row 1 — title + module */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-slate-400">Quiz Title *</label>
          <input
            className="border p-2 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Bako Flora Assessment"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-slate-400">Assign to Module *</label>
          <select
            className="border p-2 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            value={moduleId}
            onChange={e => setModuleId(e.target.value)}
          >
            <option value="">— Select a module —</option>
            {modules.map(m => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const tpa = (m.training_tracks as any)?.tpa_name || ''
              return (
                <option key={m.id} value={m.id}>
                  {m.title}{tpa ? ` (${tpa})` : ''}
                </option>
              )
            })}
          </select>
          {selectedModule && (
            <p className="text-xs text-emerald-600 mt-1">✓ Assigned to: {selectedModule.title}</p>
          )}
        </div>
      </div>

      {/* Row 2 — passing / attempts / time limit */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-slate-400">Passing Score (%)</label>
          <input
            type="number" min={1} max={100}
            className="border p-2 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={passingScore}
            onChange={e => setPassingScore(Number(e.target.value))}
          />
          <p className="text-xs text-slate-400">Default 80</p>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-slate-400">Max Attempts *</label>
          <input
            type="number" min={1} max={10}
            className="border p-2 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={maxAttempts}
            onChange={e => setMaxAttempts(Number(e.target.value))}
          />
          <p className="text-xs text-slate-400">Hard cap — guides cannot retry beyond this</p>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-slate-400">
            Time Limit (minutes)
          </label>
          <input
            type="number" min={1} max={240}
            className="border p-2 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={timeLimitMinutes}
            placeholder="Blank = no limit"
            onChange={e => setTimeLimitMinutes(e.target.value === '' ? '' : Number(e.target.value))}
          />
          <p className="text-xs text-slate-400">Countdown runs server-side · 1–240 min</p>
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-8">
        {questions.map((q, qIdx) => (
          <div key={qIdx} className="p-6 bg-white border rounded-xl shadow-sm relative">
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
            <div className="grid grid-cols-2 gap-4">
              {q.options.map((opt, oIdx) => (
                <div
                  key={oIdx}
                  className={`flex items-center border rounded-lg p-2 ${q.correct_option_index === oIdx ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}
                >
                  <input
                    type="radio"
                    name={`correct-${qIdx}`}
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