'use client'

// Guide quiz taker — rewritten for Task 5.
// Timer is server-authoritative: we start the attempt on the server,
// poll the expires_at timestamp periodically, and submit server-side.
// Hiding the tab or reloading no longer pauses the countdown.

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import TopNavClient from '@/components/TopNavClient'

interface Question {
  id: string
  quiz_id: string
  question_text: string
  options: string[]
}

interface QuizMeta {
  id: string
  title: string
  passing_score: number
  max_attempts: number
  module_id: string | null
  time_limit_seconds: number | null
}

interface Attempt {
  id: string
  quiz_id: string
  user_id: string
  status: 'in_progress' | 'submitted' | 'expired'
  started_at: string
  expires_at: string | null
  attempt_number: number
  score: number
  passed: boolean
}

function ParkQuizInterface() {
  const searchParams = useSearchParams()
  const quizId = searchParams.get('quiz_id')

  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [quiz, setQuiz]       = useState<QuizMeta | null>(null)
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])

  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [currentIdx, setCurrentIdx] = useState(0)
  const [remainingSec, setRemainingSec] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const [result, setResult] = useState<{
    score: number; passed: boolean; correct_count: number; total_questions: number
  } | null>(null)

  // Refs so the auto-submit effect sees the latest values
  const answersRef = useRef(answers)
  useEffect(() => { answersRef.current = answers }, [answers])
  const attemptRef = useRef(attempt)
  useEffect(() => { attemptRef.current = attempt }, [attempt])

  // ── Start the attempt ───────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function start() {
      if (!quizId) { setError('No quiz specified.'); setLoading(false); return }
      try {
        const res = await fetch('/api/quiz-attempts/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quiz_id: quizId }),
        })
        const body = await res.json()
        if (!res.ok) throw new Error(body.error || 'Failed to start quiz')
        if (cancelled) return
        setQuiz(body.quiz)
        setAttempt(body.attempt)
        setQuestions(body.questions ?? [])
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to start')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    start()
    return () => { cancelled = true }
  }, [quizId])

  // ── Submit (server-scored) ──────────────────────────────────
  const submitAttempt = useCallback(async () => {
    const currentAttempt = attemptRef.current
    if (!currentAttempt || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/quiz-attempts/${currentAttempt.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: answersRef.current }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Submit failed')
      setAttempt(body.attempt)
      setResult({
        score: body.attempt.score,
        passed: body.passed,
        correct_count: body.correct_count,
        total_questions: body.total_questions,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed')
    } finally {
      setSubmitting(false)
      setShowConfirm(false)
    }
  }, [submitting])

  // ── Server-authoritative countdown ──────────────────────────
  // Tick every second from the server-stamped expires_at value, NOT
  // from a local timer that could drift or pause. We also re-poll the
  // server every 15s to correct for clock skew and to catch the case
  // where the user returns after a long sleep.
  useEffect(() => {
    if (!attempt || !attempt.expires_at || result) return

    const expiryMs = new Date(attempt.expires_at).getTime()

    function tick() {
      const remaining = Math.max(0, Math.round((expiryMs - Date.now()) / 1000))
      setRemainingSec(remaining)
      if (remaining <= 0) {
        // Fire-and-forget submit. We don't await here because the tick
        // runs on an interval and we only want one submit to slip through.
        submitAttempt()
      }
    }

    tick()
    const tickId = setInterval(tick, 1000)

    async function pollServer() {
      try {
        const res = await fetch(`/api/quiz-attempts/${attempt!.id}`, { cache: 'no-store' })
        const body = await res.json()
        if (!res.ok || body.remaining_seconds == null) return
        setRemainingSec(body.remaining_seconds)
        if (body.remaining_seconds <= 0) submitAttempt()
      } catch {
        /* network blip — next poll will retry */
      }
    }

    const pollId = setInterval(pollServer, 15000)

    // Also poll whenever the tab becomes visible again — handles the
    // "closed browser, reopened later" edge case the Sprint 1 timer
    // couldn't handle.
    function onVisible() { if (document.visibilityState === 'visible') pollServer() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(tickId)
      clearInterval(pollId)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [attempt, result, submitAttempt])

  // ── Render helpers ──────────────────────────────────────────
  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-500 text-lg font-mono">
      Initializing assessment…
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900 border border-red-500/30 p-8 rounded-2xl text-center text-white">
        <span className="material-symbols-outlined text-5xl text-red-500 mb-4 block">error</span>
        <h2 className="text-xl font-bold mb-2">Assessment Unavailable</h2>
        <p className="text-slate-400 text-sm">{error}</p>
        <button onClick={() => window.history.back()} className="mt-6 px-6 py-3 bg-slate-700 rounded-xl font-bold hover:bg-slate-600 transition">
          ← Go Back
        </button>
      </div>
    </div>
  )

  // ── Result screen ───────────────────────────────────────────
  if (result) {
    const attemptsLeft = (quiz?.max_attempts ?? 3) - (attempt?.attempt_number ?? 0)
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white">
        <div className="max-w-md w-full bg-slate-900 border border-emerald-500/30 p-8 rounded-2xl text-center">
          <span className={`material-symbols-outlined text-6xl mb-4 ${result.passed ? 'text-emerald-500' : 'text-red-500'}`}>
            {result.passed ? 'verified' : 'error'}
          </span>
          <h2 className="text-3xl font-black mb-2">{result.passed ? 'CERTIFIED' : 'FAILED'}</h2>
          <p className="text-slate-400 mb-1">
            Score: <span className="text-white font-bold text-xl">{result.score}%</span>
            {' '}({result.correct_count}/{result.total_questions})
          </p>
          <p className="text-slate-500 text-sm mb-6">
            Pass mark: {quiz?.passing_score ?? 80}% · Attempt {attempt?.attempt_number} of {quiz?.max_attempts ?? 3}
            {attempt?.status === 'expired' && <><br/><span className="text-amber-400">Time expired — submitted automatically.</span></>}
          </p>

          {result.passed ? (
            <button onClick={() => window.history.back()}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold transition-all uppercase tracking-widest">
              Return to Module
            </button>
          ) : attemptsLeft > 0 ? (
            <button onClick={() => window.location.reload()}
              className="w-full py-4 bg-red-600 hover:bg-red-500 rounded-xl font-bold transition-all uppercase tracking-widest">
              Retry ({attemptsLeft} attempt{attemptsLeft === 1 ? '' : 's'} left)
            </button>
          ) : (
            <div>
              <p className="text-xs text-red-400 mb-4">No attempts remaining. Contact your HoD.</p>
              <button onClick={() => window.history.back()}
                className="w-full py-4 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold transition-all">
                Return to Module
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (questions.length === 0) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white p-6">
      <p>No questions in this quiz.</p>
    </div>
  )

  const currentQ = questions[currentIdx]
  const progress = ((currentIdx + 1) / questions.length) * 100
  const timeDisplay = remainingSec === null ? '∞' : formatTime(remainingSec)
  const timeUrgent  = remainingSec !== null && remainingSec < 60

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans">
      <TopNavClient active="training" />

      <nav className="border-b border-emerald-500/20 bg-slate-900/50 backdrop-blur-md sticky top-0 z-10 p-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xs font-black text-emerald-500 uppercase tracking-[0.3em]">
              {quiz?.title || 'Assessment'}
            </h1>
            <p className="text-sm text-slate-400">
              Attempt {attempt?.attempt_number} of {quiz?.max_attempts ?? 3} · Pass: {quiz?.passing_score ?? 80}%
            </p>
          </div>
          <div className={`px-4 py-2 rounded-lg border font-mono font-bold ${timeUrgent ? 'border-red-500 text-red-500 animate-pulse' : 'border-emerald-500 text-emerald-500'}`}>
            {timeDisplay}
          </div>
        </div>
        <div className="max-w-4xl mx-auto mt-4 h-1 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </nav>

      <main className="max-w-4xl mx-auto p-6 mt-10">
        <div className="mb-10">
          <span className="text-emerald-500 font-mono text-sm">QUESTION {currentIdx + 1} OF {questions.length}</span>
          <h2 className="text-2xl sm:text-3xl font-bold mt-2 leading-tight text-white">{currentQ.question_text}</h2>
        </div>

        <div className="grid gap-4">
          {currentQ.options.map((opt, i) => {
            const selected = answers[currentQ.id] === i
            return (
              <button
                key={i}
                onClick={() => setAnswers({ ...answers, [currentQ.id]: i })}
                className={`group flex items-center p-5 rounded-xl border-2 text-left transition-all ${
                  selected
                    ? 'border-emerald-500 bg-emerald-500/10 text-white'
                    : 'border-slate-800 bg-slate-900/50 hover:border-slate-600'
                }`}
              >
                <div className={`w-6 h-6 rounded-full border-2 mr-4 flex items-center justify-center shrink-0 ${selected ? 'border-emerald-500 bg-emerald-500' : 'border-slate-600'}`}>
                  {selected && <span className="text-[10px] text-slate-950 font-black">✓</span>}
                </div>
                <span className="font-medium">{opt}</span>
              </button>
            )
          })}
        </div>

        <footer className="mt-12 flex justify-between items-center border-t border-slate-800 pt-8">
          <button
            disabled={currentIdx === 0}
            onClick={() => setCurrentIdx(currentIdx - 1)}
            className="px-6 py-2 rounded-lg font-bold text-slate-400 hover:text-white disabled:opacity-0 transition-all"
          >
            ← PREVIOUS
          </button>
          {currentIdx === questions.length - 1 ? (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={submitting}
              className="px-10 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black tracking-widest disabled:opacity-60"
            >
              FINISH ASSESSMENT
            </button>
          ) : (
            <button
              onClick={() => setCurrentIdx(currentIdx + 1)}
              className="px-10 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-black tracking-widest"
            >
              NEXT →
            </button>
          )}
        </footer>
      </main>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl max-w-sm w-full text-center">
            <h3 className="text-xl font-bold mb-2 text-white">Submit Assessment?</h3>
            <p className="text-slate-400 mb-2 text-sm">
              {Object.keys(answers).length} of {questions.length} answered.
            </p>
            <p className="text-slate-500 mb-8 text-xs">You cannot change answers after submission.</p>
            <div className="flex gap-4">
              <button onClick={() => setShowConfirm(false)} disabled={submitting} className="flex-1 py-3 font-bold text-slate-400 hover:text-white">
                Cancel
              </button>
              <button onClick={submitAttempt} disabled={submitting}
                className="flex-1 py-3 bg-emerald-600 rounded-lg font-bold text-white hover:bg-emerald-500 disabled:opacity-60">
                {submitting ? 'Submitting…' : 'Yes, Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function QuizPage() {
  return (
    <Suspense>
      <ParkQuizInterface />
    </Suspense>
  )
}