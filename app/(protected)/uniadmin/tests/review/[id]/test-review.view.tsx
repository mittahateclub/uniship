'use client';

import Link from 'next/link';
import { CheckCircle2, BookOpen, Brain, Code2, ArrowLeft } from '@/components/icons';
import { ReviewSkeleton } from '@/components/Skeleton';

const sectionMeta: Record<string, { icon: typeof BookOpen; color: string; label: string }> = {
  aptitude: { icon: BookOpen, color: 'text-[var(--type-aptitude)]', label: 'Aptitude' },
  mcq: { icon: Brain, color: 'text-[var(--type-mcq)]', label: 'Coding MCQs' },
  coding: { icon: Code2, color: 'text-[var(--type-event)]', label: 'Live Coding' },
};

export interface TestReviewViewProps {
  loading: boolean;
  testData: any;
  publishing: boolean;
  onPublish: () => void;
}

export function TestReviewView({ loading, testData, publishing, onPublish }: TestReviewViewProps) {
  if (loading) return <ReviewSkeleton />;
  if (!testData) return (
    <div className="max-w-[1200px] mx-auto animate-fade-in pt-8">
      <div className="text-center py-16 border border-[var(--border-subtle)] rounded-[var(--radius)] bg-[var(--bg-surface)]">
        <p className="text-[var(--text-primary)] text-[13px] font-medium">Test not found.</p>
      </div>
    </div>
  );

  const sections: any[] = testData.sections || [];
  const hasOnlyCodingProblems = sections.length === 0 && testData.problems?.length > 0;

  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in">
      <div className="pt-8 mb-7">
        <Link href="/uniadmin/tests" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors mb-4">
          <ArrowLeft size={14} /> Tests
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[26px] font-semibold text-[var(--text-primary)] tracking-[-0.025em]">{testData.title || testData.sourceFileName}</h1>
            {testData.published && (
              <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--status-success)] bg-[var(--status-success)]/10 px-2 py-0.5 rounded-full">
                <CheckCircle2 size={10} /> Published
              </span>
            )}
          </div>
          <button
            onClick={onPublish}
            disabled={publishing || testData.published}
            className="btn-primary !rounded-[10px] !px-4 !py-2 text-[12.5px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {publishing ? 'Publishing…' : testData.published ? 'Already Published' : 'Approve & Publish'}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {sections.map((section: any, sIdx: number) => {
          const meta = sectionMeta[section.type] || sectionMeta.coding;
          const Icon = meta.icon;
          return (
            <div key={sIdx}>
              <div className="flex items-center gap-2 mb-3">
                <Icon size={16} className={meta.color} />
                <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">
                  {section.title || `Section ${sIdx + 1}: ${meta.label}`}
                </h2>
                <span className="text-[11px] text-[var(--text-faint)]">
                  ({(section.questions || []).length} questions)
                </span>
              </div>

              <div className="space-y-3">
                {(section.questions || []).map((q: any, qIdx: number) => (
                  <div key={qIdx} className="window p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`text-[10px] font-semibold uppercase tracking-[0.07em] px-2 py-0.5 rounded ${
                        section.type === 'mcq' ? 'text-[var(--type-mcq)] bg-[var(--type-mcq)]/10'
                        : 'text-[var(--type-event)] bg-[var(--type-event)]/10'
                      }`}>
                        Q{qIdx + 1}
                      </span>
                    </div>

                    <h3 className="text-[14px] font-medium text-[var(--text-primary)] mb-3 whitespace-pre-wrap">
                      {q.questionDescription || q.questionText}
                    </h3>

                    {section.type === 'mcq' && q.options && (
                      <div className="space-y-1.5 mb-3">
                        {q.options.map((opt: string, oIdx: number) => {
                          const letter = String.fromCharCode(65 + oIdx);
                          const isCorrect = q.correctAnswer === letter;
                          return (
                            <div key={oIdx} className={`flex items-center gap-2 px-3 py-2 rounded text-[13px] border ${
                              isCorrect
                                ? 'border-[var(--status-success)]/30 bg-[var(--status-success)]/10 text-[var(--status-success)] font-medium'
                                : 'border-[var(--border-subtle)] text-[var(--text-secondary)]'
                            }`}>
                              <span className="font-semibold text-[12px]">{letter}.</span>
                              {opt}
                              {isCorrect && <CheckCircle2 size={12} className="ml-auto" />}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {section.type === 'aptitude' && q.correctAnswer && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded border border-[var(--status-success)]/30 bg-[var(--status-success)]/10 text-[13px] text-[var(--status-success)] font-medium">
                        <CheckCircle2 size={12} />
                        Answer: {q.correctAnswer}
                      </div>
                    )}

                    {section.type === 'coding' && (
                      <div className="mt-3 space-y-2">
                        {q.constraints && q.constraints.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.07em] mb-1">Constraints:</p>
                            <ul className="list-disc list-inside space-y-0.5">
                              {q.constraints.map((c: string, ci: number) => (
                                <li key={ci} className="text-[12px] text-[var(--text-tertiary)] font-mono">{c}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {q.sampleTestCases && q.sampleTestCases.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.07em] mb-1">Sample Case:</p>
                            <pre className="bg-[var(--bg-elevated)] p-3 rounded text-[12px] text-[var(--status-success)] font-mono">
{`Input: ${q.sampleTestCases[0]?.input}\nOutput: ${q.sampleTestCases[0]?.output}`}
                            </pre>
                          </div>
                        )}
                        {q.hiddenTestCases && q.hiddenTestCases.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-[var(--type-event)] uppercase tracking-[0.07em] mb-1">
                              Hidden Test Cases ({q.hiddenTestCases.length}):
                            </p>
                            <div className="space-y-1">
                              {q.hiddenTestCases.map((tc: any, tci: number) => (
                                <pre key={tci} className="bg-[var(--bg-elevated)] border border-[var(--type-event)]/20 p-3 rounded text-[12px] text-[var(--type-event)] font-mono">
{`[${tci + 1}] Input:  ${tc.input}\n      Output: ${tc.output}`}
                                </pre>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {hasOnlyCodingProblems && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Code2 size={16} className="text-[var(--type-event)]" />
              <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">Coding Problems</h2>
              <span className="text-[11px] text-[var(--text-faint)]">({testData.problems.length} questions)</span>
            </div>
            <div className="space-y-3">
              {testData.problems.map((q: any, index: number) => (
                <div key={index} className="window p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--type-event)] bg-[var(--type-event)]/10 px-2 py-0.5 rounded">
                      {q.difficulty || 'Q'} — Q{index + 1}
                    </span>
                  </div>
                  <h3 className="text-[14px] font-medium text-[var(--text-primary)] mb-4 whitespace-pre-wrap">{q.questionDescription}</h3>
                  {q.sampleTestCases && q.sampleTestCases.length > 0 && (
                    <div className="mt-3 space-y-1">
                      <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.07em]">Sample Case:</p>
                      <pre className="bg-[var(--bg-elevated)] p-3 rounded text-[12px] text-[var(--status-success)] font-mono">
{`Input: ${q.sampleTestCases[0]?.input}\nOutput: ${q.sampleTestCases[0]?.output}`}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
