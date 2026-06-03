'use client';

import { ArrowLeft, CheckCircle2, XCircle, MinusCircle, Clock, AlertTriangle } from 'lucide-react';

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
  AC:        { label: 'Correct',     color: 'text-[#4CAF50]', bg: 'bg-[#4CAF50]/10', icon: CheckCircle2 },
  WA:        { label: 'Wrong',       color: 'text-[#00A8E1]', bg: 'bg-[#00A8E1]/10', icon: XCircle },
  TLE:       { label: 'Time Limit',  color: 'text-[#F1A82C]', bg: 'bg-[#F1A82C]/10', icon: Clock },
  CE:        { label: 'Compile Error', color: 'text-[#00A8E1]', bg: 'bg-[#00A8E1]/10', icon: AlertTriangle },
  RE:        { label: 'Runtime Error', color: 'text-[#00A8E1]', bg: 'bg-[#00A8E1]/10', icon: AlertTriangle },
  UNGRADED:  { label: 'Ungraded',    color: 'text-[var(--text-faint)]', bg: 'bg-[var(--bg-elevated)]', icon: MinusCircle },
  UNANSWERED:{ label: 'Unanswered',  color: 'text-[var(--text-faint)]', bg: 'bg-[var(--bg-elevated)]', icon: MinusCircle },
};

export function ResultReviewView({ loading, result, onBack }: ResultReviewViewProps) {
  if (loading) return <div className="flex items-center justify-center py-24"><div className="loading-dots"><span /><span /><span /></div></div>;
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
    <div className="max-w-[900px] mx-auto animate-fade-in pb-16">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded hover:bg-[var(--bg-elevated)] transition-colors">
          <ArrowLeft size={18} className="text-[var(--text-tertiary)]" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-[-0.02em]">
            {result.testTitle || 'Test Review'}
          </h1>
          <p className="text-[var(--text-tertiary)] text-[13px] mt-0.5">
            Question-by-question review &middot;{' '}
            <span className="text-[#4CAF50]">{totalCorrect} correct</span>{' '}&middot;{' '}
            <span className="text-[#00A8E1]">{totalWrong} wrong</span>{' '}&middot;{' '}
            <span className="text-[var(--text-faint)]">{totalUnanswered} unanswered</span>
          </p>
        </div>
      </div>

      {sections.map((section, si) => (
        <div key={si} className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">{section.title}</span>
            <span className="text-[10px] text-[var(--text-faint)] bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded">{section.type}</span>
          </div>

          <div className="space-y-3">
            {section.items.map(({ q, idx, eval: ev }) => {
              const verdict: Verdict = ev?.verdict || 'UNGRADED';
              const vc = verdictConfig[verdict];
              const VerdictIcon = vc.icon;
              const isWrong = verdict === 'WA' || verdict === 'TLE' || verdict === 'CE' || verdict === 'RE';

              return (
                <div key={idx} className={`window p-4 border-l-2 ${verdict === 'AC' ? 'border-l-[#4CAF50]' : isWrong ? 'border-l-[#00A8E1]' : 'border-l-[var(--border-subtle)]'}`}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-[var(--text-faint)] tabular-nums">Q{idx + 1}</span>
                      {q.difficulty && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          q.difficulty.toLowerCase() === 'hard' ? 'bg-[#00A8E1]/10 text-[#00A8E1]' :
                          q.difficulty.toLowerCase() === 'medium' ? 'bg-[#F1A82C]/10 text-[#F1A82C]' :
                          'bg-[#4CAF50]/10 text-[#4CAF50]'
                        }`}>{q.difficulty}</span>
                      )}
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded ${vc.bg} ${vc.color}`}>
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
                          <div key={oi} className={`flex items-center gap-2 px-3 py-1.5 rounded text-[13px] border ${
                            isCorrect ? 'border-[#4CAF50]/50 bg-[#4CAF50]/5' :
                            isStudentPick && isWrong ? 'border-[#00A8E1]/50 bg-[#00A8E1]/5' :
                            'border-[var(--border-subtle)]'
                          }`}>
                            <span className={`font-bold text-[12px] ${isCorrect ? 'text-[#4CAF50]' : isStudentPick && isWrong ? 'text-[#00A8E1]' : 'text-[var(--text-faint)]'}`}>
                              {letter}.
                            </span>
                            <span className={isCorrect ? 'text-[#4CAF50]' : isStudentPick && isWrong ? 'text-[#00A8E1]' : 'text-[var(--text-secondary)]'}>
                              {opt}
                            </span>
                            {isCorrect && <CheckCircle2 size={13} className="ml-auto text-[#4CAF50]" />}
                            {isStudentPick && isWrong && <XCircle size={13} className="ml-auto text-[#00A8E1]" />}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {q.sectionType === 'aptitude' && (
                    <div className="space-y-1.5 mb-3">
                      <div className="flex items-center gap-2 text-[13px]">
                        <span className="text-[var(--text-faint)] text-[11px] font-bold w-24">Your answer:</span>
                        <span className={`${verdict === 'AC' ? 'text-[#4CAF50]' : isWrong ? 'text-[#00A8E1]' : 'text-[var(--text-tertiary)]'}`}>
                          {q.studentAnswer || '—'}
                        </span>
                      </div>
                      {isWrong && q.correctAnswer && (
                        <div className="flex items-center gap-2 text-[13px]">
                          <span className="text-[var(--text-faint)] text-[11px] font-bold w-24">Correct:</span>
                          <span className="text-[#4CAF50]">{q.correctAnswer}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {q.sectionType === 'coding' && (
                    <div className="space-y-2 mb-3">
                      {q.studentAnswer ? (
                        <details className="group">
                          <summary className="text-[11px] font-bold text-[var(--text-faint)] cursor-pointer hover:text-[var(--text-tertiary)] transition-colors">
                            Your Code
                          </summary>
                          <pre className="mt-1.5 p-3 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-secondary)] overflow-x-auto leading-relaxed whitespace-pre-wrap">
                            {q.studentAnswer}
                          </pre>
                        </details>
                      ) : (
                        <p className="text-[11px] text-[var(--text-faint)]">No code submitted</p>
                      )}
                      {ev && ev.passed !== undefined && ev.total !== undefined && (
                        <p className="text-[12px] text-[var(--text-tertiary)]">
                          Test cases passed: <span className={ev.passed === ev.total ? 'text-[#4CAF50] font-bold' : 'text-[#00A8E1] font-bold'}>{ev.passed}/{ev.total}</span>
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
