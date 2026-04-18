'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import TopNavClient from '@/components/TopNavClient';

export default function ParkQuizInterface() {
  const supabase = createClient();
  
  // States
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds
  const [isFinished, setIsFinished] = useState(false);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    async function fetchQuiz() {
      const { data } = await supabase.from('questions').select('*');
      if (data) setQuestions(data);
      setLoading(false);
    }
    fetchQuiz();
  }, []);

  // Timer Logic
  useEffect(() => {
    if (timeLeft > 0 && !isFinished && !loading) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && !isFinished) {
      submitQuiz();
    }
  }, [timeLeft, isFinished, loading]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSelect = (optionIdx: number) => {
    setAnswers({ ...answers, [currentIdx]: optionIdx });
  };

  const submitQuiz = async () => {
    let correctCount = 0;
    questions.forEach((q, idx) => {
      if (answers[idx] === q.correct_option_index) correctCount++;
    });

    const finalPct = Math.round((correctCount / questions.length) * 100);
    const passed = finalPct >= 80;

    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('quiz_attempts').insert({
      user_id: user?.id,
      quiz_id: questions[0]?.quiz_id,
      score: finalPct,
      passed: passed
    });

    setScore(finalPct);
    setIsFinished(true);
    setShowConfirm(false);
  };

  const resetQuiz = () => {
    setCurrentIdx(0);
    setAnswers({});
    setTimeLeft(600);
    setIsFinished(false);
    setScore(0);
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-500">Initializing HUD...</div>;
  if (questions.length === 0) return <div className="p-10 text-white">No data found in digital archives.</div>;

  const currentQ = questions[currentIdx];
  const progress = ((currentIdx + 1) / questions.length) * 100;

  if (isFinished) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-emerald-500/30 p-8 rounded-2xl text-center shadow-[0_0_50px_rgba(16,185,129,0.1)]">
          <span className="material-symbols-outlined text-6xl mb-4 text-emerald-500">
            {score >= 80 ? 'verified' : 'error'}
          </span>
          <h2 className="text-3xl font-black mb-2">{score >= 80 ? 'CERTIFIED' : 'FAILED'}</h2>
          <p className="text-slate-400 mb-6">Your training score: <span className="text-white font-bold">{score}%</span></p>
          
          {score < 80 ? (
            <button onClick={resetQuiz} className="w-full py-4 bg-red-600 hover:bg-red-500 rounded-xl font-bold transition-all uppercase tracking-widest">
              Re-initialize Training
            </button>
          ) : (
            <button onClick={() => window.location.href = '/dashboard'} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold transition-all uppercase tracking-widest">
              Return to Station
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-emerald-500/30">
      <TopNavClient active="training" />
      {/* HUD Header */}
      <nav className="border-b border-emerald-500/20 bg-slate-900/50 backdrop-blur-md sticky top-0 z-10 p-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xs font-black text-emerald-500 uppercase tracking-[0.3em]">Staff Assessment</h1>
            <p className="text-lg font-bold">Protocol Verification</p>
          </div>
          <div className={`px-4 py-2 rounded-lg border font-mono font-bold ${timeLeft < 60 ? 'border-red-500 text-red-500 animate-pulse' : 'border-emerald-500 text-emerald-500'}`}>
            {formatTime(timeLeft)}
          </div>
        </div>
        <div className="max-w-4xl mx-auto mt-4 h-1 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${progress}%` }}></div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto p-6 mt-10">
        <div className="mb-10">
          <span className="text-emerald-500 font-mono text-sm">QUESTION {currentIdx + 1} OF {questions.length}</span>
          <h2 className="text-2xl sm:text-3xl font-bold mt-2 leading-tight text-white">{currentQ.question_text}</h2>
        </div>

        <div className="grid gap-4">
          {currentQ.options.map((opt: string, i: number) => (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              className={`group flex items-center p-5 rounded-xl border-2 text-left transition-all duration-200 ${
                answers[currentIdx] === i 
                ? 'border-emerald-500 bg-emerald-500/10 text-white shadow-[0_0_20px_rgba(16,185,129,0.1)]' 
                : 'border-slate-800 bg-slate-900/50 hover:border-slate-600'
              }`}
            >
              <div className={`w-6 h-6 rounded-full border-2 mr-4 flex items-center justify-center transition-colors ${
                answers[currentIdx] === i ? 'border-emerald-500 bg-emerald-500' : 'border-slate-600'
              }`}>
                {answers[currentIdx] === i && <span className="text-[10px] text-slate-950 font-black">✓</span>}
              </div>
              <span className="font-medium">{opt}</span>
            </button>
          ))}
        </div>

        {/* Footer Navigation */}
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
              onClick={() => setShowConfirm(true)} // Changed this line
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

      {/* Submit Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl max-w-sm w-full text-center">
            <h3 className="text-xl font-bold mb-4 text-white">End Assessment?</h3>
            <p className="text-slate-400 mb-8 text-sm">Make sure you have answered all questions. You cannot change them after submission.</p>
            <div className="flex gap-4">
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-3 font-bold text-slate-400">Cancel</button>
              <button onClick={submitQuiz} className="flex-1 py-3 bg-emerald-600 rounded-lg font-bold text-white">Yes, Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}