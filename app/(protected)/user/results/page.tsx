'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { BarChart3, Trophy, CalendarDays } from 'lucide-react';

interface TestResult {
  id: string;
  testTitle: string;
  score?: number;
  attemptedQuestions?: number;
  totalQuestions: number;
  percentage?: number;
  scoringMode?: 'auto' | 'attempted';
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
      <div className="flex items-center justify-center h-64">
        <div className="loading-dots"><span /><span /><span /></div>
      </div>
    );
  }

  return (
    <div className="max-w-[1000px] mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-[-0.02em]">My Results</h1>
        <p className="text-[var(--text-tertiary)] text-[13px] mt-1">Track your performance across all assessments.</p>
      </div>

      {results.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-[var(--border-active)] rounded">
          <Trophy size={28} className="mx-auto text-[var(--text-faint)] mb-3" />
          <p className="text-[var(--text-primary)] text-[13px] font-medium">You haven&apos;t completed any tests yet.</p>
          <p className="text-[var(--text-faint)] text-[12px] mt-1">Take a test and your results will show here.</p>
        </div>
      ) : (
        <div className="window overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-subtle)]">
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-widest">Test Name</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-widest">Score</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-widest">Percentage</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-widest">Date</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result) => {
                  const score = typeof result.score === 'number' ? result.score : (result.attemptedQuestions || 0);
                  const percentage = (typeof result.percentage === 'number'
                    ? result.percentage
                    : ((score / result.totalQuestions) * 100)
                  ).toFixed(1);
                  const date = result.submittedAt?.toDate().toLocaleDateString() || 'N/A';
                  const pct = Number(percentage);
                  
                  return (
                    <tr key={result.id} className="border-b border-[var(--border-subtle)]/50 hover:bg-[#1a1a1a] transition-colors duration-150">
                      <td className="px-4 py-3 text-[13px] font-medium text-[var(--text-primary)]">
                        {result.testTitle}
                      </td>
                      <td className="px-4 py-3 text-center text-[13px] tabular-nums">
                        <span className="font-bold text-[var(--text-primary)]">{score}</span>
                        <span className="text-[var(--text-faint)]"> / {result.totalQuestions}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold tabular-nums ${
                          pct >= 80 ? 'bg-[#4CAF50]/10 text-[#4CAF50]' :
                          pct >= 60 ? 'bg-[#F1A82C]/10 text-[#F1A82C]' :
                          'bg-[#F54E00]/10 text-[#F54E00]'
                        }`}>
                          {percentage}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-[12px] text-[var(--text-muted)] tabular-nums">
                        <span className="flex items-center justify-end gap-1.5">
                          <CalendarDays size={11} />
                          {date}
                        </span>
                        {result.scoringMode === 'attempted' && (
                          <span className="block text-[10px] text-[var(--text-faint)] mt-0.5">attempt-based</span>
                        )}
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
  );
}