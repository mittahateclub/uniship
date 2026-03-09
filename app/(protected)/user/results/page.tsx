'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { BarChart3, Trophy, CalendarDays } from 'lucide-react';

interface TestResult {
  id: string;
  testTitle: string;
  score: number;
  totalQuestions: number;
  submittedAt: any;
}

export default function ResultsPage() {
  const { user, loading: authLoading } = useAuth();
  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchResults() {
      if (!user) return;
      try {
        const q = query(
          collection(db, 'test_results'),
          where('userId', '==', user.uid),
          orderBy('submittedAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        const fetchedResults = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as TestResult[];
        setResults(fetchedResults);
      } catch (error) {
        console.error("Error fetching results:", error);
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading) {
      fetchResults();
    }
  }, [user, authLoading]);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-dots"><span /><span /><span /></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-10">
      <div className="max-w-5xl mx-auto animate-fade-in">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-pink-500/10 rounded-xl flex items-center justify-center">
              <BarChart3 size={20} className="text-pink-400" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-100">My Results</h1>
          </div>
          <p className="text-zinc-500">Track your performance across all assessments.</p>
        </div>

        {results.length === 0 ? (
          <div className="text-center py-16 bg-zinc-900 border border-zinc-800 border-dashed rounded-2xl">
            <Trophy size={40} className="mx-auto text-zinc-600 mb-3" />
            <p className="text-zinc-400 font-medium">You haven&apos;t completed any tests yet.</p>
            <p className="text-zinc-600 text-sm mt-1">Take a test and your results will show here.</p>
          </div>
        ) : (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Test Name</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">Score</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">Percentage</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {results.map((result) => {
                    const percentage = ((result.score / result.totalQuestions) * 100).toFixed(1);
                    const date = result.submittedAt?.toDate().toLocaleDateString() || 'N/A';
                    const pct = Number(percentage);
                    
                    return (
                      <tr key={result.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="px-6 py-4 font-semibold text-zinc-100">
                          {result.testTitle}
                        </td>
                        <td className="px-6 py-4 text-center text-zinc-300">
                          <span className="font-semibold">{result.score}</span>
                          <span className="text-zinc-600"> / {result.totalQuestions}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                            pct >= 80 ? 'bg-emerald-500/10 text-emerald-400' :
                            pct >= 60 ? 'bg-amber-500/10 text-amber-400' :
                            'bg-red-500/10 text-red-400'
                          }`}>
                            {percentage}%
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-sm text-zinc-500 flex items-center justify-end gap-1.5">
                          <CalendarDays size={13} />
                          {date}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}