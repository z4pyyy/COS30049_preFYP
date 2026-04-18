'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface QuestionDraft {
  question_text: string;
  options: string[];
  correct_option_index: number;
}

export default function QuizBuilder() {
  const supabase = createClient();
  const [title, setTitle] = useState('');
  const [module, setModule] = useState('Safety');
  const [questions, setQuestions] = useState<QuestionDraft[]>([
    { question_text: '', options: ['', '', '', ''], correct_option_index: 0 }
  ]);

  const addQuestion = () => {
    setQuestions([...questions, { question_text: '', options: ['', '', '', ''], correct_option_index: 0 }]);
  };

  const updateQuestion = (qIdx: number, field: string, value: any) => {
    const newQs = [...questions];
    (newQs[qIdx] as any)[field] = value;
    setQuestions(newQs);
  };

  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    const newQs = [...questions];
    newQs[qIdx].options[oIdx] = value;
    setQuestions(newQs);
  };

  const removeQuestion = (index: number) => {
  if (questions.length > 1) {
    setQuestions(questions.filter((_, i) => i !== index));
  } else {
    alert("A quiz must have at least one question!");
  }
};

  const saveQuiz = async () => {
    // 1. Save the Quiz Header
    const { data: quizData, error: quizErr } = await supabase
      .from('quizzes')
      .insert({ title, module_name: module, passing_score: 80 })
      .select()
      .single();

    if (quizErr) return alert("Error saving quiz: " + quizErr.message);

    // 2. Prepare Questions with the new Quiz ID
    const questionsToSave = questions.map(q => ({
      quiz_id: quizData.id,
      question_text: q.question_text,
      options: q.options,
      correct_option_index: q.correct_option_index
    }));

    // 3. Bulk Insert Questions
    const { error: qErr } = await supabase.from('questions').insert(questionsToSave);

    if (qErr) alert("Error saving questions: " + qErr.message);
    else alert("Quiz Created Successfully!");
  };

  return (
    <div className="max-w-4xl mx-auto p-8 pb-24">
      <div className="flex justify-between items-end mb-8 border-b pb-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800">Quiz Builder</h1>
          <p className="text-slate-500">HoD Tool: Create per-module assessments</p>
        </div>
        <button onClick={saveQuiz} className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-emerald-700">
          Publish Quiz
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-slate-400">Quiz Title</label>
          <input className="border p-2 rounded" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Advanced Botany" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-slate-400">Assign to Module</label>
          <select className="border p-2 rounded" value={module} onChange={e => setModule(e.target.value)}>
            <option value="Safety">Safety</option>
            <option value="Botany">Botany</option>
            <option value="History">Park History</option>
          </select>
        </div>
      </div>

      <div className="space-y-8">
        {questions.map((q, qIdx) => (
          <div key={qIdx} className="p-6 bg-white border rounded-xl shadow-sm relative">
            <span className="absolute -left-3 top-6 bg-slate-800 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">
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
              className="w-full text-lg font-bold border-b mb-4 outline-none focus:border-emerald-500"
              placeholder="Enter your question here..."
              value={q.question_text}
              onChange={e => updateQuestion(qIdx, 'question_text', e.target.value)}
            />

            <div className="grid grid-cols-2 gap-4">
              {q.options.map((opt, oIdx) => (
                <div key={oIdx} className={`flex items-center border rounded-lg p-2 ${q.correct_option_index === oIdx ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100'}`}>
                  <input
                    type="radio"
                    name={`correct-${qIdx}`}
                    checked={q.correct_option_index === oIdx}
                    onChange={() => updateQuestion(qIdx, 'correct_option_index', oIdx)}
                    className="mr-3"
                  />
                  <input
                    className="bg-transparent w-full outline-none text-sm"
                    value={opt}
                    onChange={e => updateOption(qIdx, oIdx, e.target.value)}
                    placeholder={`Option ${oIdx + 1}`}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>



      <button onClick={addQuestion} className="mt-8 w-full py-4 border-2 border-dashed border-slate-300 rounded-xl text-slate-400 font-bold hover:bg-slate-50">
        + Add Another Question
      </button>


    </div>
  );
}