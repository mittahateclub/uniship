'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { processTestDocument } from '@/app/actions/process-test';
import Link from 'next/link';
import {
  Upload, FileText, Clock, Type, AlignLeft, Calendar, ChevronRight,
  CheckCircle, Tag, ChevronDown, ChevronUp, Copy, Check, HelpCircle, ExternalLink,
} from '@/components/icons';
import { ListSkeleton } from '@/components/Skeleton';
import { StatBar } from '@/components/StatBar';
import { Toggle } from '@/components/Toggle';
import { MiniCalendar, TimeField, buildISOString, formatSchedule, type AmPm } from '@/components/SchedulePicker';

export default function TestsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Upload form state
  const [file, setFile] = useState<File | null>(null);
  const [universityId, setUniversityId] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(60);
  const [examDate, setExamDate] = useState<Date | null>(null);
  const [startHour, setStartHour] = useState(9);
  const [startMinute, setStartMinute] = useState(0);
  const [startAmPm, setStartAmPm] = useState<AmPm>('AM');
  const [endHour, setEndHour] = useState(10);
  const [endMinute, setEndMinute] = useState(0);
  const [endAmPm, setEndAmPm] = useState<AmPm>('AM');
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [allowReattempts, setAllowReattempts] = useState(false);
  const [createdTestId, setCreatedTestId] = useState<string | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);

  // Tests list state
  const [testUploads, setTestUploads] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyLink = (testId: string) => {
    const link = `${window.location.origin}/user/test-portal/${testId}`;
    navigator.clipboard.writeText(link);
    setCopiedId(testId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading, router]);

  useEffect(() => {
    async function fetchAdminProfile() {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.universityId) {
              setUniversityId(data.universityId);
            } else {
              setStatus({ type: 'error', message: 'No University ID found for this admin.' });
            }
          }
        } catch (error) {
          console.error("Error fetching admin profile:", error);
          setStatus({ type: 'error', message: 'Failed to load admin profile.' });
        }
      }
    }
    fetchAdminProfile();
  }, [user]);

  // Load tests
  async function loadTests() {
    if (!user) return;
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const univId = userDoc.data()?.universityId;
      if (univId) {
        const q = query(collection(db, 'tests'), where('universityId', '==', univId));
        const snapshot = await getDocs(q);
        setTestUploads(snapshot.docs.map(d => {
          const data = d.data();
          // Count total questions from sections
          let totalQ = 0;
          if (data.sections && Array.isArray(data.sections)) {
            for (const s of data.sections) totalQ += (s.questions || []).length;
          }
          if (totalQ === 0) totalQ = data.problems?.length || 0;
          return {
            id: d.id,
            ...data,
            title: data.title || data.sourceFileName || 'Untitled Test',
            approved: data.approved ?? false,
            questionCount: totalQ,
          };
        }));
      }
    } catch (err) {
      console.error("Failed to load tests:", err);
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => { loadTests(); }, [user]);

  const handleQuestionsFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus({ type: '', message: '' });
      setCreatedTestId(null);
    }
  };

  const prevMonth = () => {
    if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear(y => y - 1); }
    else setCalendarMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear(y => y + 1); }
    else setCalendarMonth(m => m + 1);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !universityId || !examDate || !file) return;

    setIsParsing(true);
    setStatus({ type: 'info', message: 'Generating test...' });

    try {
      const examStart = buildISOString(examDate, startHour, startMinute, startAmPm);
      const examEnd = buildISOString(examDate, endHour, endMinute, endAmPm);

      const formData = new FormData();
      formData.append('file', file);

      const result = await processTestDocument(formData);

      if (result.success) {
        // Save to Firestore from client (where user is authenticated)
        const docRef = await addDoc(collection(db, 'tests'), {
          title: title.trim() || result.sourceFileName?.replace(/\.pdf$/i, '') || 'Untitled Test',
          description: description.trim(),
          duration,
          category: 'General',
          totalQuestions: result.totalQuestionCount,
          examStart,
          examEnd,
          metadata: result.metadata,
          sections: result.sections,
          problems: result.codingProblems,
          universityId,
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          sourceFileName: result.sourceFileName,
          approved: false,
          allowReattempts,
        });

        setStatus({ type: 'success', message: `Uploaded successfully — ${result.totalQuestionCount} questions extracted. Please approve the test.` });
        setCreatedTestId(docRef.id);
        setFile(null);
        setTitle('');
        setDescription('');
        setDuration(60);
        setExamDate(null);
        setAllowReattempts(false);
        loadTests();
      } else {
        setStatus({ type: 'error', message: result.error });
        setCreatedTestId(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred';
      setStatus({ type: 'error', message: msg });
    } finally {
      setIsParsing(false);
    }
  };

  if (authLoading || fetching) return <ListSkeleton rows={5} />;

  const studentLink = (id: string) => `${typeof window !== 'undefined' ? window.location.origin : ''}/user/test-portal/${id}`;
  const missing = [
    !universityId && 'University ID (profile issue)',
    !title.trim() && 'Test Name',
    !examDate && 'Exam Date',
    !file && 'Test PDF',
  ].filter(Boolean);

  const approvedCount = testUploads.filter(t => t.approved).length;
  const pendingCount = testUploads.length - approvedCount;
  const scheduledCount = testUploads.filter(t => t.examStart && new Date(t.examEnd || t.examStart).getTime() >= Date.now()).length;

  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in">
      {/* ── Header ── */}
      <div className="pt-8 mb-7 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-semibold text-[var(--text-primary)] tracking-[-0.025em]">Tests</h1>
          <p className="text-[var(--text-tertiary)] text-[13.5px] mt-1.5">Generate AI tests from PDFs, then open one to review, schedule and approve it.</p>
        </div>
        <button
          onClick={() => setShowUploadForm(v => !v)}
          className="btn-primary !rounded-[10px] flex items-center gap-1.5 text-[12.5px] !px-3.5 !py-2"
        >
          <Upload size={14} />
          {showUploadForm ? 'Hide' : 'New Test'}
          {showUploadForm ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {/* ── Overview — slim inline summary ── */}
      <StatBar
        className="mb-6"
        items={[
          { label: 'tests', value: testUploads.length, icon: FileText },
          { label: 'approved', value: approvedCount, icon: CheckCircle, accent: approvedCount > 0 ? 'text-[var(--status-success)]' : undefined },
          { label: 'pending', value: pendingCount, icon: Clock, accent: pendingCount > 0 ? 'text-[var(--status-warning)]' : undefined },
          { label: 'scheduled', value: scheduledCount, icon: Calendar },
        ]}
      />

      {/* ── Upload form ── */}
      {showUploadForm && (
        <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden mb-6">
          <div className="flex items-center gap-2 px-5 sm:px-6 h-13 py-3.5 border-b border-[var(--border-subtle)]">
            <FileText size={15} className="text-[var(--text-tertiary)]" />
            <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">Generate test from PDF</h2>
          </div>

          <div className="p-5 sm:p-6">
            {status.message && (
              <div className={`mb-4 p-3 rounded-[var(--radius)] text-[13px] font-medium border ${
                status.type === 'error' ? 'bg-[var(--status-danger)]/10 text-[var(--status-danger)] border-[var(--status-danger)]/20'
                : status.type === 'success' ? 'bg-[var(--status-success)]/10 text-[var(--status-success)] border-[var(--status-success)]/20'
                : 'bg-[var(--type-event)]/10 text-[var(--type-event)] border-[var(--type-event)]/20'
              }`}>
                {status.message}
              </div>
            )}
            {status.type === 'success' && createdTestId && (
              <div className="mb-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <button
                  type="button"
                  onClick={() => router.push(`/uniadmin/tests/review/${createdTestId}`)}
                  className="btn-primary !rounded-[10px] text-[12.5px] !px-3.5 !py-2 inline-flex items-center justify-center gap-1.5 shrink-0"
                >
                  Review &amp; Approve <ExternalLink size={12} />
                </button>
                <span className="flex-1 flex items-center gap-2 px-3 h-9 rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[12px] text-[var(--text-secondary)] font-mono truncate select-all">
                  {studentLink(createdTestId)}
                </span>
                <button
                  type="button"
                  onClick={() => copyLink(createdTestId)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 h-9 rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-active)] transition-colors shrink-0"
                >
                  {copiedId === createdTestId ? <Check size={13} className="text-[var(--status-success)]" /> : <Copy size={13} />}
                  {copiedId === createdTestId ? 'Copied' : 'Copy link'}
                </button>
              </div>
            )}

            <form onSubmit={handleUpload} className="space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-5 items-stretch">
                {/* Left — details */}
                <div className="flex flex-col gap-4">
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)]">Details</p>
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-muted)] mb-1.5"><Type size={11} className="text-[var(--text-faint)]" /> Test Name</label>
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Midterm Mock Test" className="w-full px-3.5 py-2.5 text-[13px] placeholder:text-[var(--text-faint)]" />
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-muted)] mb-1.5"><Clock size={11} className="text-[var(--text-faint)]" /> Duration (minutes)</label>
                    <input type="number" min={5} max={300} value={duration} onChange={e => setDuration(Number(e.target.value))} className="w-full px-3.5 py-2.5 text-[13px]" />
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-muted)] mb-1.5"><AlignLeft size={11} className="text-[var(--text-faint)]" /> Description</label>
                    <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Short description of this test…" className="w-full px-3.5 py-2.5 text-[13px] placeholder:text-[var(--text-faint)] resize-none" />
                  </div>
                  <div className="flex-1 flex flex-col">
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-muted)] mb-1.5"><FileText size={11} className="text-[var(--text-faint)]" /> Test PDF</label>
                    <div className="relative overflow-hidden rounded-[var(--radius)] border border-dashed border-[var(--border-active)] p-5 text-center bg-[var(--bg-elevated)] hover:border-[var(--accent-orange)]/50 transition-colors duration-150 cursor-pointer flex-1 min-h-[130px] flex flex-col items-center justify-center">
                      <input type="file" accept=".pdf,.docx" onChange={handleQuestionsFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                      <Upload size={18} className="mb-1.5 text-[var(--text-faint)]" />
                      <p className="text-[12px] text-[var(--text-tertiary)] pointer-events-none truncate font-medium">
                        {file ? file.name : 'Drop or click to upload a PDF'}
                      </p>
                      <p className="text-[10.5px] text-[var(--text-faint)] pointer-events-none mt-0.5">Questions, answers &amp; explanations in one file</p>
                    </div>
                  </div>
                </div>

                {/* Right — schedule */}
                <div className="flex flex-col gap-4">
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)]">Schedule</p>
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-muted)] mb-1.5"><Calendar size={11} className="text-[var(--text-faint)]" /> Exam Date</label>
                    <MiniCalendar month={calendarMonth} year={calendarYear} selected={examDate} onPrev={prevMonth} onNext={nextMonth} onPick={setExamDate} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <TimeField label="From" hour={startHour} minute={startMinute} ampm={startAmPm} onHour={setStartHour} onMinute={setStartMinute} onAmPm={setStartAmPm} />
                    <TimeField label="To" hour={endHour} minute={endMinute} ampm={endAmPm} onHour={setEndHour} onMinute={setEndMinute} onAmPm={setEndAmPm} />
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-3">
                    <div>
                      <p className="text-[12.5px] font-medium text-[var(--text-primary)]">Allow reattempts</p>
                      <p className="text-[11px] text-[var(--text-faint)] mt-0.5">Let students retake this test</p>
                    </div>
                    <Toggle checked={allowReattempts} onChange={setAllowReattempts} label="Allow reattempts" />
                  </div>
                </div>
              </div>

              {!isParsing && missing.length > 0 && (
                <p className="text-[12px] text-[var(--text-faint)]">Still needed: {missing.join(', ')}</p>
              )}

              <button type="submit" disabled={isParsing || !universityId || !title.trim() || !examDate || !file} className="btn-primary !rounded-[10px] w-full inline-flex items-center justify-center gap-2 disabled:opacity-50">
                <Upload size={14} /> {isParsing ? 'Processing…' : 'Upload & Parse PDF'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Tests list ── */}
      {testUploads.length === 0 ? (
        <div className="text-center py-16 border border-[var(--border-subtle)] rounded-[var(--radius)] bg-[var(--bg-surface)]">
          <FileText size={26} className="mx-auto text-[var(--text-faint)] mb-3" />
          <p className="text-[var(--text-primary)] text-[13px] font-medium">No tests yet</p>
          <p className="text-[var(--text-faint)] text-[12px] mt-1">Click “New Test” to generate one from a PDF.</p>
        </div>
      ) : (
        <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
          {testUploads.map((test) => {
            const schedule = formatSchedule(test.examStart);
            return (
              <Link
                key={test.id}
                href={`/uniadmin/tests/review/${test.id}`}
                className="group flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4 border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-elevated)] transition-colors duration-150"
              >
                <span className="w-9 h-9 rounded-[8px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
                  <FileText size={15} className="text-[var(--text-tertiary)]" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[14px] font-semibold text-[var(--text-primary)] tracking-[-0.01em] truncate">{test.title}</h3>
                  <div className="flex items-center gap-x-3 gap-y-0.5 flex-wrap mt-0.5 text-[11.5px] text-[var(--text-faint)]">
                    <span className="flex items-center gap-1"><HelpCircle size={10} />{test.questionCount} questions</span>
                    {test.category && <span className="flex items-center gap-1"><Tag size={10} />{test.category}</span>}
                    {test.duration && <span className="flex items-center gap-1"><Clock size={10} />{test.duration} min</span>}
                    {schedule && <span className="flex items-center gap-1"><Calendar size={10} />{schedule}</span>}
                  </div>
                </div>
                <span className="flex items-center gap-1.5 text-[11.5px] font-medium shrink-0">
                  <span className={`w-1.5 h-1.5 rounded-full ${test.approved ? 'bg-[var(--status-success)]' : 'bg-[var(--text-faint)]'}`} />
                  <span className={test.approved ? 'text-[var(--status-success)]' : 'text-[var(--text-faint)]'}>{test.approved ? 'Approved' : 'Pending'}</span>
                </span>
                <ChevronRight size={15} className="text-[var(--text-faint)] opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
