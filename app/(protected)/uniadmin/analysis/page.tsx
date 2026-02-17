'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';

interface AnalysisStats {
  totalStudents: number;
  testsCompleted: number;
  averageScore: number;
}

export default function StudentAnalysisPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<AnalysisStats>({ totalStudents: 0, testsCompleted: 0, averageScore: 0 });
  const [recentViolations, setRecentViolations] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    async function fetchAnalysis() {
      try {
        const univId = 'HARV-001'; // Placeholder for admin's universityId

        // 1. Fetch Students count
        const studentQ = query(collection(db, 'users'), where('role', '==', 'student'), where('universityId', '==', univId));
        const studentSnap = await getDocs(studentQ);
        
        // 2. Fetch Test Results
        const resultsQ = query(collection(db, 'testResults'), where('universityId', '==', univId));
        const resultsSnap = await getDocs(resultsQ);
        
        let totalScore = 0;
        resultsSnap.forEach(doc => totalScore += doc.data().score);

        setStats({
          totalStudents: studentSnap.size,
          testsCompleted: resultsSnap.size,
          averageScore: resultsSnap.size > 0 ? Math.round(totalScore / resultsSnap.size) : 0
        });

        // 3. Fetch Recent Proctoring Violations
        const logsQ = query(
          collection(db, 'mock_proctoring_logs'),
          where('universityId', '==', univId),
          orderBy('timestamp', 'desc'),
          limit(5)
        );
        const logsSnap = await getDocs(logsQ);
        const logs: any[] = [];
        logsSnap.forEach(doc => logs.push({ id: doc.id, ...doc.data() }));
        setRecentViolations(logs);

      } catch (error) {
        console.error("Analysis fetch error:", error);
      } finally {
        setLoadingData(false);
      }
    }

    if (user) fetchAnalysis();
  }, [user]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-white p-8 text-black">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Link href="/uniadmin/dashboard" className="hover:text-gray-600 mb-4 inline-block">← Back</Link>
          <h1 className="text-4xl font-bold">Student Performance Analysis</h1>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-black text-white p-8 rounded-xl shadow-lg">
            <p className="text-gray-400 text-sm uppercase font-bold">Total Enrolled</p>
            <p className="text-5xl font-bold mt-2">{stats.totalStudents}</p>
          </div>
          <div className="bg-black text-white p-8 rounded-xl shadow-lg">
            <p className="text-gray-400 text-sm uppercase font-bold">Average Score</p>
            <p className="text-5xl font-bold mt-2 text-green-400">{stats.averageScore}%</p>
          </div>
          <div className="bg-black text-white p-8 rounded-xl shadow-lg">
            <p className="text-gray-400 text-sm uppercase font-bold">Tests Taken</p>
            <p className="text-5xl font-bold mt-2">{stats.testsCompleted}</p>
          </div>
        </div>

        {/* Proctoring Alerts */}
        <div className="bg-gray-50 p-8 rounded-xl border border-gray-200">
          <h2 className="text-2xl font-bold mb-6 flex items-center">
            <span className="mr-2">⚠️</span> Recent Proctoring Alerts
          </h2>
          {recentViolations.length === 0 ? (
            <p className="text-gray-500">No violations recorded recently.</p>
          ) : (
            <div className="space-y-4">
              {recentViolations.map((log) => (
                <div key={log.id} className="bg-white p-4 rounded border-l-4 border-red-500 shadow-sm flex justify-between items-center">
                  <div>
                    <p className="font-bold">{log.studentName} <span className="text-gray-500 font-normal">({log.studentId})</span></p>
                    <p className="text-sm text-gray-600">Type: {log.violationType} — {log.testTitle}</p>
                  </div>
                  <p className="text-xs text-gray-400">{new Date(log.timestamp?.toDate()).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}