'use client';

import ArrowLeft from '@/components/icons/ArrowLeft';
import CheckCircle2 from '@/components/icons/CheckCircle2';
import XCircle from '@/components/icons/XCircle';
import MinusCircle from '@/components/icons/MinusCircle';
import Clock from '@/components/icons/Clock';
import AlertTriangle from '@/components/icons/AlertTriangle';
import { ReviewSkeleton } from '@/components/Skeleton';

export type Verdict = 'AC' | 'WA' | 'TLE' | 'CE' | 'RE' | 'UNGRADED' | 'UNANSWERED';

export interface QuestionSnapshot {
  questionDescription: string;
  sectionType: 'aptitude' | 'mcq' | 'coding';
  sectionTitle: string;
  options: string[] | null;
  correctAnswer: string | null;
  sampleTestCases: Array<{ input: string; output: string }> | null;
  studentAnswer: string;
  difficulty: string | null;
}

export interface Evaluation {
  index: number;
  sectionType?: string;
  verdict: Verdict;
  passed?: number;
  total?: number;
  failedCase?: number | null;
  usedHiddenCases?: boolean;
}

export interface ResultDoc {
  userId: string;
  testTitle?: string;
  score?: number;
  totalQuestions?: number;
  percentage?: number;
  questionSnapshots?: QuestionSnapshot[];
  questionEvaluations?: Evaluation[];
}

export interface ResultReviewViewProps {
  loading: boolean;
  result: ResultDoc | null;
  onBack: () => void;
}

const verdictConfig: Record<Verdict, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  AC:        { label: 'Correct',     color: 'text-[var(--status-success)]', bg: 'bg-[var(--status-success)]/10', icon: CheckCircle2 },
  WA:        { label: 'Wrong',       color: 'text-[var(--status-danger)]', bg: 'bg-[var(--status-danger)]/10', icon: XCircle },
  TLE:       { label: 'Time Limit',  color: 'text-[var(--status-warning)]', bg: 'bg-[var(--status-warning)]/10', icon: Clock },
  CE:        { label: 'Compile Error', color: 'text-[var(--status-danger)]', bg: 'bg-[var(--status-danger)]/10', icon: AlertTriangle },
  RE:        { label: 'Runtime Error', color: 'text-[var(--status-danger)]', bg: 'bg-[var(--status-danger)]/10', icon: AlertTriangle },
  UNGRADED:  { label: 'Ungraded',    color: 'text-[var(--text-faint)]', bg: 'bg-[var(--bg-elevated)]', icon: MinusCircle },
  UNANSWERED:{ label: 'Unanswered',  color: 'text-[var(--text-faint)]', bg: 'bg-[var(--bg-elevated)]', icon: MinusCircle },
};

export function ResultReviewView({ loading, result, onBack }: ResultReviewViewProps) {
  if (loading) return <ReviewSkeleton />;
  if (!result || !result.questionSnapshots) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-[var(--text-tertiary)]">
        <p className="text-[13px]">Review data not available for this result.</p>
        <button onClick={onBack} className="mt-4 btn-secondary px-4 py-2 text-[13px]">Go Back</button>
      </div>
    );
  }

  const snapshots = result.questionSnapshots;
  const evaluations = result.questionEvaluations || [];

  const sections: { title: string; type: string; items: { q: QuestionSnapshot; idx: number; eval?: Evaluation }[] }[] = [];
  let currentSection: typeof sections[0] | null = null;

  snapshots.forEach((q, idx) => {
    const ev = evaluations.find((e) => e.index === idx);
    if (!currentSection || currentSection.title !== q.sectionTitle) {
      currentSection = { title: q.sectionTitle, type: q.sectionType, items: [] };
      sections.push(currentSection);
    }
    currentSection.items.push({ q, idx, eval: ev });
  });

  const totalCorrect = evaluations.filter((e) => e.verdict === 'AC').length;
  const totalWrong = evaluations.filter((e) => e.verdict === 'WA' || e.verdict === 'TLE' || e.verdict === 'CE' || e.verdict === 'RE').length;
  const totalUnanswered = evaluations.filter((e) => e.verdict === 'UNANSWERED' || e.verdict === 'UNGRADED').length;

  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in pb-16">
      <div className="pt-8 mb-5">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors mb-4">
          <ArrowLeft size={14} /> Back to Results
        </button>
        <h1 className="text-[26px] font-semibold text-[var(--text-primary)] tracking-[-0.025em]">
          {result.testTitle || 'Test Review'}
        </h1>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-full bg-[var(--status-success)]/10 text-[var(--status-success)]"><CheckCircle2 size={13} />{totalCorrect} correct</span>
          <span className="inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-full bg-[var(--status-danger)]/10 text-[var(--status-danger)]"><XCircle size={13} />{totalWrong} wrong</span>
          <span className="inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-full bg-[var(--bg-elevated)] text-[var(--text-muted)]"><MinusCircle size={13} />{totalUnanswered} unanswered</span>
        </div>
      </div>

      {sections.map((section, si) => (
        <div key={si} className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)]">{section.title}</span>
            <span className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-2 py-0.5 rounded-full">{section.type}</span>
          </div>

          <div className="space-y-3">
            {section.items.map(({ q, idx, eval: ev }) => {
              const verdict: Verdict = ev?.verdict || 'UNGRADED';
              const vc = verdictConfig[verdict];
              const VerdictIcon = vc.icon;
              const isWrong = verdict === 'WA' || verdict === 'TLE' || verdict === 'CE' || verdict === 'RE';

              return (
                <div key={idx} className={`window p-4 border-l-2 ${verdict === 'AC' ? 'border-l-[var(--status-success)]' : isWrong ? 'border-l-[var(--status-danger)]' : 'border-l-[var(--border-subtle)]'}`}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-[var(--text-faint)] tabular-nums">Q{idx + 1}</span>
                      {q.difficulty && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          q.difficulty.toLowerCase() === 'hard' ? 'bg-[var(--status-danger)]/10 text-[var(--status-danger)]' :
                          q.difficulty.toLowerCase() === 'medium' ? 'bg-[var(--status-warning)]/10 text-[var(--status-warning)]' :
                          'bg-[var(--status-success)]/10 text-[var(--status-success)]'
                        }`}>{q.difficulty}</span>
                      )}
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${vc.bg} ${vc.color}`}>
                      <VerdictIcon size={12} />
                      {vc.label}
                    </span>
                  </div>

                  <p className="text-[13px] text-[var(--text-primary)] mb-3 whitespace-pre-wrap leading-relaxed">{q.questionDescription}</p>

                  {q.sectionType === 'mcq' && q.options && (
                    <div className="space-y-1.5 mb-3">
                      {q.options.map((opt, oi) => {
                        const letter = String.fromCharCode(65 + oi);
                        const isStudentPick = q.studentAnswer?.toUpperCase() === letter;
                        const isCorrect = q.correctAnswer?.toUpperCase() === letter;
                        return (
                          <div key={oi} className={`flex items-center gap-2 px-3 py-2 rounded-[8px] text-[13px] border ${
                            isCorrect ? 'border-[var(--status-success)]/50 bg-[var(--status-success)]/5' :
                            isStudentPick && isWrong ? 'border-[var(--status-danger)]/50 bg-[var(--status-danger)]/5' :
                            'border-[var(--border-subtle)]'
                          }`}>
                            <span className={`font-semibold text-[12px] ${isCorrect ? 'text-[var(--status-success)]' : isStudentPick && isWrong ? 'text-[var(--status-danger)]' : 'text-[var(--text-faint)]'}`}>
                              {letter}.
                            </span>
                            <span className={isCorrect ? 'text-[var(--status-success)]' : isStudentPick && isWrong ? 'text-[var(--status-danger)]' : 'text-[var(--text-secondary)]'}>
                              {opt}
                            </span>
                            {isCorrect && <CheckCircle2 size={13} className="ml-auto text-[var(--status-success)]" />}
                            {isStudentPick && isWrong && <XCircle size={13} className="ml-auto text-[var(--status-danger)]" />}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {q.sectionType === 'aptitude' && (
                    <div className="space-y-1.5 mb-3">
                      <div className="flex items-center gap-2 text-[13px]">
                        <span className="text-[var(--text-faint)] text-[11px] font-semibold w-24">Your answer:</span>
                        <span className={`${verdict === 'AC' ? 'text-[var(--status-success)]' : isWrong ? 'text-[var(--status-danger)]' : 'text-[var(--text-tertiary)]'}`}>
                          {q.studentAnswer || '—'}
                        </span>
                      </div>
                      {isWrong && q.correctAnswer && (
                        <div className="flex items-center gap-2 text-[13px]">
                          <span className="text-[var(--text-faint)] text-[11px] font-semibold w-24">Correct:</span>
                          <span className="text-[var(--status-success)]">{q.correctAnswer}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {q.sectionType === 'coding' && (
                    <div className="space-y-2 mb-3">
                      {q.studentAnswer ? (
                        <details className="group">
                          <summary className="text-[11px] font-semibold text-[var(--text-faint)] cursor-pointer hover:text-[var(--text-tertiary)] transition-colors">
                            Your Code
                          </summary>
                          <pre className="mt-1.5 p-3 rounded-[8px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-secondary)] overflow-x-auto leading-relaxed whitespace-pre-wrap">
                            {q.studentAnswer}
                          </pre>
                        </details>
                      ) : (
                        <p className="text-[11px] text-[var(--text-faint)]">No code submitted</p>
                      )}
                      {ev && ev.passed !== undefined && ev.total !== undefined && (
                        <p className="text-[12px] text-[var(--text-tertiary)]">
                          Test cases passed: <span className={ev.passed === ev.total ? 'text-[var(--status-success)] font-semibold' : 'text-[var(--status-danger)] font-semibold'}>{ev.passed}/{ev.total}</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
