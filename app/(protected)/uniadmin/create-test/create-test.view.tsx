'use client';
import { Link, useTransitionRouter } from 'next-view-transitions';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import {
  collection, doc, getDoc, getDocs, limit, onSnapshot, query, where,
  documentId, orderBy, startAfter, type DocumentData, type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { queueTestDocument } from '@/app/actions/test-processing-jobs';
import { authHeaders, getIdToken } from '@/lib/auth-client';
import { getCache, setCache } from '@/lib/page-cache';
import Upload from '@/components/icons/Upload';
import FileText from '@/components/icons/FileText';
import Clock from '@/components/icons/Clock';
import Type from '@/components/icons/Type';
import AlignLeft from '@/components/icons/AlignLeft';
import Calendar from '@/components/icons/Calendar';
import ChevronRight from '@/components/icons/ChevronRight';
import CheckCircle from '@/components/icons/CheckCircle';
import Tag from '@/components/icons/Tag';
import ChevronDown from '@/components/icons/ChevronDown';
import ChevronUp from '@/components/icons/ChevronUp';
import Copy from '@/components/icons/Copy';
import Check from '@/components/icons/Check';
import HelpCircle from '@/components/icons/HelpCircle';
import ExternalLink from '@/components/icons/ExternalLink';
import { ListSkeleton } from '@/components/Skeleton';
import { StatBar } from '@/components/StatBar';
import { Toggle } from '@/components/Toggle';
import { MiniCalendar, TimeField, buildISOString, formatSchedule, type AmPm } from '@/components/SchedulePicker';

interface TestUpload {
  id: string;
  title: string;
  approved: boolean;
  questionCount: number;
  examStart?: string;
  examEnd?: string;
  category?: string;
  duration?: number;
  [key: string]: unknown;
}

export default function TestsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useTransitionRouter();

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
  const [processingJobId, setProcessingJobId] = useState<string | null>(null);

  // Tests list state
  const cacheKey = user ? `unitestlist:${user.uid}` : '';
  const cachedTests = cacheKey ? getCache<{ testUploads: TestUpload[]; hasMoreTests: boolean }>(cacheKey) : undefined;
  const [testUploads, setTestUploads] = useState<TestUpload[]>(cachedTests?.testUploads ?? []);
  const [fetching, setFetching] = useState(!cachedTests);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [lastTestDoc, setLastTestDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMoreTests, setHasMoreTests] = useState(cachedTests?.hasMoreTests ?? false);
  const [loadingMoreTests, setLoadingMoreTests] = useState(false);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(clock);
  }, []);

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
  const loadTests = useCallback(async () => {
    if (!user) return;
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const univId = userDoc.data()?.universityId;
      if (univId) {
        const q = query(
          collection(db, 'tests'),
          where('universityId', '==', univId),
          orderBy(documentId()),
          limit(50),
        );
        const snapshot = await getDocs(q);
        const mapped = snapshot.docs.map(d => {
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
          } as TestUpload;
        });
        setTestUploads(mapped);
        setLastTestDoc(snapshot.docs.at(-1) ?? null);
        setHasMoreTests(snapshot.size === 50);
        if (cacheKey) setCache(cacheKey, { testUploads: mapped, hasMoreTests: snapshot.size === 50 });
      }
    } catch (err) {
      console.error("Failed to load tests:", err);
    } finally {
      setFetching(false);
    }
  }, [user, cacheKey]);

  const loadMoreTests = async () => {
    if (!universityId || !lastTestDoc || loadingMoreTests) return;
    setLoadingMoreTests(true);
    try {
      const snapshot = await getDocs(query(
        collection(db, 'tests'),
        where('universityId', '==', universityId),
        orderBy(documentId()),
        startAfter(lastTestDoc),
        limit(50),
      ));
      const next = snapshot.docs.map((testDoc) => {
        const data = testDoc.data();
        const questionCount = Array.isArray(data.sections)
          ? data.sections.reduce((total: number, section: { questions?: unknown[] }) => total + (section.questions?.length ?? 0), 0)
          : (data.problems?.length || 0);
        return {
          id: testDoc.id,
          ...data,
          title: data.title || data.sourceFileName || 'Untitled Test',
          approved: data.approved ?? false,
          questionCount,
        } as TestUpload;
      });
      setTestUploads((previous) => [...previous, ...next]);
      setLastTestDoc(snapshot.docs.at(-1) ?? lastTestDoc);
      setHasMoreTests(snapshot.size === 50);
    } finally {
      setLoadingMoreTests(false);
    }
  };

  useEffect(() => {
    const start = window.setTimeout(() => void loadTests(), 0);
    return () => window.clearTimeout(start);
  }, [loadTests]);

  useEffect(() => {
    if (!processingJobId) return;
    const unsubscribe = onSnapshot(doc(db, 'test_processing_jobs', processingJobId), (snapshot) => {
      const job = snapshot.data();
      if (!job) return;
      if (job.status === 'queued') {
        setStatus({ type: 'info', message: 'Document queued. Processing will begin shortly…' });
      } else if (job.status === 'processing') {
        setStatus({ type: 'info', message: 'Extracting questions and generating coding test cases…' });
      } else if (job.status === 'completed') {
        setStatus({ type: 'success', message: `Uploaded successfully — ${job.totalQuestionCount ?? 0} questions extracted. Please approve the test.` });
        setCreatedTestId(job.testId as string);
        setFile(null);
        setTitle('');
        setDescription('');
        setDuration(60);
        setExamDate(null);
        setAllowReattempts(false);
        setProcessingJobId(null);
        setIsParsing(false);
        void loadTests();
      } else if (job.status === 'failed') {
        setStatus({ type: 'error', message: job.error || 'Document processing failed.' });
        setCreatedTestId(null);
        setProcessingJobId(null);
        setIsParsing(false);
      }
    }, () => {
      setStatus({ type: 'error', message: 'Could not monitor the processing job.' });
      setProcessingJobId(null);
      setIsParsing(false);
    });
    return unsubscribe;
  }, [processingJobId, loadTests]);

  const handleQuestionsFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (selected.size > 10 * 1024 * 1024) {
        e.target.value = '';
        setFile(null);
        setStatus({ type: 'error', message: 'Document must be 10 MB or smaller.' });
        return;
      }
      setFile(selected);
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
    setStatus({ type: 'info', message: 'Uploading document to the processing queue…' });

    try {
      const examStart = buildISOString(examDate, startHour, startMinute, startAmPm);
      const examEnd = buildISOString(examDate, endHour, endMinute, endAmPm);
      const idToken = await getIdToken();
      if (!idToken) throw new Error('Your session expired. Please sign in again.');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('idToken', idToken);
      formData.append('universityId', universityId);
      formData.append('title', title);
      formData.append('description', description);
      formData.append('duration', String(duration));
      formData.append('examStart', examStart);
      formData.append('examEnd', examEnd);
      formData.append('allowReattempts', String(allowReattempts));

      const result = await queueTestDocument(formData);

      if (result.success && result.jobId) {
        setProcessingJobId(result.jobId);
        setStatus({ type: 'info', message: 'Document queued. You can leave this page; processing will continue.' });
        void fetch('/api/jobs/process-tests', {
          method: 'POST',
          headers: await authHeaders(),
          body: JSON.stringify({ jobId: result.jobId }),
        }).catch(() => {});
      } else {
        setStatus({ type: 'error', message: result.error || 'Failed to process the document.' });
        setCreatedTestId(null);
        setIsParsing(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred';
      setStatus({ type: 'error', message: msg });
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
  const scheduledCount = testUploads.filter(t => t.examStart && new Date(t.examEnd || t.examStart).getTime() >= now).length;

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
                <ChevronRight size={15} className="text-[var(--text-faint)] opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition shrink-0" />
              </Link>
            );
          })}
          {hasMoreTests && (
            <div className="flex justify-center p-3 border-t border-[var(--border-subtle)]">
              <button type="button" onClick={loadMoreTests} disabled={loadingMoreTests} className="btn-secondary !rounded-[10px] text-[12px] disabled:opacity-50">
                {loadingMoreTests ? 'Loading…' : 'Load more tests'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
