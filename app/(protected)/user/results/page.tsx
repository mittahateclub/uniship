'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

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
      <div className="min-h-screen flex items-center justify-center bg-white text-black">
        Loading your results...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-black mb-2">My Results</h1>
          <p className="text-gray-600">Track your performance across all assessments.</p>
        </div>

        {results.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
            <p className="text-gray-500 text-lg">You haven't completed any tests yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-black text-white">
                  <th className="p-4 text-left border border-black">Test Name</th>
                  <th className="p-4 text-center border border-black">Score</th>
                  <th className="p-4 text-center border border-black">Percentage</th>
                  <th className="p-4 text-right border border-black">Date</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result) => {
                  const percentage = ((result.score / result.totalQuestions) * 100).toFixed(1);
                  const date = result.submittedAt?.toDate().toLocaleDateString() || 'N/A';
                  
                  return (
                    <tr key={result.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 border border-gray-200 font-bold text-black">
                        {result.testTitle}
                      </td>
                      <td className="p-4 border border-gray-200 text-center text-black">
                        {result.score} / {result.totalQuestions}
                      </td>
                      <td className="p-4 border border-gray-200 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          Number(percentage) >= 70 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {percentage}%
                        </span>
                      </td>
                      <td className="p-4 border border-gray-200 text-right text-gray-600">
                        {date}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}