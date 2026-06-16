'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, query, where, deleteDoc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { processTestDocument } from '@/app/actions/process-test';
import Link from 'next/link';
import {
  Upload, FileText, Clock, Type, AlignLeft, Calendar,
  ChevronLeft, ChevronRight, Trash2, CheckCircle, XCircle,
  Tag, Pencil, X, Save, ChevronDown, ChevronUp, Copy, Check, RefreshCw, HelpCircle, ExternalLink,
} from '@/components/icons';
import { ListSkeleton } from '@/components/Skeleton';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
type AmPm = 'AM' | 'PM';

// ── Reusable inline date picker (used by the upload form + edit modal) ──
function MiniCalendar({ month, year, selected, onPrev, onNext, onPick }: {
  month: number; year: number; selected: Date | null;
  onPrev: () => void; onNext: () => void; onPick: (d: Date) => void;
}) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  return (
    <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={onPrev} className="p-1 rounded-full hover:bg-[var(--bg-surface)] transition-colors">
          <ChevronLeft size={14} className="text-[var(--text-secondary)]" />
        </button>
        <span className="text-[13px] font-semibold text-[var(--text-primary)]">{MONTH_NAMES[month]} {year}</span>
        <button type="button" onClick={onNext} className="p-1 rounded-full hover:bg-[var(--bg-surface)] transition-colors">
          <ChevronRight size={14} className="text-[var(--text-secondary)]" />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} className="text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-faint)] py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const date = new Date(year, month, day); date.setHours(0, 0, 0, 0);
          const isPast = date < today;
          const isSelected = selected && selected.getTime() === date.getTime();
          const isToday = date.getTime() === today.getTime();
          return (
            <button
              key={day}
              type="button"
              disabled={isPast}
              onClick={() => onPick(date)}
              className={`h-8 text-[12px] rounded-[6px] transition-colors tabular-nums ${
                isSelected ? 'bg-[var(--type-event)] text-white font-semibold'
                : isPast ? 'text-[var(--text-faint)]/40 cursor-not-allowed'
                : isToday ? 'text-[var(--type-event)] font-semibold hover:bg-[var(--type-event)]/10'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Reusable hour:minute AM/PM picker ──
function TimeField({ label, hour, minute, ampm, onHour, onMinute, onAmPm }: {
  label: string; hour: number; minute: number; ampm: AmPm;
  onHour: (n: number) => void; onMinute: (n: number) => void; onAmPm: (v: AmPm) => void;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-muted)] mb-1.5">
        <Clock size={11} className="text-[var(--text-faint)]" /> {label}
      </label>
      <div className="flex items-center gap-1.5 rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-2">
        <select value={hour} onChange={e => onHour(Number(e.target.value))} className="!bg-transparent !border-0 !p-0 text-[13px] text-[var(--text-primary)] focus:outline-none appearance-none text-center w-7 cursor-pointer tabular-nums">
          {Array.from({ length: 12 }, (_, i) => i + 1).map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}</option>)}
        </select>
        <span className="text-[13px] text-[var(--text-faint)] font-semibold">:</span>
        <select value={minute} onChange={e => onMinute(Number(e.target.value))} className="!bg-transparent !border-0 !p-0 text-[13px] text-[var(--text-primary)] focus:outline-none appearance-none text-center w-7 cursor-pointer tabular-nums">
          {Array.from({ length: 12 }, (_, i) => i * 5).map(m => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
        </select>
        <div className="flex rounded-[7px] overflow-hidden border border-[var(--border-subtle)] ml-auto">
          {(['AM', 'PM'] as AmPm[]).map(v => (
            <button key={v} type="button" onClick={() => onAmPm(v)} className={`px-2 py-0.5 text-[11px] font-semibold transition-colors ${ampm === v ? 'bg-[var(--type-event)] text-white' : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-surface)]'}`}>{v}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

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
  const [createdTestId, setCreatedTestId] = useState<string | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);

  // Manage tests state
  const [testUploads, setTestUploads] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [editingTest, setEditingTest] = useState<any | null>(null);
  const [editDuration, setEditDuration] = useState(60);
  const [editExamDate, setEditExamDate] = useState<Date | null>(null);
  const [editStartHour, setEditStartHour] = useState(9);
  const [editStartMinute, setEditStartMinute] = useState(0);
  const [editStartAmPm, setEditStartAmPm] = useState<AmPm>('AM');
  const [editEndHour, setEditEndHour] = useState(10);
  const [editEndMinute, setEditEndMinute] = useState(0);
  const [editEndAmPm, setEditEndAmPm] = useState<AmPm>('PM');
  const [editCalendarMonth, setEditCalendarMonth] = useState(new Date().getMonth());
  const [editCalendarYear, setEditCalendarYear] = useState(new Date().getFullYear());
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [reassigningId, setReassigningId] = useState<string | null>(null);
  const [reassignedTitle, setReassignedTitle] = useState<string | null>(null);

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

  const to24Hour = (h: number, ampm: AmPm) => {
    if (ampm === 'AM') return h === 12 ? 0 : h;
    return h === 12 ? 12 : h + 12;
  };

  const from24Hour = (h24: number): { hour: number; ampm: AmPm } => {
    if (h24 === 0) return { hour: 12, ampm: 'AM' };
    if (h24 < 12) return { hour: h24, ampm: 'AM' };
    if (h24 === 12) return { hour: 12, ampm: 'PM' };
    return { hour: h24 - 12, ampm: 'PM' };
  };

  const buildISOString = (date: Date, hour: number, minute: number, ampm: AmPm) => {
    const d = new Date(date);
    d.setHours(to24Hour(hour, ampm), minute, 0, 0);
    return d.toISOString();
  };

  const prevMonth = () => {
    if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear(y => y - 1); }
    else setCalendarMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear(y => y + 1); }
    else setCalendarMonth(m => m + 1);
  };
  const editPrevMonth = () => {
    if (editCalendarMonth === 0) { setEditCalendarMonth(11); setEditCalendarYear(y => y - 1); }
    else setEditCalendarMonth(m => m - 1);
  };
  const editNextMonth = () => {
    if (editCalendarMonth === 11) { setEditCalendarMonth(0); setEditCalendarYear(y => y + 1); }
    else setEditCalendarMonth(m => m + 1);
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
        });

        setStatus({ type: 'success', message: `Uploaded successfully — ${result.totalQuestionCount} questions extracted. Please approve the test.` });
        setCreatedTestId(docRef.id);
        setFile(null);
        setTitle('');
        setDescription('');
        setDuration(60);
        setExamDate(null);
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

  const handleDelete = async (testId: string) => {
    if (!window.confirm("Are you sure you want to delete this test?")) return;
    setDeletingId(testId);
    try {
      await deleteDoc(doc(db, 'tests', testId));
      setTestUploads(prev => prev.filter(test => test.id !== testId));
    } catch (error) {
      console.error("Error deleting test:", error);
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleApproval = async (testId: string, currentlyApproved: boolean) => {
    setTogglingId(testId);
    try {
      await updateDoc(doc(db, 'tests', testId), { approved: !currentlyApproved });
      setTestUploads(prev => prev.map(t => t.id === testId ? { ...t, approved: !currentlyApproved } : t));
    } catch (error) {
      console.error('Error toggling approval:', error);
    } finally {
      setTogglingId(null);
    }
  };

  const handleReassignTest = async (testId: string, testTitle: string) => {
    setReassigningId(testId);
    try {
      const snap = await getDocs(query(
        collection(db, 'test_results'),
        where('testId', '==', testId),
      ));
      await Promise.all(snap.docs.map(d => updateDoc(doc(db, 'test_results', d.id), { reattemptAllowed: true })));
      setReassignedTitle(testTitle);
      setTimeout(() => setReassignedTitle(null), 3500);
    } catch (e) {
      console.error('Failed to reassign test:', e);
    }
    setReassigningId(null);
  };

  const openEdit = (test: any) => {
    setEditingTest(test);
    setEditDuration(test.duration || 60);
    if (test.examStart) {
      const d = new Date(test.examStart);
      const day = new Date(d); day.setHours(0, 0, 0, 0);
      setEditExamDate(day);
      setEditCalendarMonth(d.getMonth());
      setEditCalendarYear(d.getFullYear());
      const s = from24Hour(d.getHours());
      setEditStartHour(s.hour); setEditStartAmPm(s.ampm); setEditStartMinute(d.getMinutes());
    } else {
      setEditExamDate(null);
      setEditCalendarMonth(new Date().getMonth());
      setEditCalendarYear(new Date().getFullYear());
      setEditStartHour(9); setEditStartMinute(0); setEditStartAmPm('AM');
    }
    if (test.examEnd) {
      const d = new Date(test.examEnd);
      const e = from24Hour(d.getHours());
      setEditEndHour(e.hour); setEditEndAmPm(e.ampm); setEditEndMinute(d.getMinutes());
    } else {
      setEditEndHour(10); setEditEndMinute(0); setEditEndAmPm('AM');
    }
  };

  const handleSaveEdit = async () => {
    if (!editingTest || !editExamDate) return;
    setSaving(true);
    try {
      const updates: Record<string, any> = {
        approved: false,
        duration: editDuration,
        examStart: buildISOString(editExamDate, editStartHour, editStartMinute, editStartAmPm),
        examEnd: buildISOString(editExamDate, editEndHour, editEndMinute, editEndAmPm),
      };
      await updateDoc(doc(db, 'tests', editingTest.id), updates);
      setTestUploads(prev => prev.map(t => t.id === editingTest.id ? { ...t, ...updates } : t));
      setEditingTest(null);
    } catch (err) {
      console.error('Failed to save edits:', err);
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || fetching) return <ListSkeleton rows={5} />;

  const studentLink = (id: string) => `${typeof window !== 'undefined' ? window.location.origin : ''}/user/test-portal/${id}`;
  const fmtSchedule = (iso?: string) => {
    if (!iso) return null;
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  const missing = [
    !universityId && 'University ID (profile issue)',
    !title.trim() && 'Test Name',
    !examDate && 'Exam Date',
    !file && 'Test PDF',
  ].filter(Boolean);

  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in">
      {/* Reassign success toast */}
      {reassignedTitle && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="flex items-center gap-3 bg-[var(--bg-elevated)] border border-[var(--status-success)]/40 rounded-[var(--radius)] shadow-lg px-5 py-3">
            <div className="w-7 h-7 rounded-full bg-[var(--status-success)]/10 flex items-center justify-center shrink-0">
              <CheckCircle size={15} className="text-[var(--status-success)]" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-[var(--text-primary)]">&quot;{reassignedTitle}&quot; reassigned</p>
              <p className="text-[11px] text-[var(--text-tertiary)]">All students can now reattempt this test</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="pt-8 mb-7 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-semibold text-[var(--text-primary)] tracking-[-0.025em]">Tests</h1>
          <p className="text-[var(--text-tertiary)] text-[13.5px] mt-1.5">{testUploads.length} test{testUploads.length !== 1 ? 's' : ''} · generate a new one from a PDF</p>
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

      {/* ── Upload form ── */}
      {showUploadForm && (
        <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden mb-6">
          <div className="flex items-center gap-2 px-5 sm:px-6 h-13 py-3.5 border-b border-[var(--border-subtle)]">
            <FileText size={15} className="text-[var(--accent-orange)]" />
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-5">
                {/* Left — details */}
                <div className="space-y-4">
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
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-muted)] mb-1.5"><FileText size={11} className="text-[var(--text-faint)]" /> Test PDF</label>
                    <div className="relative overflow-hidden rounded-[var(--radius)] border border-dashed border-[var(--border-active)] p-5 text-center bg-[var(--bg-elevated)] hover:border-[var(--accent-orange)]/50 transition-colors duration-150 cursor-pointer">
                      <input type="file" accept=".pdf,.docx" onChange={handleQuestionsFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                      <Upload size={18} className="mx-auto mb-1.5 text-[var(--text-faint)]" />
                      <p className="text-[12px] text-[var(--text-tertiary)] pointer-events-none truncate font-medium">
                        {file ? file.name : 'Drop or click to upload a PDF'}
                      </p>
                      <p className="text-[10.5px] text-[var(--text-faint)] pointer-events-none mt-0.5">Questions, answers &amp; explanations in one file</p>
                    </div>
                  </div>
                </div>

                {/* Right — schedule */}
                <div className="space-y-4">
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)]">Schedule</p>
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-muted)] mb-1.5"><Calendar size={11} className="text-[var(--text-faint)]" /> Exam Date</label>
                    <MiniCalendar month={calendarMonth} year={calendarYear} selected={examDate} onPrev={prevMonth} onNext={nextMonth} onPick={setExamDate} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <TimeField label="From" hour={startHour} minute={startMinute} ampm={startAmPm} onHour={setStartHour} onMinute={setStartMinute} onAmPm={setStartAmPm} />
                    <TimeField label="To" hour={endHour} minute={endMinute} ampm={endAmPm} onHour={setEndHour} onMinute={setEndMinute} onAmPm={setEndAmPm} />
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
            const schedule = fmtSchedule(test.examStart);
            return (
              <div key={test.id} className="group flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4 px-4 sm:px-5 py-4 border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-elevated)] transition-colors duration-150">
                {/* Identity */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="w-9 h-9 rounded-[8px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
                    <FileText size={15} className="text-[var(--text-tertiary)]" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[14px] font-semibold text-[var(--text-primary)] tracking-[-0.01em] truncate">{test.title}</h3>
                    <div className="flex items-center gap-x-3 gap-y-0.5 flex-wrap mt-0.5 text-[11.5px] text-[var(--text-faint)]">
                      <span className="flex items-center gap-1"><HelpCircle size={10} />{test.questionCount} questions</span>
                      {test.category && <span className="flex items-center gap-1"><Tag size={10} />{test.category}</span>}
                      {test.duration && <span className="flex items-center gap-1"><Clock size={10} />{test.duration} min</span>}
                      {schedule && <span className="flex items-center gap-1"><Calendar size={10} />{schedule}</span>}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                  <button
                    onClick={() => handleToggleApproval(test.id, test.approved)}
                    disabled={togglingId === test.id}
                    className={`inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-2.5 py-1.5 rounded-full transition-colors disabled:opacity-50 ${
                      test.approved
                        ? 'bg-[var(--status-success)]/10 text-[var(--status-success)] hover:bg-[var(--status-success)]/20'
                        : 'bg-[var(--bg-elevated)] text-[var(--text-faint)] hover:text-[var(--text-secondary)] border border-[var(--border-subtle)]'
                    }`}
                    title={test.approved ? 'Click to unapprove' : 'Click to approve'}
                  >
                    {test.approved ? <CheckCircle size={13} /> : <XCircle size={13} />}
                    {test.approved ? 'Approved' : 'Not approved'}
                  </button>
                  <Link href={`/uniadmin/tests/review/${test.id}`} className="btn-primary !rounded-[10px] text-[12px] !px-3.5 !py-1.5">Review</Link>
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => handleReassignTest(test.id, test.title)} disabled={reassigningId === test.id} className="p-2 rounded-full text-[var(--text-faint)] hover:text-[var(--type-event)] hover:bg-[var(--type-event)]/10 transition-colors disabled:opacity-50" title="Allow all students to reattempt">
                      <RefreshCw size={14} className={reassigningId === test.id ? 'animate-spin' : ''} />
                    </button>
                    <button onClick={() => openEdit(test)} className="p-2 rounded-full text-[var(--text-faint)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors" title="Edit schedule">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => copyLink(test.id)} className="p-2 rounded-full text-[var(--text-faint)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors" title="Copy student link">
                      {copiedId === test.id ? <Check size={14} className="text-[var(--status-success)]" /> : <Copy size={14} />}
                    </button>
                    <button onClick={() => handleDelete(test.id)} disabled={deletingId === test.id} className="p-2 rounded-full text-[var(--text-faint)] hover:text-[var(--status-danger)] hover:bg-[var(--status-danger)]/10 transition-colors disabled:opacity-50" title="Delete test">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Edit schedule modal ── */}
      {editingTest && (
        <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4" onClick={() => setEditingTest(null)}>
          <div className="w-full max-w-md rounded-[14px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 animate-fade-in overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-[var(--type-event)]" />
                <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Edit Exam Schedule</h2>
              </div>
              <button onClick={() => setEditingTest(null)} className="p-1.5 rounded-full text-[var(--text-faint)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-muted)] mb-1.5"><Clock size={11} className="text-[var(--text-faint)]" /> Duration (minutes)</label>
                <input type="number" min={5} max={300} value={editDuration} onChange={e => setEditDuration(Number(e.target.value))} className="w-full px-3.5 py-2.5 text-[13px]" />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-muted)] mb-1.5"><Calendar size={11} className="text-[var(--text-faint)]" /> Exam Date</label>
                <MiniCalendar month={editCalendarMonth} year={editCalendarYear} selected={editExamDate} onPrev={editPrevMonth} onNext={editNextMonth} onPick={setEditExamDate} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <TimeField label="From" hour={editStartHour} minute={editStartMinute} ampm={editStartAmPm} onHour={setEditStartHour} onMinute={setEditStartMinute} onAmPm={setEditStartAmPm} />
                <TimeField label="To" hour={editEndHour} minute={editEndMinute} ampm={editEndAmPm} onHour={setEditEndHour} onMinute={setEditEndMinute} onAmPm={setEditEndAmPm} />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={() => setEditingTest(null)} className="btn-secondary !rounded-[10px] flex-1 text-[12.5px]">Cancel</button>
              <button onClick={handleSaveEdit} disabled={saving || !editExamDate} className="btn-primary !rounded-[10px] flex-1 inline-flex items-center justify-center gap-1.5 text-[12.5px] disabled:opacity-50">
                <Save size={13} /> {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
