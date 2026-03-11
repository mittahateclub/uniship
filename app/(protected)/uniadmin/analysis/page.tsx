'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Users, Target, ClipboardCheck, AlertTriangle } from 'lucide-react';

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
        const univId = 'HARV-001';
        const studentQ = query(collection(db, 'users'), where('role', '==', 'student'), where('universityId', '==', univId));
        const studentSnap = await getDocs(studentQ);
        const resultsQ = query(collection(db, 'testResults'), where('universityId', '==', univId));
        const resultsSnap = await getDocs(resultsQ);
        let totalScore = 0;
        resultsSnap.forEach(doc => totalScore += doc.data().score);
        setStats({
          totalStudents: studentSnap.size,
          testsCompleted: resultsSnap.size,
          averageScore: resultsSnap.size > 0 ? Math.round(totalScore / resultsSnap.size) : 0
        });
        const logsQ = query(collection(db, 'mock_proctoring_logs'), where('universityId', '==', univId), orderBy('timestamp', 'desc'), limit(5));
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

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="loading-dots"><span /><span /><span /></div>
    </div>
  );

  const statCards = [
    { label: 'Total Enrolled', value: stats.totalStudents, icon: Users, color: '' },
    { label: 'Average Score', value: `${stats.averageScore}%`, icon: Target, color: 'text-[#4CAF50]' },
    { label: 'Tests Taken', value: stats.testsCompleted, icon: ClipboardCheck, color: '' },
  ];

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-[-0.02em]">Student Performance Analysis</h1>
        <p className="text-[var(--text-tertiary)] text-[13px] mt-1">Overview of academic metrics and proctoring alerts</p>
      </div>

      <div id="stats" className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        {statCards.map((s) => (
          <div key={s.label} className="window p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{s.label}</span>
              <s.icon size={14} className="text-[#F54E00]" />
            </div>
            <p className={`text-2xl font-bold tabular-nums ${s.color || 'text-[var(--text-primary)]'}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="divider-dashed mb-6" />

      <div id="proctoring-alerts" className="window p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={14} className="text-[#F1A82C]" />
          <h2 className="text-[14px] font-bold text-[var(--text-primary)]">Recent Proctoring Alerts</h2>
        </div>
        {recentViolations.length === 0 ? (
          <p className="text-[var(--text-muted)] text-[13px]">No violations recorded recently.</p>
        ) : (
          <div className="space-y-2">
            {recentViolations.map((log) => (
              <div key={log.id} className="flex items-center justify-between p-3 rounded bg-[var(--bg-elevated)] border-l-2 border-[#F54E00]">
                <div>
                  <p className="text-[13px] font-semibold text-[var(--text-primary)]">{log.studentName} <span className="text-[var(--text-muted)] font-normal">({log.studentId})</span></p>
                  <p className="text-[12px] text-[var(--text-tertiary)]">{log.violationType} — {log.testTitle}</p>
                </div>
                <p className="text-[11px] text-[var(--text-faint)] tabular-nums shrink-0">{new Date(log.timestamp?.toDate()).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}