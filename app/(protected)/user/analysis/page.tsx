'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  TrendingUp,
  Target,
  AlertTriangle,
  LineChart,
} from 'lucide-react';

interface TestResult {
  id: string;
  testId?: string;
  testTitle?: string;
  score?: number;
  attemptedQuestions?: number;
  totalQuestions?: number;
  percentage?: number;
  submittedAt?: any;
  scoringMode?: 'auto' | 'attempted';
  proctoring?: {
    violationPoints?: number;
    totalViolations?: number;
    submitReason?: string;
  };
}

interface TestMeta {
  id: string;
  title?: string;
  category?: string;
  duration?: number;
  totalQuestions?: number;
  problems?: Array<{ difficulty?: string }>;
}

interface EnrichedResult extends TestResult {
  computedScore: number;
  computedPercentage: number;
  category: string;
  estimatedMinutesPerQuestion: number;
}

const toMillis = (value: any) => {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const safePct = (score: number, total: number) => (total > 0 ? (score / total) * 100 : 0);

export default function UserAnalysisPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<EnrichedResult[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    async function loadData() {
      if (!user) return;

      try {
        setLoading(true);
        setError('');

        const [currentSnap, legacySnap] = await Promise.all([
          getDocs(query(collection(db, 'test_results'), where('userId', '==', user.uid))),
          getDocs(query(collection(db, 'testResults'), where('userId', '==', user.uid))),
        ]);

        const rawResults = [
          ...currentSnap.docs.map((d) => ({ id: d.id, ...d.data() } as TestResult)),
          ...legacySnap.docs.map((d) => ({ id: d.id, ...d.data() } as TestResult)),
        ].sort((a, b) => toMillis(a.submittedAt) - toMillis(b.submittedAt));

        const uniqueTestIds = Array.from(new Set(rawResults.map((r) => r.testId).filter(Boolean) as string[]));
        const testEntries = await Promise.all(
          uniqueTestIds.map(async (testId) => {
            const snap = await getDoc(doc(db, 'tests', testId));
            if (!snap.exists()) return null;
            return { id: snap.id, ...(snap.data() as Omit<TestMeta, 'id'>) } as TestMeta;
          })
        );

        const testMap = new Map<string, TestMeta>();
        testEntries.forEach((entry) => {
          if (entry) testMap.set(entry.id, entry);
        });

        const enriched = rawResults.map((result) => {
          const score = typeof result.score === 'number' ? result.score : (result.attemptedQuestions || 0);
          const totalQuestions = result.totalQuestions || testMap.get(result.testId || '')?.totalQuestions || 0;
          const percentage = typeof result.percentage === 'number' ? result.percentage : safePct(score, totalQuestions);
          const testMeta = result.testId ? testMap.get(result.testId) : undefined;
          const duration = testMeta?.duration || 0;
          const estimatedMinutesPerQuestion = totalQuestions > 0 && duration > 0 ? duration / totalQuestions : 0;

          return {
            ...result,
            computedScore: score,
            computedPercentage: percentage,
            category: testMeta?.category || 'General',
            estimatedMinutesPerQuestion,
          } as EnrichedResult;
        });

        setResults(enriched);
      } catch (e: any) {
        setError(e?.message || 'Failed to load analysis data.');
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading && user) loadData();
  }, [authLoading, user]);

  const metrics = useMemo(() => {
    const attempts = results.length;
    const avgAccuracy = attempts > 0
      ? results.reduce((sum, r) => sum + r.computedPercentage, 0) / attempts
      : 0;
    const bestAccuracy = attempts > 0
      ? Math.max(...results.map((r) => r.computedPercentage))
      : 0;
    const avgTimePerQuestion = attempts > 0
      ? results.reduce((sum, r) => sum + r.estimatedMinutesPerQuestion, 0) / attempts
      : 0;
    const avgViolationPoints = attempts > 0
      ? results.reduce((sum, r) => sum + (r.proctoring?.violationPoints || 0), 0) / attempts
      : 0;
    const reliabilityScore = Math.max(0, Math.round(100 - avgViolationPoints * 10));
    const recent = [...results].slice(-5);
    const trendDelta = recent.length >= 2
      ? recent[recent.length - 1].computedPercentage - recent[0].computedPercentage
      : 0;

    return {
      attempts,
      avgAccuracy,
      bestAccuracy,
      avgTimePerQuestion,
      reliabilityScore,
      trendDelta,
    };
  }, [results]);

  const bySection = useMemo(() => {
    const bucket = new Map<string, EnrichedResult[]>();

    results.forEach((result) => {
      const key = result.category || 'General';
      const list = bucket.get(key) || [];
      list.push(result);
      bucket.set(key, list);
    });

    return Array.from(bucket.entries())
      .map(([section, list]) => {
        const attempts = list.length;
        const accuracy = attempts > 0 ? list.reduce((sum, r) => sum + r.computedPercentage, 0) / attempts : 0;
        const avgTime = attempts > 0 ? list.reduce((sum, r) => sum + r.estimatedMinutesPerQuestion, 0) / attempts : 0;
        return { section, attempts, accuracy, avgTime };
      })
      .sort((a, b) => b.attempts - a.attempts);
  }, [results]);

  const recommendation = useMemo(() => {
    if (bySection.length === 0) {
      return 'Take at least one test to unlock personalized recommendations.';
    }
    const weakest = [...bySection].sort((a, b) => a.accuracy - b.accuracy)[0];
    if (weakest.accuracy < 60) {
      return `Focus on ${weakest.section}: accuracy is ${weakest.accuracy.toFixed(1)}%. Revisit fundamentals and solve timed practice sets.`;
    }
    return `You are consistent across sections. Push for speed gains in ${weakest.section} while preserving accuracy.`;
  }, [bySection]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-dots"><span /><span /><span /></div>
      </div>
    );
  }

  return (
    <div className="max-w-[1100px] mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-[-0.02em]">My Analysis</h1>
        <p className="text-[13px] text-[var(--text-tertiary)] mt-1">Track growth, section strengths, and recruiter-facing reliability signals.</p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded border border-[#F54E00]/20 bg-[#F54E00]/10 text-[#F54E00] text-[13px]">
          {error}
        </div>
      )}

      {results.length === 0 ? (
        <div className="window p-12 text-center">
          <LineChart size={28} className="mx-auto text-[var(--text-faint)] mb-3" />
          <p className="text-[13px] font-medium text-[var(--text-primary)]">No test attempts yet.</p>
          <p className="text-[12px] text-[var(--text-faint)] mt-1">Complete a test to see learning feedback and progress analysis.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            <div className="window p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">Tests Taken</p>
              <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{metrics.attempts}</p>
            </div>
            <div className="window p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">Avg Accuracy</p>
              <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{metrics.avgAccuracy.toFixed(1)}%</p>
            </div>
            <div className="window p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">Best Score</p>
              <p className="text-2xl font-bold text-[#4CAF50] mt-1">{metrics.bestAccuracy.toFixed(1)}%</p>
            </div>
            <div className="window p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">Avg Time / Q</p>
              <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{metrics.avgTimePerQuestion.toFixed(2)}m</p>
            </div>
            <div className="window p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">Reliability</p>
              <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{metrics.reliabilityScore}/100</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <div className="window p-5 lg:col-span-2">
              <h2 className="text-[14px] font-bold text-[var(--text-primary)] mb-3">Section-Wise Accuracy & Speed</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)]">
                      <th className="px-2 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">Section</th>
                      <th className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">Attempts</th>
                      <th className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">Accuracy</th>
                      <th className="px-2 py-2 text-right text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">Avg Time / Q</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bySection.map((row) => (
                      <tr key={row.section} className="border-b border-[var(--border-subtle)]/50">
                        <td className="px-2 py-2 text-[12px] font-medium text-[var(--text-primary)]">{row.section}</td>
                        <td className="px-2 py-2 text-center text-[12px] text-[var(--text-secondary)]">{row.attempts}</td>
                        <td className="px-2 py-2 text-center text-[12px] text-[var(--text-secondary)]">{row.accuracy.toFixed(1)}%</td>
                        <td className="px-2 py-2 text-right text-[12px] text-[var(--text-secondary)]">{row.avgTime.toFixed(2)}m</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-[11px] text-[var(--text-faint)]">Speed is estimated from exam duration divided by total questions.</p>
            </div>

            <div className="window p-5">
              <h2 className="text-[14px] font-bold text-[var(--text-primary)] mb-3">Learning Coach</h2>
              <div className="space-y-3 text-[12px] text-[var(--text-secondary)]">
                <div className="flex items-start gap-2">
                  <Target size={14} className="text-[#5E6AD2] shrink-0 mt-0.5" />
                  <p>{recommendation}</p>
                </div>
                <div className="flex items-start gap-2">
                  <TrendingUp size={14} className="text-[#4CAF50] shrink-0 mt-0.5" />
                  <p>Trend over last 5 attempts: <span className={metrics.trendDelta >= 0 ? 'text-[#4CAF50]' : 'text-[#F54E00]'}>{metrics.trendDelta >= 0 ? '+' : ''}{metrics.trendDelta.toFixed(1)}%</span></p>
                </div>
              </div>
            </div>
          </div>

          <div className="window p-5 mt-6">
            <h2 className="text-[14px] font-bold text-[var(--text-primary)] mb-3">Past Attempts</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)]">
                    <th className="px-2 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">Test</th>
                    <th className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">Section</th>
                    <th className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">Score</th>
                    <th className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">Accuracy</th>
                    <th className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">Violations</th>
                    <th className="px-2 py-2 text-right text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {[...results].reverse().slice(0, 12).map((r) => (
                    <tr key={r.id} className="border-b border-[var(--border-subtle)]/50">
                      <td className="px-2 py-2 text-[12px] font-medium text-[var(--text-primary)]">{r.testTitle || 'Untitled Test'}</td>
                      <td className="px-2 py-2 text-center text-[12px] text-[var(--text-secondary)]">{r.category}</td>
                      <td className="px-2 py-2 text-center text-[12px] text-[var(--text-secondary)]">{r.computedScore}/{r.totalQuestions || 0}</td>
                      <td className="px-2 py-2 text-center text-[12px] text-[var(--text-secondary)]">{r.computedPercentage.toFixed(1)}%</td>
                      <td className="px-2 py-2 text-center">
                        <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-secondary)]">
                          <AlertTriangle size={11} className="text-[#F1A82C]" />
                          {r.proctoring?.totalViolations || 0}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right text-[11px] text-[var(--text-faint)]">
                        {r.submittedAt?.toDate ? r.submittedAt.toDate().toLocaleDateString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
