'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Trophy, CalendarDays, BarChart3, X, Eye, TrendingUp, CheckCircle2, XCircle, Award } from 'lucide-react';

interface Problem {
  questionDescription?: string;
  correctAnswer?: string;
  expectedOutput?: string;
  sampleTestCases?: Array<{ input: string; output: string }>;
}

interface TestResult {
  id: string;
  testId?: string;
  testTitle: string;
  score?: number;
  attemptedQuestions?: number;
  totalQuestions: number;
  percentage?: number;
  scoringMode?: 'auto' | 'attempted';
  universityId?: string;
  userId?: string;
  userEmail?: string;
  answers?: Record<string, string>;
  questionEvaluations?: Array<{
    index: number;
    verdict: 'AC' | 'WA' | 'TLE' | 'CE' | 'RE' | 'UNGRADED' | 'UNANSWERED';
    passed?: number;
    total?: number;
    failedCase?: number | null;
    usedHiddenCases?: boolean;
  }>;
  submittedAt: any;
}

interface AnalysisDetails {
  rank: number;
  totalParticipants: number;
  percentile: number;
  averagePercentage: number;
  topPercentage: number;
  board: Array<{
    label: string;
    score: number;
    percentage: number;
    isYou: boolean;
  }>;
  questionStats: {
    correct: number;
    incorrect: number;
    ungraded: number;
    unanswered: number;
  } | null;
}

export default function ResultsPage() {
  const { user, loading: authLoading } = useAuth();
  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeResult, setActiveResult] = useState<TestResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [analysis, setAnalysis] = useState<AnalysisDetails | null>(null);

  const toMillis = (value: any) => {
    if (!value) return 0;
    if (typeof value?.toMillis === 'function') return value.toMillis();
    if (typeof value?.toDate === 'function') return value.toDate().getTime();
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const getScore = (result: TestResult) => (
    typeof result.score === 'number' ? result.score : (result.attemptedQuestions || 0)
  );

  const getPercentage = (result: TestResult) => {
    if (typeof result.percentage === 'number') return result.percentage;
    const score = getScore(result);
    return result.totalQuestions > 0 ? (score / result.totalQuestions) * 100 : 0;
  };

  const getExpectedAnswer = (problem: Problem) => (
    (problem.correctAnswer || '').trim() ||
    (problem.expectedOutput || '').trim() ||
    (problem.sampleTestCases?.[0]?.output || '').trim()
  );

  const normalize = (value: string) => (
    value.trim().replace(/\r\n/g, '\n').replace(/\s+/g, ' ').toLowerCase()
  );

  const loadAnalysis = async (result: TestResult) => {
    if (!user) return;

    setActiveResult(result);
    setAnalysis(null);
    setAnalysisError('');
    setAnalysisLoading(true);

    try {
      if (!result.testId) {
        throw new Error('This result record is missing test reference.');
      }

      const peersSnapshot = await getDocs(
        query(collection(db, 'test_results'), where('testId', '==', result.testId))
      );

      const peersRaw = peersSnapshot.docs.map((d) => ({ id: d.id, ...d.data() } as TestResult));
      const peers = peersRaw.filter((r) => r.universityId && r.universityId === result.universityId);
      const scopedPeers = peers.length > 0 ? peers : peersRaw;

      const ranked = [...scopedPeers].sort((a, b) => {
        const pctDelta = getPercentage(b) - getPercentage(a);
        if (pctDelta !== 0) return pctDelta;

        const scoreDelta = getScore(b) - getScore(a);
        if (scoreDelta !== 0) return scoreDelta;

        return toMillis(a.submittedAt) - toMillis(b.submittedAt);
      });

      const myIndex = ranked.findIndex((r) => r.id === result.id || (r.userId && r.userId === user.uid));
      const rank = myIndex >= 0 ? myIndex + 1 : ranked.length;
      const totalParticipants = ranked.length;
      const percentile = totalParticipants > 0
        ? Math.max(0, Math.round(((totalParticipants - rank) / totalParticipants) * 1000) / 10)
        : 0;

      const averagePercentage = totalParticipants > 0
        ? ranked.reduce((sum, r) => sum + getPercentage(r), 0) / totalParticipants
        : 0;
      const topPercentage = totalParticipants > 0 ? getPercentage(ranked[0]) : 0;

      let anonCounter = 1;
      const board = ranked.map((r) => {
        const isYou = r.userId === user.uid || r.id === result.id;
        const label = isYou ? 'You' : `Anonymous ${anonCounter++}`;

        return {
          label,
          score: getScore(r),
          percentage: getPercentage(r),
          isYou,
        };
      });

      let questionStats: AnalysisDetails['questionStats'] = null;
      if (result.testId) {
        const testSnap = await getDoc(doc(db, 'tests', result.testId));
        const problems = (testSnap.data()?.problems || []) as Problem[];

        if (problems.length > 0) {
          let correct = 0;
          let incorrect = 0;
          let ungraded = 0;
          let unanswered = 0;

          const hasQuestionEvaluations = Array.isArray(result.questionEvaluations) && result.questionEvaluations.length > 0;

          if (hasQuestionEvaluations) {
            const byIndex = new Map(result.questionEvaluations!.map((entry) => [entry.index, entry]));

            for (let index = 0; index < problems.length; index += 1) {
              const entry = byIndex.get(index);
              const verdict = entry?.verdict || 'UNANSWERED';

              if (verdict === 'UNANSWERED') {
                unanswered += 1;
              } else if (verdict === 'UNGRADED') {
                ungraded += 1;
              } else if (verdict === 'AC') {
                correct += 1;
              } else {
                incorrect += 1;
              }
            }

            questionStats = { correct, incorrect, ungraded, unanswered };
          } else {
            // Legacy fallback for old records that do not have per-question judge verdicts.
            problems.forEach((problem, index) => {
              const answer = (result.answers?.[String(index)] || '').trim();
              const expected = getExpectedAnswer(problem);

              if (!answer) {
                unanswered += 1;
                return;
              }
              if (!expected) {
                ungraded += 1;
                return;
              }
              if (normalize(answer) === normalize(expected)) {
                correct += 1;
              } else {
                incorrect += 1;
              }
            });

            questionStats = { correct, incorrect, ungraded, unanswered };
          }
        }
      }

      setAnalysis({
        rank,
        totalParticipants,
        percentile,
        averagePercentage,
        topPercentage,
        board,
        questionStats,
      });
    } catch (error: any) {
      setAnalysisError(error?.message || 'Failed to load detailed analysis.');
    } finally {
      setAnalysisLoading(false);
    }
  };

  useEffect(() => {
    async function fetchResults() {
      if (!user) return;
      try {
        // Avoid requiring a composite index by sorting client-side.
        const currentResultsQ = query(
          collection(db, 'test_results'),
          where('userId', '==', user.uid)
        );

        const legacyResultsQ = query(
          collection(db, 'testResults'),
          where('userId', '==', user.uid)
        );

        const [currentSnapshot, legacySnapshot] = await Promise.all([
          getDocs(currentResultsQ),
          getDocs(legacyResultsQ),
        ]);

        const combined = [
          ...currentSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as TestResult)),
          ...legacySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as TestResult)),
        ];

        combined.sort((a, b) => toMillis(b.submittedAt) - toMillis(a.submittedAt));
        setResults(combined);
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
        <>
          {/* Summary Stats */}
          {(() => {
            const totalTests = results.length;
            const avgPct = results.reduce((sum, r) => sum + getPercentage(r), 0) / totalTests;
            const bestPct = Math.max(...results.map((r) => getPercentage(r)));
            const bestResult = results.find((r) => getPercentage(r) === bestPct);
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div className="window p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg bg-[#5E6AD2]/10 flex items-center justify-center">
                      <Trophy size={14} className="text-[#5E6AD2]" />
                    </div>
                  </div>
                  <p className="text-xl font-bold text-[var(--text-primary)] tabular-nums">{totalTests}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)] mt-0.5">Tests Taken</p>
                </div>
                <div className="window p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg bg-[#4CAF50]/10 flex items-center justify-center">
                      <TrendingUp size={14} className="text-[#4CAF50]" />
                    </div>
                  </div>
                  <p className="text-xl font-bold text-[var(--text-primary)] tabular-nums">{avgPct.toFixed(1)}%</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)] mt-0.5">Average Score</p>
                </div>
                <div className="window p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg bg-[#F1A82C]/10 flex items-center justify-center">
                      <Award size={14} className="text-[#F1A82C]" />
                    </div>
                  </div>
                  <p className="text-xl font-bold text-[var(--text-primary)] tabular-nums">{bestPct.toFixed(1)}%</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)] mt-0.5">Best Score</p>
                </div>
                <div className="window p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg bg-[#F54E00]/10 flex items-center justify-center">
                      <CheckCircle2 size={14} className="text-[#F54E00]" />
                    </div>
                  </div>
                  <p className="text-xl font-bold text-[var(--text-primary)] tabular-nums leading-tight truncate" title={bestResult?.testTitle}>{bestResult?.testTitle || '—'}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)] mt-0.5">Top Test</p>
                </div>
              </div>
            );
          })()}

          {/* Result Cards */}
          <div className="space-y-3">
            {results.map((result) => {
              const score = getScore(result);
              const percentage = getPercentage(result).toFixed(1);
              const date = result.submittedAt?.toDate?.()?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) || 'N/A';
              const pct = Number(percentage);

              return (
                <div key={result.id} className="window p-0 overflow-hidden">
                  <div className="flex items-stretch">
                    {/* Score indicator bar */}
                    <div className={`w-1 shrink-0 ${
                      pct >= 80 ? 'bg-[#4CAF50]' :
                      pct >= 60 ? 'bg-[#F1A82C]' :
                      'bg-[#F54E00]'
                    }`} />

                    <div className="flex-1 p-4">
                      <div className="flex items-start justify-between gap-4">
                        {/* Left: Title + meta */}
                        <div className="min-w-0 flex-1">
                          <h3 className="text-[14px] font-semibold text-[var(--text-primary)] truncate">{result.testTitle}</h3>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="flex items-center gap-1 text-[12px] text-[var(--text-tertiary)]">
                              <CalendarDays size={11} className="text-[var(--text-faint)]" />
                              {date}
                            </span>
                            {result.scoringMode === 'attempted' && (
                              <span className="text-[10px] text-[var(--text-faint)] bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded">attempt-based</span>
                            )}
                          </div>
                        </div>

                        {/* Right: Score + Percentage */}
                        <div className="flex items-center gap-4 shrink-0">
                          <div className="text-right">
                            <p className="text-[11px] text-[var(--text-faint)] font-medium">Score</p>
                            <p className="text-[15px] font-bold text-[var(--text-primary)] tabular-nums mt-0.5">
                              {score}<span className="text-[var(--text-faint)] font-normal text-[12px]"> / {result.totalQuestions}</span>
                            </p>
                          </div>
                          <div className={`w-[52px] h-[52px] rounded-full flex items-center justify-center border-2 ${
                            pct >= 80 ? 'border-[#4CAF50] bg-[#4CAF50]/5' :
                            pct >= 60 ? 'border-[#F1A82C] bg-[#F1A82C]/5' :
                            'border-[#F54E00] bg-[#F54E00]/5'
                          }`}>
                            <span className={`text-[13px] font-bold tabular-nums ${
                              pct >= 80 ? 'text-[#4CAF50]' :
                              pct >= 60 ? 'text-[#F1A82C]' :
                              'text-[#F54E00]'
                            }`}>{percentage}%</span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border-subtle)]/50">
                        <button
                          type="button"
                          onClick={() => loadAnalysis(result)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-[#5E6AD2] bg-[#5E6AD2]/8 hover:bg-[#5E6AD2]/15 transition-colors"
                        >
                          <BarChart3 size={12} />
                          View Analysis
                        </button>
                        <a
                          href={`/user/results/review/${result.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-[var(--text-tertiary)] bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/80 transition-colors border border-[var(--border-subtle)]"
                        >
                          <Eye size={12} />
                          Review Questions
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {activeResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => {
              setActiveResult(null);
              setAnalysis(null);
              setAnalysisError('');
            }}
          />

          <div className="relative w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">Detailed Analysis</h2>
                <p className="text-[12px] text-[var(--text-tertiary)] mt-0.5">{activeResult.testTitle}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveResult(null);
                  setAnalysis(null);
                  setAnalysisError('');
                }}
                className="p-1.5 rounded hover:bg-[var(--bg-elevated)] text-[var(--text-faint)]"
              >
                <X size={16} />
              </button>
            </div>

            {analysisLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="loading-dots"><span /><span /><span /></div>
              </div>
            ) : analysisError ? (
              <div className="p-3 rounded border border-[#F54E00]/30 bg-[#F54E00]/10 text-[#F54E00] text-[13px]">
                {analysisError}
              </div>
            ) : analysis ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
                    <p className="text-[10px] uppercase tracking-widest text-[var(--text-faint)] font-bold">Your Rank</p>
                    <p className="text-xl font-bold text-[var(--text-primary)] mt-1">#{analysis.rank}</p>
                  </div>
                  <div className="p-3 rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
                    <p className="text-[10px] uppercase tracking-widest text-[var(--text-faint)] font-bold">Participants</p>
                    <p className="text-xl font-bold text-[var(--text-primary)] mt-1">{analysis.totalParticipants}</p>
                  </div>
                  <div className="p-3 rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
                    <p className="text-[10px] uppercase tracking-widest text-[var(--text-faint)] font-bold">Percentile</p>
                    <p className="text-xl font-bold text-[var(--text-primary)] mt-1">{analysis.percentile}%</p>
                  </div>
                  <div className="p-3 rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
                    <p className="text-[10px] uppercase tracking-widest text-[var(--text-faint)] font-bold">Class Avg</p>
                    <p className="text-xl font-bold text-[var(--text-primary)] mt-1">{analysis.averagePercentage.toFixed(1)}%</p>
                  </div>
                </div>

                {analysis.questionStats && (
                  <div className="rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
                    <h3 className="text-[13px] font-semibold text-[var(--text-primary)] mb-2">Question Breakdown</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[12px]">
                      <div className="rounded bg-[#4CAF50]/10 text-[#4CAF50] px-2 py-1">Correct: {analysis.questionStats.correct}</div>
                      <div className="rounded bg-[#F54E00]/10 text-[#F54E00] px-2 py-1">Incorrect: {analysis.questionStats.incorrect}</div>
                      <div className="rounded bg-[#F1A82C]/10 text-[#F1A82C] px-2 py-1">Ungraded: {analysis.questionStats.ungraded}</div>
                      <div className="rounded bg-[var(--bg-primary)] text-[var(--text-tertiary)] px-2 py-1">Unanswered: {analysis.questionStats.unanswered}</div>
                    </div>
                  </div>
                )}

                <div className="rounded border border-[var(--border-subtle)] overflow-hidden">
                  <div className="px-3 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] flex items-center justify-between">
                    <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Peer Performance</h3>
                    <span className="text-[11px] text-[var(--text-faint)]">Top Score: {analysis.topPercentage.toFixed(1)}%</span>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[var(--border-subtle)]">
                          <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">Student</th>
                          <th className="px-3 py-2 text-center text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">Score</th>
                          <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">Percentage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysis.board.map((row, idx) => (
                          <tr key={`${row.label}-${idx}`} className={`border-b border-[var(--border-subtle)]/50 ${row.isYou ? 'bg-[#5E6AD2]/10' : ''}`}>
                            <td className="px-3 py-2 text-[12px] font-medium text-[var(--text-primary)]">{row.label}</td>
                            <td className="px-3 py-2 text-center text-[12px] text-[var(--text-secondary)] tabular-nums">{row.score}</td>
                            <td className="px-3 py-2 text-right text-[12px] text-[var(--text-secondary)] tabular-nums">{row.percentage.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}