'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Users,
  Target,
  ClipboardCheck,
  AlertTriangle,
  ShieldCheck,
  Clock3,
  Trophy,
  LineChart,
  Search,
} from 'lucide-react';

interface ResultDoc {
  id: string;
  userId?: string;
  userEmail?: string;
  universityId?: string;
  testId?: string;
  testTitle?: string;
  totalQuestions?: number;
  score?: number;
  attemptedQuestions?: number;
  percentage?: number;
  submittedAt?: any;
  proctoring?: {
    totalViolations?: number;
    violationPoints?: number;
    submitReason?: string;
  };
  category?: string;
  estimatedMinutesPerQuestion?: number;
}

interface StudentAggregate {
  key: string;
  label: string;
  attempts: number;
  avgAccuracy: number;
  avgViolationPoints: number;
}

interface SectionMetric {
  section: string;
  attempts: number;
  avgAccuracy: number;
  avgTimePerQuestion: number;
}

const toMillis = (value: any) => {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const getScore = (r: ResultDoc) => (
  typeof r.score === 'number' ? r.score : (r.attemptedQuestions || 0)
);

const getPercentage = (r: ResultDoc) => {
  if (typeof r.percentage === 'number') return r.percentage;
  const total = r.totalQuestions || 0;
  return total > 0 ? (getScore(r) / total) * 100 : 0;
};

export default function UniAdminAnalysisPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [universityId, setUniversityId] = useState<string | null>(null);
  const [studentCount, setStudentCount] = useState(0);
  const [results, setResults] = useState<ResultDoc[]>([]);
  const [sectionMetrics, setSectionMetrics] = useState<SectionMetric[]>([]);
  const [topStudents, setTopStudents] = useState<StudentAggregate[]>([]);
  const [allStudents, setAllStudents] = useState<StudentAggregate[]>([]);
  const [selectedStudentKey, setSelectedStudentKey] = useState<string>('');
  const [studentSearch, setStudentSearch] = useState('');
  const [recentAlerts, setRecentAlerts] = useState<ResultDoc[]>([]);
  const [error, setError] = useState('');
  const [loadingData, setLoadingData] = useState(true);

  const getStudentKey = (r: ResultDoc) => r.userId || r.userEmail || `unknown-${r.id}`;

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    async function fetchAnalysisPortal() {
      if (!user) return;

      try {
        setLoadingData(true);
        setError('');

        const adminDoc = await getDoc(doc(db, 'users', user.uid));
        const univId = adminDoc.data()?.universityId;

        if (!univId) {
          setError('University ID is missing for this admin account.');
          return;
        }

        setUniversityId(univId);

        const studentQ = query(collection(db, 'users'), where('role', '==', 'student'), where('universityId', '==', univId));
        const [studentSnap, modernSnap, legacySnap] = await Promise.all([
          getDocs(studentQ),
          getDocs(query(collection(db, 'test_results'), where('universityId', '==', univId))),
          getDocs(query(collection(db, 'testResults'), where('universityId', '==', univId))),
        ]);

        setStudentCount(studentSnap.size);

        const mergedResults = [
          ...modernSnap.docs.map((d) => ({ id: `modern-${d.id}`, ...d.data() } as ResultDoc)),
          ...legacySnap.docs.map((d) => ({ id: `legacy-${d.id}`, ...d.data() } as ResultDoc)),
        ].sort((a, b) => toMillis(b.submittedAt) - toMillis(a.submittedAt));

        // Build section/category metrics from linked tests
        const uniqueTestIds = Array.from(new Set(mergedResults.map((r) => r.testId).filter(Boolean) as string[]));
        const testEntries = await Promise.all(
          uniqueTestIds.map(async (testId) => {
            const snap = await getDoc(doc(db, 'tests', testId));
            if (!snap.exists()) return null;
            const data = snap.data() as { category?: string; duration?: number; totalQuestions?: number };
            return { id: snap.id, category: data.category || 'General', duration: data.duration || 0, totalQuestions: data.totalQuestions || 0 };
          })
        );

        const testMap = new Map<string, { category: string; duration: number; totalQuestions: number }>();
        testEntries.forEach((entry) => {
          if (entry) testMap.set(entry.id, entry);
        });

        const enrichedResults = mergedResults.map((r) => {
          const meta = r.testId ? testMap.get(r.testId) : undefined;
          const speed = meta && meta.totalQuestions > 0 && meta.duration > 0 ? meta.duration / meta.totalQuestions : 0;

          return {
            ...r,
            category: meta?.category || 'General',
            estimatedMinutesPerQuestion: speed,
          } as ResultDoc;
        });

        setResults(enrichedResults);

        const sectionBucket = new Map<string, { attempts: number; totalPct: number; totalSpeed: number }>();
        enrichedResults.forEach((r) => {
          const section = r.category || 'General';
          const speed = r.estimatedMinutesPerQuestion || 0;

          const prev = sectionBucket.get(section) || { attempts: 0, totalPct: 0, totalSpeed: 0 };
          sectionBucket.set(section, {
            attempts: prev.attempts + 1,
            totalPct: prev.totalPct + getPercentage(r),
            totalSpeed: prev.totalSpeed + speed,
          });
        });

        const sectionRows = Array.from(sectionBucket.entries())
          .map(([section, agg]) => ({
            section,
            attempts: agg.attempts,
            avgAccuracy: agg.attempts > 0 ? agg.totalPct / agg.attempts : 0,
            avgTimePerQuestion: agg.attempts > 0 ? agg.totalSpeed / agg.attempts : 0,
          }))
          .sort((a, b) => b.attempts - a.attempts);

        setSectionMetrics(sectionRows);

        // Student ranking list for recruitment filtering
        const studentBucket = new Map<string, { label: string; attempts: number; totalPct: number; totalVp: number }>();
        enrichedResults.forEach((r) => {
          const key = getStudentKey(r);
          const label = r.userEmail || 'Unknown';
          const prev = studentBucket.get(key) || { label, attempts: 0, totalPct: 0, totalVp: 0 };
          studentBucket.set(key, {
            label,
            attempts: prev.attempts + 1,
            totalPct: prev.totalPct + getPercentage(r),
            totalVp: prev.totalVp + (r.proctoring?.violationPoints || 0),
          });
        });

        const ranked = Array.from(studentBucket.entries())
          .map(([key, agg]) => ({
            key,
            label: agg.label,
            attempts: agg.attempts,
            avgAccuracy: agg.attempts > 0 ? agg.totalPct / agg.attempts : 0,
            avgViolationPoints: agg.attempts > 0 ? agg.totalVp / agg.attempts : 0,
          }))
          .sort((a, b) => {
            const accDelta = b.avgAccuracy - a.avgAccuracy;
            if (accDelta !== 0) return accDelta;
            return a.avgViolationPoints - b.avgViolationPoints;
          });

        setAllStudents(ranked);

        setTopStudents(ranked.slice(0, 8));
        setSelectedStudentKey((prev) => {
          if (prev && ranked.some((s) => s.key === prev)) return prev;
          return ranked[0]?.key || '';
        });

        const alerts = enrichedResults
          .filter((r) => (r.proctoring?.totalViolations || 0) > 0 || (r.proctoring?.submitReason && r.proctoring.submitReason !== 'manual'))
          .slice(0, 6);
        setRecentAlerts(alerts);
      } catch (error) {
        console.error('Analysis fetch error:', error);
        setError('Failed to load analysis data.');
      } finally {
        setLoadingData(false);
      }
    }

    if (user) fetchAnalysisPortal();
  }, [user]);

  const stats = useMemo(() => {
    const testsCompleted = results.length;
    const averageScore = testsCompleted > 0
      ? results.reduce((sum, r) => sum + getPercentage(r), 0) / testsCompleted
      : 0;
    const avgViolationPoints = testsCompleted > 0
      ? results.reduce((sum, r) => sum + (r.proctoring?.violationPoints || 0), 0) / testsCompleted
      : 0;
    const reliability = Math.max(0, Math.round(100 - avgViolationPoints * 10));
    const avgTimePerQuestion = sectionMetrics.length > 0
      ? sectionMetrics.reduce((sum, s) => sum + s.avgTimePerQuestion, 0) / sectionMetrics.length
      : 0;

    return {
      testsCompleted,
      averageScore,
      reliability,
      avgTimePerQuestion,
    };
  }, [results, sectionMetrics]);

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return allStudents;

    return allStudents.filter((s) => s.label.toLowerCase().includes(q));
  }, [allStudents, studentSearch]);

  const selectedStudent = useMemo(() => {
    return allStudents.find((s) => s.key === selectedStudentKey) || null;
  }, [allStudents, selectedStudentKey]);

  const selectedStudentResults = useMemo(() => {
    if (!selectedStudentKey) return [];

    return results
      .filter((r) => getStudentKey(r) === selectedStudentKey)
      .sort((a, b) => toMillis(a.submittedAt) - toMillis(b.submittedAt));
  }, [results, selectedStudentKey]);

  const selectedStudentSectionMetrics = useMemo(() => {
    const bucket = new Map<string, { attempts: number; totalPct: number; totalSpeed: number }>();

    selectedStudentResults.forEach((r) => {
      const key = r.category || 'General';
      const prev = bucket.get(key) || { attempts: 0, totalPct: 0, totalSpeed: 0 };
      bucket.set(key, {
        attempts: prev.attempts + 1,
        totalPct: prev.totalPct + getPercentage(r),
        totalSpeed: prev.totalSpeed + (r.estimatedMinutesPerQuestion || 0),
      });
    });

    return Array.from(bucket.entries())
      .map(([section, agg]) => ({
        section,
        attempts: agg.attempts,
        avgAccuracy: agg.attempts > 0 ? agg.totalPct / agg.attempts : 0,
        avgTimePerQuestion: agg.attempts > 0 ? agg.totalSpeed / agg.attempts : 0,
      }))
      .sort((a, b) => b.attempts - a.attempts);
  }, [selectedStudentResults]);

  const selectedStudentTrend = useMemo(() => {
    if (selectedStudentResults.length < 2) return 0;
    return getPercentage(selectedStudentResults[selectedStudentResults.length - 1]) - getPercentage(selectedStudentResults[0]);
  }, [selectedStudentResults]);

  if (loading || loadingData) return (
    <div className="flex items-center justify-center h-64">
      <div className="loading-dots"><span /><span /><span /></div>
    </div>
  );

  return (
    <div className="max-w-[1150px] mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-[-0.02em]">University Analysis Portal</h1>
        <p className="text-[var(--text-tertiary)] text-[13px] mt-1">Performance, integrity, ranking and recruitment signals for {universityId || 'your university'}.</p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded border border-[#F54E00]/20 bg-[#F54E00]/10 text-[#F54E00] text-[13px]">
          {error}
        </div>
      )}

      <div id="stats" className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Total Enrolled', value: String(studentCount), icon: Users, color: 'text-[var(--text-primary)]' },
          { label: 'Tests Taken', value: String(stats.testsCompleted), icon: ClipboardCheck, color: 'text-[var(--text-primary)]' },
          { label: 'Avg Score', value: `${stats.averageScore.toFixed(1)}%`, icon: Target, color: 'text-[#4CAF50]' },
          { label: 'Reliability', value: `${stats.reliability}/100`, icon: ShieldCheck, color: 'text-[var(--text-primary)]' },
          { label: 'Avg Time / Q', value: `${stats.avgTimePerQuestion.toFixed(2)}m`, icon: Clock3, color: 'text-[var(--text-primary)]' },
        ].map((s) => (
          <div key={s.label} className="window p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{s.label}</span>
              <s.icon size={14} className="text-[#F54E00]" />
            </div>
            <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="divider-dashed mb-6" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="window p-5">
          <h2 className="text-[14px] font-bold text-[var(--text-primary)] mb-3">Student View (Feedback)</h2>
          <ul className="space-y-2 text-[12px] text-[var(--text-secondary)]">
            <li>Primary Goal: Self-Improvement</li>
            <li>Focus: Explanations and Learning</li>
            <li>Key Metric: Accuracy and Strengths</li>
          </ul>
        </div>

        <div className="window p-5">
          <h2 className="text-[14px] font-bold text-[var(--text-primary)] mb-3">Admin View (Recruitment)</h2>
          <ul className="space-y-2 text-[12px] text-[var(--text-secondary)]">
            <li className="flex items-center gap-2"><Trophy size={13} className="text-[#F1A82C]" /> Primary Goal: Candidate Filtering</li>
            <li className="flex items-center gap-2"><ShieldCheck size={13} className="text-[#5E6AD2]" /> Focus: Integrity and Ranking</li>
            <li className="flex items-center gap-2"><Clock3 size={13} className="text-[#F54E00]" /> Key Metric: Reliability and Speed</li>
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="window p-5">
          <div className="flex items-center gap-2 mb-3">
            <LineChart size={14} className="text-[#5E6AD2]" />
            <h2 className="text-[14px] font-bold text-[var(--text-primary)]">Section Performance</h2>
          </div>
          {sectionMetrics.length === 0 ? (
            <p className="text-[12px] text-[var(--text-faint)]">No section metrics yet.</p>
          ) : (
            <div className="space-y-2">
              {sectionMetrics.map((row) => (
                <div key={row.section} className="p-3 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[12px] font-semibold text-[var(--text-primary)]">{row.section}</p>
                    <p className="text-[11px] text-[var(--text-faint)]">{row.attempts} attempts</p>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                    <span>Accuracy: {row.avgAccuracy.toFixed(1)}%</span>
                    <span>Avg Time/Q: {row.avgTimePerQuestion.toFixed(2)}m</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="window p-5">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={14} className="text-[#F1A82C]" />
            <h2 className="text-[14px] font-bold text-[var(--text-primary)]">Top Candidates</h2>
          </div>
          {topStudents.length === 0 ? (
            <p className="text-[12px] text-[var(--text-faint)]">No candidate data yet.</p>
          ) : (
            <div className="space-y-2">
              {topStudents.map((student, index) => (
                <div key={student.key} className="p-3 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[12px] font-semibold text-[var(--text-primary)]">#{index + 1} {student.label}</p>
                    <p className="text-[11px] text-[var(--text-faint)]">{student.attempts} tests</p>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                    <span>Accuracy: {student.avgAccuracy.toFixed(1)}%</span>
                    <span>Violation pts: {student.avgViolationPoints.toFixed(1)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="window p-5 mt-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-[14px] font-bold text-[var(--text-primary)]">Individual Student Performance Analysis</h2>
            <p className="text-[12px] text-[var(--text-faint)] mt-0.5">Select a student to view attempt history, trends, section strengths, and integrity profile.</p>
          </div>
          <div className="relative w-full max-w-sm">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
            <input
              type="text"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="Search student by email..."
              className="w-full pl-8 pr-3 py-2 rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--border-active)]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 border border-[var(--border-subtle)] rounded bg-[var(--bg-elevated)] max-h-[420px] overflow-y-auto">
            {filteredStudents.length === 0 ? (
              <p className="p-4 text-[12px] text-[var(--text-faint)]">No matching students.</p>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)]">
                {filteredStudents.map((student, idx) => (
                  <button
                    key={student.key}
                    type="button"
                    onClick={() => setSelectedStudentKey(student.key)}
                    className={`w-full text-left px-3 py-3 transition-colors ${selectedStudentKey === student.key ? 'bg-[#5E6AD2]/15' : 'hover:bg-[var(--bg-surface)]'}`}
                  >
                    <p className="text-[12px] font-semibold text-[var(--text-primary)] truncate">#{idx + 1} {student.label}</p>
                    <p className="text-[11px] text-[var(--text-faint)] mt-0.5">{student.attempts} attempts • {student.avgAccuracy.toFixed(1)}% avg</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-2 border border-[var(--border-subtle)] rounded bg-[var(--bg-elevated)] p-4">
            {!selectedStudent ? (
              <p className="text-[12px] text-[var(--text-faint)]">Select a student to view detailed analysis.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <p className="text-[14px] font-bold text-[var(--text-primary)]">{selectedStudent.label}</p>
                    <p className="text-[11px] text-[var(--text-faint)]">Rank #{allStudents.findIndex((s) => s.key === selectedStudent.key) + 1} • {selectedStudent.attempts} attempts</p>
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)]">
                    Trend: <span className={selectedStudentTrend >= 0 ? 'text-[#4CAF50]' : 'text-[#F54E00]'}>{selectedStudentTrend >= 0 ? '+' : ''}{selectedStudentTrend.toFixed(1)}%</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                  <div className="rounded border border-[var(--border-subtle)] p-2">
                    <p className="text-[10px] text-[var(--text-faint)] uppercase tracking-widest">Avg Accuracy</p>
                    <p className="text-[14px] font-bold text-[var(--text-primary)] mt-0.5">{selectedStudent.avgAccuracy.toFixed(1)}%</p>
                  </div>
                  <div className="rounded border border-[var(--border-subtle)] p-2">
                    <p className="text-[10px] text-[var(--text-faint)] uppercase tracking-widest">Avg Violation Pts</p>
                    <p className="text-[14px] font-bold text-[var(--text-primary)] mt-0.5">{selectedStudent.avgViolationPoints.toFixed(1)}</p>
                  </div>
                  <div className="rounded border border-[var(--border-subtle)] p-2">
                    <p className="text-[10px] text-[var(--text-faint)] uppercase tracking-widest">Reliability</p>
                    <p className="text-[14px] font-bold text-[var(--text-primary)] mt-0.5">{Math.max(0, Math.round(100 - selectedStudent.avgViolationPoints * 10))}/100</p>
                  </div>
                  <div className="rounded border border-[var(--border-subtle)] p-2">
                    <p className="text-[10px] text-[var(--text-faint)] uppercase tracking-widest">Best Score</p>
                    <p className="text-[14px] font-bold text-[#4CAF50] mt-0.5">{Math.max(...selectedStudentResults.map((r) => getPercentage(r)), 0).toFixed(1)}%</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                  <div className="rounded border border-[var(--border-subtle)] p-3">
                    <p className="text-[12px] font-semibold text-[var(--text-primary)] mb-2">Section-wise (Student)</p>
                    {selectedStudentSectionMetrics.length === 0 ? (
                      <p className="text-[11px] text-[var(--text-faint)]">No section attempts yet.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {selectedStudentSectionMetrics.map((row) => (
                          <div key={row.section} className="flex items-center justify-between text-[11px]">
                            <span className="text-[var(--text-secondary)]">{row.section}</span>
                            <span className="text-[var(--text-faint)]">{row.avgAccuracy.toFixed(1)}% • {row.avgTimePerQuestion.toFixed(2)}m/q</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded border border-[var(--border-subtle)] p-3">
                    <p className="text-[12px] font-semibold text-[var(--text-primary)] mb-2">Recent Attempts</p>
                    {selectedStudentResults.length === 0 ? (
                      <p className="text-[11px] text-[var(--text-faint)]">No attempts recorded.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-44 overflow-y-auto">
                        {[...selectedStudentResults].reverse().slice(0, 6).map((attempt) => (
                          <div key={attempt.id} className="flex items-center justify-between text-[11px]">
                            <span className="text-[var(--text-secondary)] truncate max-w-[58%]">{attempt.testTitle || 'Untitled Test'}</span>
                            <span className="text-[var(--text-faint)]">{getPercentage(attempt).toFixed(1)}% • V{attempt.proctoring?.totalViolations || 0}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div id="proctoring-alerts" className="window p-5 mt-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={14} className="text-[#F1A82C]" />
          <h2 className="text-[14px] font-bold text-[var(--text-primary)]">Recent Integrity Alerts</h2>
        </div>
        {recentAlerts.length === 0 ? (
          <p className="text-[var(--text-muted)] text-[13px]">No integrity alerts in recent submissions.</p>
        ) : (
          <div className="space-y-2">
            {recentAlerts.map((alert) => (
              <div key={alert.id} className="flex items-center justify-between p-3 rounded bg-[var(--bg-elevated)] border-l-2 border-[#F54E00]">
                <div>
                  <p className="text-[13px] font-semibold text-[var(--text-primary)]">{alert.userEmail || 'Unknown Student'}</p>
                  <p className="text-[12px] text-[var(--text-tertiary)]">
                    {alert.testTitle || 'Untitled Test'}
                    {' '}• Violations: {alert.proctoring?.totalViolations || 0}
                    {' '}• Reason: {alert.proctoring?.submitReason || 'manual'}
                  </p>
                </div>
                <p className="text-[11px] text-[var(--text-faint)] tabular-nums shrink-0">
                  {alert.submittedAt?.toDate ? alert.submittedAt.toDate().toLocaleString() : 'N/A'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}