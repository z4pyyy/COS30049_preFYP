'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function AdminQuizResults() {
  const supabase = createClient();
  const [attempts, setAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchResults() {
      // Joins the attempts with the quiz titles
      const { data, error } = await supabase
        .from('quiz_attempts')
        .select(`
          id,
          score,
          passed,
          created_at,
          quizzes ( title )
        `)
        .order('created_at', { ascending: false });

      if (data) setAttempts(data);
      setLoading(false);
    }
    fetchResults();
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Staff Training Results</h1>
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full table-auto">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quiz</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {attempts.map((item) => (
              <tr key={item.id}>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {new Date(item.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                  {item.quizzes?.title || 'General Quiz'}
                </td>
                <td className="px-6 py-4 text-sm font-bold">{item.score}%</td>
                <td className="px-6 py-4 text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                    item.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {item.passed ? 'PASSED' : 'FAILED'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}