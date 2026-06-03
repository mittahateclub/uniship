'use client';

import { createPortal } from 'react-dom';
import { Trophy, CalendarDays, BarChart3, X, Eye, TrendingUp, CheckCircle2, Award } from 'lucide-react';

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
  submittedAt: any;
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
}: ResultsViewProps) {
  if (loading) {
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
                    <div className="w-7 h-7 rounded-lg bg-[#4B8BBE]/10 flex items-center justify-center">
                      <Trophy size={14} className="text-[#4B8BBE]" />
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
                    <div className="w-7 h-7 rounded-lg bg-[#00A8E1]/10 flex items-center justify-center">
                      <CheckCircle2 size={14} className="text-[#00A8E1]" />
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
                      'bg-[#00A8E1]'
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
                            'border-[#00A8E1] bg-[#00A8E1]/5'
                          }`}>
                            <span className={`text-[13px] font-bold tabular-nums ${
                              pct >= 80 ? 'text-[#4CAF50]' :
                              pct >= 60 ? 'text-[#F1A82C]' :
                              'text-[#00A8E1]'
                            }`}>{percentage}%</span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border-subtle)]/50">
                        <button
                          type="button"
                          onClick={() => onViewAnalysis(result)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-[#4B8BBE] bg-[#4B8BBE]/8 hover:bg-[#4B8BBE]/15 transition-colors"
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

      {activeResult && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={onCloseAnalysis}
          />

          <div className="relative w-full max-w-6xl max-h-[92vh] overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">Detailed Analysis</h2>
                <p className="text-[12px] text-[var(--text-tertiary)] mt-0.5">{activeResult.testTitle}</p>
              </div>
              <button
                type="button"
                onClick={onCloseAnalysis}
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
              <div className="p-3 rounded border border-[#00A8E1]/30 bg-[#00A8E1]/10 text-[#00A8E1] text-[13px]">
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
                      <div className="rounded bg-[#00A8E1]/10 text-[#00A8E1] px-2 py-1">Incorrect: {analysis.questionStats.incorrect}</div>
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
                          <tr key={`${row.label}-${idx}`} className={`border-b border-[var(--border-subtle)]/50 ${row.isYou ? 'bg-[#4B8BBE]/10' : ''}`}>
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
        </div>,
        document.body,
      )}
    </div>
  );
}
