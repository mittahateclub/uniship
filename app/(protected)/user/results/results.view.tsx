'use client';

import { createPortal } from 'react-dom';
import Trophy from '@/components/icons/Trophy';
import CalendarDays from '@/components/icons/CalendarDays';
import BarChart3 from '@/components/icons/BarChart3';
import X from '@/components/icons/X';
import Eye from '@/components/icons/Eye';
import TrendingUp from '@/components/icons/TrendingUp';
import CheckCircle2 from '@/components/icons/CheckCircle2';
import Award from '@/components/icons/Award';
import { ListSkeleton } from '@/components/Skeleton';

export interface TestResult {
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
  submittedAt: unknown;
}

export interface AnalysisDetails {
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

export interface ResultsViewProps {
  loading: boolean;
  results: TestResult[];
  activeResult: TestResult | null;
  analysis: AnalysisDetails | null;
  analysisLoading: boolean;
  analysisError: string;
  getScore: (result: TestResult) => number;
  getPercentage: (result: TestResult) => number;
  onViewAnalysis: (result: TestResult) => void;
  onCloseAnalysis: () => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}

function pctTone(pct: number) {
  if (pct >= 80) return 'bg-[var(--status-success)]/10 text-[var(--status-success)]';
  if (pct >= 60) return 'bg-[var(--status-warning)]/10 text-[var(--status-warning)]';
  return 'bg-[var(--status-danger)]/10 text-[var(--status-danger)]';
}

export function ResultsView({
  loading,
  results,
  activeResult,
  analysis,
  analysisLoading,
  analysisError,
  getScore,
  getPercentage,
  onViewAnalysis,
  onCloseAnalysis,
  hasMore,
  loadingMore,
  onLoadMore,
}: ResultsViewProps) {
  if (loading) {
    return <ListSkeleton withStats rows={5} />;
  }

  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in">
      <div className="pt-8 mb-7">
        <h1 className="text-[26px] font-semibold text-[var(--text-primary)] tracking-[-0.025em]">My Results</h1>
        <p className="text-[var(--text-tertiary)] text-[13.5px] mt-1.5">Track your performance across all assessments.</p>
      </div>

      {results.length === 0 ? (
        <div className="text-center py-16 border border-[var(--border-subtle)] rounded-[var(--radius)] bg-[var(--bg-surface)]">
          <Trophy size={26} className="mx-auto text-[var(--text-faint)] mb-3" />
          <p className="text-[var(--text-primary)] text-[13px] font-medium">You haven&apos;t completed any tests yet.</p>
          <p className="text-[var(--text-faint)] text-[12px] mt-1">Take a test and your results will show here.</p>
        </div>
      ) : (
        <>
          {/* ── Summary stat strip ── */}
          {(() => {
            const totalTests = results.length;
            const avgPct = results.reduce((sum, r) => sum + getPercentage(r), 0) / totalTests;
            const bestPct = Math.max(...results.map((r) => getPercentage(r)));
            const bestResult = results.find((r) => getPercentage(r) === bestPct);
            const stats = [
              { icon: Trophy, value: String(totalTests), label: 'Tests Taken' },
              { icon: TrendingUp, value: `${avgPct.toFixed(1)}%`, label: 'Average Score' },
              { icon: Award, value: `${bestPct.toFixed(1)}%`, label: 'Best Score' },
              { icon: CheckCircle2, value: bestResult?.testTitle || '—', label: 'Top Test', title: bestResult?.testTitle },
            ];
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden mb-6">
                {stats.map((s) => (
                  <div key={s.label} className="p-4 border-b md:border-b-0 border-r border-[var(--border-subtle)] [&:nth-child(2n)]:border-r-0 md:[&:nth-child(2n)]:border-r md:last:!border-r-0">
                    <div className="flex items-center gap-1.5 mb-2.5 text-[var(--text-faint)]">
                      <s.icon size={13} />
                      <span className="text-[10.5px] font-semibold uppercase tracking-[0.07em]">{s.label}</span>
                    </div>
                    <p className="text-[19px] font-semibold text-[var(--text-primary)] tabular-nums tracking-[-0.01em] truncate" title={s.title}>{s.value}</p>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* ── Result rows ── */}
          <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
            {results.map((result) => {
              const score = getScore(result);
              const percentage = getPercentage(result).toFixed(1);
              const date = (result.submittedAt as { toDate?: () => Date } | undefined)?.toDate?.()?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) || 'N/A';
              const pct = Number(percentage);

              return (
                <div key={result.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 sm:px-5 py-4 border-b border-[var(--border-subtle)] last:border-b-0 transition-colors duration-150 hover:bg-[var(--bg-elevated)]">
                  {/* Title + meta */}
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[14px] font-semibold text-[var(--text-primary)] tracking-[-0.01em] truncate">{result.testTitle}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-[12px] text-[var(--text-tertiary)]">
                        <CalendarDays size={11} className="text-[var(--text-faint)]" />
                        {date}
                      </span>
                      {result.scoringMode === 'attempted' && (
                        <span className="text-[10.5px] text-[var(--text-muted)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-2 py-[1px] rounded-full">attempt-based</span>
                      )}
                    </div>
                  </div>

                  {/* Score + pct + actions */}
                  <div className="flex items-center gap-3 sm:gap-4 shrink-0 flex-wrap">
                    <span className="text-[13.5px] font-semibold text-[var(--text-primary)] tabular-nums">
                      {score}<span className="text-[var(--text-faint)] font-normal text-[12px]"> / {result.totalQuestions}</span>
                    </span>
                    <span className={`px-2.5 py-[3px] rounded-full text-[12px] font-semibold tabular-nums ${pctTone(pct)}`}>
                      {percentage}%
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onViewAnalysis(result)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium text-[var(--text-tertiary)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)] hover:border-[var(--border-active)] transition-colors"
                      >
                        <BarChart3 size={12} />
                        View Analysis
                      </button>
                      <a
                        href={`/user/results/review/${result.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium text-[var(--text-tertiary)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)] hover:border-[var(--border-active)] transition-colors"
                      >
                        <Eye size={12} />
                        Review Questions
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
            {hasMore && (
              <div className="flex justify-center p-3 border-t border-[var(--border-subtle)]">
                <button type="button" onClick={onLoadMore} disabled={loadingMore} className="btn-secondary !rounded-[10px] text-[12px] disabled:opacity-50">
                  {loadingMore ? 'Loading…' : 'Load more results'}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {activeResult && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={onCloseAnalysis}
          />

          <div className="relative w-full max-w-6xl max-h-[92vh] overflow-y-auto rounded-[14px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 sm:p-6 animate-fade-in">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="text-[17px] font-semibold tracking-[-0.015em] text-[var(--text-primary)]">Detailed Analysis</h2>
                <p className="text-[12.5px] text-[var(--text-tertiary)] mt-0.5">{activeResult.testTitle}</p>
              </div>
              <button
                type="button"
                onClick={onCloseAnalysis}
                className="p-2 rounded-full hover:bg-[var(--bg-elevated)] text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {analysisLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="loading-dots"><span /><span /><span /></div>
              </div>
            ) : analysisError ? (
              <div className="p-3 rounded-[var(--radius)] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 text-[var(--status-danger)] text-[13px]">
                {analysisError}
              </div>
            ) : analysis ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] overflow-hidden">
                  {[
                    { label: 'Your Rank', value: `#${analysis.rank}` },
                    { label: 'Participants', value: String(analysis.totalParticipants) },
                    { label: 'Percentile', value: `${analysis.percentile}%` },
                    { label: 'Class Avg', value: `${analysis.averagePercentage.toFixed(1)}%` },
                  ].map((s) => (
                    <div key={s.label} className="p-3.5 border-b md:border-b-0 border-r border-[var(--border-subtle)] [&:nth-child(2n)]:border-r-0 md:[&:nth-child(2n)]:border-r md:last:!border-r-0">
                      <p className="text-[10.5px] uppercase tracking-[0.07em] text-[var(--text-faint)] font-semibold">{s.label}</p>
                      <p className="text-[19px] font-semibold text-[var(--text-primary)] tabular-nums mt-1">{s.value}</p>
                    </div>
                  ))}
                </div>

                {analysis.questionStats && (
                  <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
                    <h3 className="text-[13px] font-semibold text-[var(--text-primary)] mb-2.5">Question Breakdown</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[12px]">
                      <div className="rounded-full bg-[var(--status-success)]/10 text-[var(--status-success)] px-3 py-1">Correct: {analysis.questionStats.correct}</div>
                      <div className="rounded-full bg-[var(--status-danger)]/10 text-[var(--status-danger)] px-3 py-1">Incorrect: {analysis.questionStats.incorrect}</div>
                      <div className="rounded-full bg-[var(--status-warning)]/10 text-[var(--status-warning)] px-3 py-1">Ungraded: {analysis.questionStats.ungraded}</div>
                      <div className="rounded-full bg-[var(--bg-primary)] text-[var(--text-tertiary)] px-3 py-1">Unanswered: {analysis.questionStats.unanswered}</div>
                    </div>
                  </div>
                )}

                <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] flex items-center justify-between">
                    <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Peer Performance</h3>
                    <span className="text-[11.5px] text-[var(--text-faint)]">Top Score: {analysis.topPercentage.toFixed(1)}%</span>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[var(--border-subtle)]">
                          <th className="px-4 py-2 text-left text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)]">Student</th>
                          <th className="px-4 py-2 text-center text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)]">Score</th>
                          <th className="px-4 py-2 text-right text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)]">Percentage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysis.board.map((row, idx) => (
                          <tr key={`${row.label}-${idx}`} className={`border-b border-[var(--border-subtle)]/50 ${row.isYou ? 'bg-[var(--accent-orange)]/10' : ''}`}>
                            <td className="px-4 py-2 text-[12.5px] font-medium text-[var(--text-primary)]">{row.label}</td>
                            <td className="px-4 py-2 text-center text-[12.5px] text-[var(--text-secondary)] tabular-nums">{row.score}</td>
                            <td className="px-4 py-2 text-right text-[12.5px] text-[var(--text-secondary)] tabular-nums">{row.percentage.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
