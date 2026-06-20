'use client';
import { Link } from 'next-view-transitions';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import CheckCircle2 from '@/components/icons/CheckCircle2';
import ArrowLeft from '@/components/icons/ArrowLeft';
import Calendar from '@/components/icons/Calendar';
import Clock from '@/components/icons/Clock';
import Copy from '@/components/icons/Copy';
import Pencil from '@/components/icons/Pencil';
import Trash2 from '@/components/icons/Trash2';
import Save from '@/components/icons/Save';
import HelpCircle from '@/components/icons/HelpCircle';
import { ReviewSkeleton } from '@/components/Skeleton';
import { Toggle } from '@/components/Toggle';
import { MiniCalendar, TimeField, buildISOString, from24Hour, formatSchedule, type AmPm } from '@/components/SchedulePicker';

const sectionLabel: Record<string, string> = {
  aptitude: 'Aptitude',
  mcq: 'Coding MCQs',
  coding: 'Live Coding',
};

// Shared button languages — one radius (8px) across every action on the page.
const ghostBtn = 'inline-flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[12px] font-semibold text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:border-[var(--border-active)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50';
const dangerBtn = 'inline-flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[12px] font-semibold text-[var(--status-danger)] border border-[var(--border-subtle)] hover:border-[var(--status-danger)]/40 hover:bg-[var(--status-danger)]/10 transition-colors disabled:opacity-50';
const primaryBtn = 'btn-primary !rounded-[8px] !px-4 !py-2 text-[12.5px] inline-flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed';
const microLabel = 'text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)]';

export interface TestQuestion {
  questionDescription?: string;
  questionText?: string;
  options?: string[];
  correctAnswer?: string | null;
  constraints?: string[];
  difficulty?: string;
  sampleTestCases?: { input?: string; output?: string }[];
  hiddenTestCases?: { input?: string; output?: string }[];
  [k: string]: unknown;
}
export interface TestSection {
  title?: string;
  type?: string;
  questions?: TestQuestion[];
}
export interface TestDoc {
  title?: string;
  sourceFileName?: string;
  sections?: TestSection[];
  problems?: TestQuestion[];
  published?: boolean;
  approved?: boolean;
  allowReattempts?: boolean;
  examStart?: string;
  examEnd?: string;
  duration?: number;
  [k: string]: unknown;
}

export interface TestReviewViewProps {
  loading: boolean;
  testId: string;
  testData: TestDoc | null;
  publishing: boolean;
  deleting: boolean;
  savingSchedule: boolean;
  reassigning: boolean;
  toast: string | null;
  onPublish: () => void;
  onUnpublish: () => void;
  onSaveSchedule: (duration: number, examStart: string, examEnd: string) => void | Promise<void>;
  onToggleReattempts: (value: boolean) => void;
  onDelete: () => void;
  onCopyLink: () => void;
}

export function TestReviewView({
  loading, testData, publishing, deleting, savingSchedule, reassigning, toast,
  onPublish, onUnpublish, onSaveSchedule, onToggleReattempts, onDelete, onCopyLink,
}: TestReviewViewProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [editDuration, setEditDuration] = useState(60);
  const [editExamDate, setEditExamDate] = useState<Date | null>(null);
  const [editStartHour, setEditStartHour] = useState(9);
  const [editStartMinute, setEditStartMinute] = useState(0);
  const [editStartAmPm, setEditStartAmPm] = useState<AmPm>('AM');
  const [editEndHour, setEditEndHour] = useState(10);
  const [editEndMinute, setEditEndMinute] = useState(0);
  const [editEndAmPm, setEditEndAmPm] = useState<AmPm>('AM');
  const [editCalMonth, setEditCalMonth] = useState(new Date().getMonth());
  const [editCalYear, setEditCalYear] = useState(new Date().getFullYear());
  const [mounted, setMounted] = useState(false);
  // One-time client mount flag for SSR-safe portal rendering (createPortal needs `document`);
  // rendering null on both server and first client paint avoids a hydration mismatch.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  if (loading) return <ReviewSkeleton />;
  if (!testData) return (
    <div className="max-w-[1200px] mx-auto animate-fade-in pt-8">
      <div className="text-center py-16 border border-[var(--border-subtle)] rounded-[var(--radius)] bg-[var(--bg-surface)]">
        <p className="text-[var(--text-primary)] text-[13px] font-medium">Test not found.</p>
        <Link href="/uniadmin/tests" className="inline-flex items-center gap-1.5 mt-3 text-[12.5px] font-medium text-[var(--accent-orange)] hover:underline">
          <ArrowLeft size={13} /> Back to Tests
        </Link>
      </div>
    </div>
  );

  const sections: TestSection[] = testData.sections || [];
  const hasOnlyCodingProblems = sections.length === 0 && (testData.problems?.length ?? 0) > 0;
  let totalQuestions = 0;
  for (const s of sections) totalQuestions += (s.questions || []).length;
  if (totalQuestions === 0) totalQuestions = testData.problems?.length || 0;

  const published = !!testData.published;
  const allowReattempts = !!testData.allowReattempts;
  const startTxt = formatSchedule(testData.examStart);
  const endTime = testData.examEnd ? new Date(testData.examEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
  const scheduleRange = startTxt ? (endTime ? `${startTxt} – ${endTime}` : startTxt) : 'Not scheduled';

  const openEdit = () => {
    setEditDuration(testData.duration || 60);
    if (testData.examStart) {
      const d = new Date(testData.examStart);
      const day = new Date(d); day.setHours(0, 0, 0, 0);
      setEditExamDate(day);
      setEditCalMonth(d.getMonth());
      setEditCalYear(d.getFullYear());
      const s = from24Hour(d.getHours());
      setEditStartHour(s.hour); setEditStartAmPm(s.ampm); setEditStartMinute(d.getMinutes());
    } else {
      setEditExamDate(null);
      setEditCalMonth(new Date().getMonth());
      setEditCalYear(new Date().getFullYear());
      setEditStartHour(9); setEditStartMinute(0); setEditStartAmPm('AM');
    }
    if (testData.examEnd) {
      const d = new Date(testData.examEnd);
      const e = from24Hour(d.getHours());
      setEditEndHour(e.hour); setEditEndAmPm(e.ampm); setEditEndMinute(d.getMinutes());
    } else {
      setEditEndHour(10); setEditEndMinute(0); setEditEndAmPm('AM');
    }
    setEditOpen(true);
  };

  const editPrevMonth = () => {
    if (editCalMonth === 0) { setEditCalMonth(11); setEditCalYear(y => y - 1); }
    else setEditCalMonth(m => m - 1);
  };
  const editNextMonth = () => {
    if (editCalMonth === 11) { setEditCalMonth(0); setEditCalYear(y => y + 1); }
    else setEditCalMonth(m => m + 1);
  };

  const saveSchedule = async () => {
    if (!editExamDate) return;
    await onSaveSchedule(
      editDuration,
      buildISOString(editExamDate, editStartHour, editStartMinute, editStartAmPm),
      buildISOString(editExamDate, editEndHour, editEndMinute, editEndAmPm),
    );
    setEditOpen(false);
  };

  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in">
      {/* Header */}
      <div className="pt-8 mb-6">
        <Link href="/uniadmin/tests" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors mb-4">
          <ArrowLeft size={14} /> Tests
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[26px] font-semibold text-[var(--text-primary)] tracking-[-0.025em] truncate">{testData.title || testData.sourceFileName}</h1>
            <div className="flex items-center gap-2.5 mt-2 text-[12px]">
              <span className={`inline-flex items-center gap-1.5 font-medium ${published ? 'text-[var(--status-success)]' : 'text-[var(--status-warning)]'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${published ? 'bg-[var(--status-success)]' : 'bg-[var(--status-warning)]'}`} />
                {published ? 'Published' : 'Not published'}
              </span>
              <span className="w-px h-3.5 bg-[var(--border-subtle)]" />
              <span className="text-[var(--text-faint)]">{totalQuestions} questions</span>
            </div>
          </div>
          <button
            onClick={published ? onUnpublish : onPublish}
            disabled={publishing}
            className={primaryBtn}
          >
            {publishing ? (published ? 'Unpublishing…' : 'Publishing…') : (published ? 'Unpublish' : 'Approve & Publish')}
          </button>
        </div>
      </div>

      {/* Manage test — one consolidated control panel */}
      <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden mb-7">
        {/* header: title + action toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-[var(--border-subtle)]">
          <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">Manage test</h2>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => (editOpen ? setEditOpen(false) : openEdit())} className={ghostBtn}>
              <Pencil size={13} /> {editOpen ? 'Close' : 'Edit schedule'}
            </button>
            <button onClick={onCopyLink} className={ghostBtn}><Copy size={13} /> Copy link</button>
            <button onClick={onDelete} disabled={deleting} className={dangerBtn}>
              <Trash2 size={13} /> {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>

        {/* inline schedule editor */}
        {editOpen && (
          <div className="px-5 py-4 border-b border-[var(--border-subtle)] animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-4">
                <div>
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-muted)] mb-1.5"><Clock size={11} className="text-[var(--text-faint)]" /> Duration (minutes)</label>
                  <input type="number" min={5} max={300} value={editDuration} onChange={e => setEditDuration(Number(e.target.value))} className="w-full px-3.5 py-2.5 text-[13px]" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <TimeField label="From" hour={editStartHour} minute={editStartMinute} ampm={editStartAmPm} onHour={setEditStartHour} onMinute={setEditStartMinute} onAmPm={setEditStartAmPm} />
                  <TimeField label="To" hour={editEndHour} minute={editEndMinute} ampm={editEndAmPm} onHour={setEditEndHour} onMinute={setEditEndMinute} onAmPm={setEditEndAmPm} />
                </div>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-muted)] mb-1.5"><Calendar size={11} className="text-[var(--text-faint)]" /> Exam Date</label>
                <MiniCalendar month={editCalMonth} year={editCalYear} selected={editExamDate} onPrev={editPrevMonth} onNext={editNextMonth} onPick={setEditExamDate} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEditOpen(false)} className={ghostBtn}>Cancel</button>
              <button onClick={saveSchedule} disabled={savingSchedule || !editExamDate} className={primaryBtn}>
                <Save size={13} /> {savingSchedule ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}

        {/* schedule summary + reattempts toggle */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-[var(--text-secondary)]">
            <span className="flex items-center gap-1.5"><Calendar size={13} className="text-[var(--text-faint)]" /> {scheduleRange}</span>
            <span className="hidden sm:block w-px h-4 bg-[var(--border-subtle)]" />
            <span className="flex items-center gap-1.5"><Clock size={13} className="text-[var(--text-faint)]" /> {testData.duration || '—'} min</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-[12.5px] font-medium text-[var(--text-secondary)]">Allow reattempts</span>
            <Toggle checked={allowReattempts} onChange={onToggleReattempts} disabled={reassigning} label="Allow reattempts" />
          </div>
        </div>
      </div>

      {/* Questions */}
      <h2 className={`${microLabel} mb-4`}>Questions</h2>
      <div className="space-y-6">
        {sections.map((section: TestSection, sIdx: number) => (
          <div key={sIdx}>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
                {section.title || `Section ${sIdx + 1} — ${sectionLabel[section.type ?? ''] || 'Questions'}`}
              </h3>
              <span className="text-[11px] text-[var(--text-faint)]">{(section.questions || []).length} questions</span>
            </div>

            <div className="space-y-3">
              {(section.questions || []).map((q: TestQuestion, qIdx: number) => (
                <div key={qIdx} className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-[10px] font-semibold uppercase tracking-[0.07em] px-2 py-0.5 rounded-full ${
                      section.type === 'mcq' ? 'text-[var(--type-mcq)] bg-[var(--type-mcq)]/10'
                      : 'text-[var(--type-event)] bg-[var(--type-event)]/10'
                    }`}>
                      Q{qIdx + 1}
                    </span>
                  </div>

                  <h4 className="text-[14px] font-medium text-[var(--text-primary)] mb-3 whitespace-pre-wrap">
                    {q.questionDescription || q.questionText}
                  </h4>

                  {section.type === 'mcq' && q.options && (
                    <div className="space-y-1.5 mb-3">
                      {q.options.map((opt: string, oIdx: number) => {
                        const letter = String.fromCharCode(65 + oIdx);
                        const isCorrect = q.correctAnswer === letter;
                        return (
                          <div key={oIdx} className={`flex items-center gap-2 px-3 py-2 rounded-[8px] text-[13px] border ${
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
                    <div className="flex items-center gap-2 px-3 py-2 rounded-[8px] border border-[var(--status-success)]/30 bg-[var(--status-success)]/10 text-[13px] text-[var(--status-success)] font-medium">
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
                          <pre className="bg-[var(--bg-elevated)] p-3 rounded-[8px] text-[12px] text-[var(--status-success)] font-mono">
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
                            {q.hiddenTestCases.map((tc, tci: number) => (
                              <pre key={tci} className="bg-[var(--bg-elevated)] border border-[var(--type-event)]/20 p-3 rounded-[8px] text-[12px] text-[var(--type-event)] font-mono">
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
        ))}

        {hasOnlyCodingProblems && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">Coding Problems</h3>
              <span className="text-[11px] text-[var(--text-faint)]">{testData.problems?.length ?? 0} questions</span>
            </div>
            <div className="space-y-3">
              {(testData.problems || []).map((q: TestQuestion, index: number) => (
                <div key={index} className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--type-event)] bg-[var(--type-event)]/10 px-2 py-0.5 rounded-full">
                      {q.difficulty || 'Q'} — Q{index + 1}
                    </span>
                  </div>
                  <h4 className="text-[14px] font-medium text-[var(--text-primary)] mb-4 whitespace-pre-wrap">{q.questionDescription}</h4>
                  {q.sampleTestCases && q.sampleTestCases.length > 0 && (
                    <div className="mt-3 space-y-1">
                      <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.07em]">Sample Case:</p>
                      <pre className="bg-[var(--bg-elevated)] p-3 rounded-[8px] text-[12px] text-[var(--status-success)] font-mono">
{`Input: ${q.sampleTestCases[0]?.input}\nOutput: ${q.sampleTestCases[0]?.output}`}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {sections.length === 0 && !hasOnlyCodingProblems && (
          <div className="text-center py-12 border border-[var(--border-subtle)] rounded-[var(--radius)] bg-[var(--bg-surface)]">
            <HelpCircle size={22} className="mx-auto text-[var(--text-faint)] mb-2.5" />
            <p className="text-[12.5px] font-medium text-[var(--text-primary)]">No questions found in this test</p>
          </div>
        )}
      </div>

      {/* Toast — portaled to escape the page's `animate-fade-in` transform */}
      {mounted && toast && createPortal(
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9998] animate-fade-in">
          <div className="flex items-center gap-2.5 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius)] shadow-lg px-4 py-2.5">
            <CheckCircle2 size={15} className="text-[var(--status-success)]" />
            <p className="text-[12.5px] font-medium text-[var(--text-primary)]">{toast}</p>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
