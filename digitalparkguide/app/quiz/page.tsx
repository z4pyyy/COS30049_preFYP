'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import TopNavClient from '@/components/TopNavClient';

interface Question {
  id: string
  quiz_id: string
  question_text: string
  options: string[]
  correct_option_index: number
}

interface QuizMeta {
  id: string
  title: string
  passing_score: number
  max_attempts: number
  module_id: string | null
}

function ParkQuizInterface() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const quizId = searchParams.get('quiz_id')

  const [quiz, setQuiz] = useState<QuizMeta | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [timeLeft, setTimeLeft] = useState(600)
  const [startTime] = useState(Date.now())
  const [isFinished, setIsFinished] = useState(false)
  const [score, setScore] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showConfirm, setShowConfirm] = useState(false)
  const [attemptsUsed, setAttemptsUsed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      setUserId(user?.id ?? null)

      if (!quizId) {
        // Fallback: load the first quiz
        const { data: quizData } = await supabase.from('quizzes').select('*').limit(1).single()
        if (!quizData) { setError('No quiz found. Please access a quiz from a module page.'); setLoading(false); return }
        await loadQuiz(quizData, user?.id)
      } else {
        const { data: quizData, error: qErr } = await supabase.from('quizzes').select('*').eq('id', quizId).single()
        if (qErr || !quizData) { setError('Quiz not found.'); setLoading(false); return }
        await loadQuiz(quizData, user?.id)
      }
    }
    init()
  }, [quizId])

  const loadQuiz = async (quizData: QuizMeta, uid: string | undefined) => {
    setQuiz(quizData)

    // Check attempts used by this user
    if (uid) {
      const { data: attempts } = await supabase
        .from('quiz_attempts')
        .select('id')
        .eq('quiz_id', quizData.id)
        .eq('user_id', uid)
      setAttemptsUsed(attempts?.length ?? 0)

      if ((attempts?.length ?? 0) >= quizData.max_attempts) {
        setLoading(false)
        return
      }
    }

    // Load questions
    const { data: qData } = await supabase
      .from('questions')
      .select('*')
      .eq('quiz_id', quizData.id)
    setQuestions(qData || [])
    setLoading(false)
  }

  // Timer
  useEffect(() => {
    if (timeLeft > 0 && !isFinished && !loading) {
      const t = setTimeout(() => setTimeLeft(t => t - 1), 1000)
      return () => clearTimeout(t)
    } else if (timeLeft === 0 && !isFinished && questions.length > 0) {
      submitQuiz()
    }
  }, [timeLeft, isFinished, loading, questions.length])

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  const handleSelect = (optionIdx: number) => setAnswers({ ...answers, [currentIdx]: optionIdx })

  const submitQuiz = useCallback(async () => {
    if (isFinished) return
    let correctCount = 0
    questions.forEach((q, idx) => { if (answers[idx] === q.correct_option_index) correctCount++ })

    const finalPct = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0
    const passed = finalPct >= (quiz?.passing_score ?? 80)
    const timeTaken = Math.round((Date.now() - startTime) / 1000)
    const nextAttempt = attemptsUsed + 1

    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('quiz_attempts').insert({
      user_id: user?.id,
      quiz_id: quiz?.id ?? questions[0]?.quiz_id,
      score: finalPct,
      passed,
      attempt_number: nextAttempt,
      time_taken_seconds: timeTaken,
    })

    setAttemptsUsed(nextAttempt)
    setScore(finalPct)
    setIsFinished(true)
    setShowConfirm(false)
  }, [isFinished, questions, answers, quiz, startTime, attemptsUsed])

  const resetQuiz = () => {
    setCurrentIdx(0)
    setAnswers({})
    setTimeLeft(600)
    setIsFinished(false)
    setScore(0)
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-500 text-lg font-mono">
      Initializing HUD...
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

  // Max attempts reached
  if (attemptsUsed >= (quiz?.max_attempts ?? 3) && !isFinished) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900 border border-amber-500/30 p-8 rounded-2xl text-center text-white">
        <span className="material-symbols-outlined text-5xl text-amber-500 mb-4 block">block</span>
        <h2 className="text-2xl font-black mb-2">Max Attempts Reached</h2>
        <p className="text-slate-400 text-sm mb-2">
          You have used all {quiz?.max_attempts} attempt{quiz?.max_attempts !== 1 ? 's' : ''} for this quiz.
        </p>
        <p className="text-slate-500 text-xs mb-6">Please contact your HoD to request a reset.</p>
        <button onClick={() => window.history.back()} className="w-full py-3 bg-slate-700 rounded-xl font-bold hover:bg-slate-600 transition">
          ← Return to Module
        </button>
      </div>
    </div>
  )

  if (questions.length === 0) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white p-6">
      <div className="text-center">
        <span className="material-symbols-outlined text-5xl text-slate-600 mb-4 block">quiz</span>
        <p className="text-lg">No questions found in this quiz.</p>
        <button onClick={() => window.history.back()} className="mt-4 px-6 py-3 bg-slate-700 rounded-xl font-bold hover:bg-slate-600 transition">
          ← Go Back
        </button>
      </div>
    </div>
  )

  const currentQ = questions[currentIdx]
  const progress = ((currentIdx + 1) / questions.length) * 100

  // Result Screen
  if (isFinished) {
    const passed = score >= (quiz?.passing_score ?? 80)
    const attemptsLeft = (quiz?.max_attempts ?? 3) - attemptsUsed
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white">
        <div className="max-w-md w-full bg-slate-900 border border-emerald-500/30 p-8 rounded-2xl text-center shadow-[0_0_50px_rgba(16,185,129,0.1)]">
          <span className={`material-symbols-outlined text-6xl mb-4 ${passed ? 'text-emerald-500' : 'text-red-500'}`}>
            {passed ? 'verified' : 'error'}
          </span>
          <h2 className="text-3xl font-black mb-2">{passed ? 'CERTIFIED' : 'FAILED'}</h2>
          <p className="text-slate-400 mb-1">
            Your score: <span className="text-white font-bold text-xl">{score}%</span>
          </p>
          <p className="text-slate-500 text-sm mb-2">
            Pass mark: {quiz?.passing_score ?? 80}% · Attempt {attemptsUsed} of {quiz?.max_attempts ?? 3}
          </p>

          {/* Result breakdown */}
          <div className="my-6 bg-slate-800 rounded-xl p-4 text-left space-y-2">
            <p className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-3">Result Summary</p>
            {questions.map((q, idx) => {
              const userAns = answers[idx]
              const correct = userAns === q.correct_option_index
              return (
                <div key={q.id} className="flex items-start gap-2 text-sm">
                  <span className={`material-symbols-outlined text-base mt-0.5 shrink-0 ${correct ? 'text-emerald-500' : 'text-red-500'}`}>
                    {correct ? 'check_circle' : 'cancel'}
                  </span>
                  <span className="text-slate-300 line-clamp-1">{q.question_text}</span>
                </div>
              )
            })}
          </div>

          {passed ? (
            <div>
              <p className="text-xs text-emerald-400 mb-4">Your HoD has been notified of your pass.</p>
              <button
                onClick={() => window.history.back()}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold transition-all uppercase tracking-widest"
              >
                Return to Module
              </button>
            </div>
          ) : attemptsLeft > 0 ? (
            <div>
              <p className="text-xs text-amber-400 mb-4">{attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} remaining.</p>
              <button
                onClick={resetQuiz}
                className="w-full py-4 bg-red-600 hover:bg-red-500 rounded-xl font-bold transition-all uppercase tracking-widest"
              >
                Retry Assessment
              </button>
            </div>
          ) : (
            <div>
              <p className="text-xs text-red-400 mb-4">No attempts remaining. Contact your HoD.</p>
              <button
                onClick={() => window.history.back()}
                className="w-full py-4 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold transition-all"
              >
                Return to Module
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Quiz Interface
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-emerald-500/30">
      <TopNavClient active="training" />
      {/* HUD Header */}
      <nav className="border-b border-emerald-500/20 bg-slate-900/50 backdrop-blur-md sticky top-0 z-10 p-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xs font-black text-emerald-500 uppercase tracking-[0.3em]">
              {quiz?.title || 'Staff Assessment'}
            </h1>
            <p className="text-sm text-slate-400">
              Attempt {attemptsUsed + 1} of {quiz?.max_attempts ?? 3} · Pass: {quiz?.passing_score ?? 80}%
            </p>
          </div>
          <div className={`px-4 py-2 rounded-lg border font-mono font-bold ${timeLeft < 60 ? 'border-red-500 text-red-500 animate-pulse' : 'border-emerald-500 text-emerald-500'}`}>
            {formatTime(timeLeft)}
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
          {currentQ.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              className={`group flex items-center p-5 rounded-xl border-2 text-left transition-all duration-200 ${
                answers[currentIdx] === i
                  ? 'border-emerald-500 bg-emerald-500/10 text-white shadow-[0_0_20px_rgba(16,185,129,0.1)]'
                  : 'border-slate-800 bg-slate-900/50 hover:border-slate-600'
              }`}
            >
              <div className={`w-6 h-6 rounded-full border-2 mr-4 flex items-center justify-center transition-colors shrink-0 ${answers[currentIdx] === i ? 'border-emerald-500 bg-emerald-500' : 'border-slate-600'}`}>
                {answers[currentIdx] === i && <span className="text-[10px] text-slate-950 font-black">✓</span>}
              </div>
              <span className="font-medium">{opt}</span>
            </button>
          ))}
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
              className="px-10 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black tracking-widest transition-all shadow-lg shadow-emerald-900/20"
            >
              FINISH ASSESSMENT
            </button>
          ) : (
            <button
              onClick={() => setCurrentIdx(currentIdx + 1)}
              className="px-10 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-black tracking-widest transition-all"
            >
              NEXT →
            </button>
          )}
        </footer>
      </main>

      {/* Confirm Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl max-w-sm w-full text-center">
            <h3 className="text-xl font-bold mb-2 text-white">Submit Assessment?</h3>
            <p className="text-slate-400 mb-2 text-sm">
              {Object.keys(answers).length} of {questions.length} question{questions.length !== 1 ? 's' : ''} answered.
            </p>
            <p className="text-slate-500 mb-8 text-xs">You cannot change answers after submission.</p>
            <div className="flex gap-4">
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-3 font-bold text-slate-400 hover:text-white">Cancel</button>
              <button onClick={submitQuiz} className="flex-1 py-3 bg-emerald-600 rounded-lg font-bold text-white hover:bg-emerald-500">
                Yes, Submit
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
