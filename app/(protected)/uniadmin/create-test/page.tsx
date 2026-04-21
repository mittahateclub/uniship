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
  Tag, Pencil, X, Save, ChevronDown, ChevronUp, Copy, Check, RefreshCw,
} from 'lucide-react';

export default function TestsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Upload form state
  const [file, setFile] = useState<File | null>(null);
  const [answersFile, setAnswersFile] = useState<File | null>(null);
  const [universityId, setUniversityId] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(60);
  const [examDate, setExamDate] = useState<Date | null>(null);
  const [startHour, setStartHour] = useState(9);
  const [startMinute, setStartMinute] = useState(0);
  const [startAmPm, setStartAmPm] = useState<'AM' | 'PM'>('AM');
  const [endHour, setEndHour] = useState(10);
  const [endMinute, setEndMinute] = useState(0);
  const [endAmPm, setEndAmPm] = useState<'AM' | 'PM'>('AM');
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
  const [editStartAmPm, setEditStartAmPm] = useState<'AM' | 'PM'>('AM');
  const [editEndHour, setEditEndHour] = useState(10);
  const [editEndMinute, setEditEndMinute] = useState(0);
  const [editEndAmPm, setEditEndAmPm] = useState<'AM' | 'PM'>('PM');
  const [editCalendarMonth, setEditCalendarMonth] = useState(new Date().getMonth());
  const [editCalendarYear, setEditCalendarYear] = useState(new Date().getFullYear());
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [reassigningId, setReassigningId] = useState<string | null>(null);
  const [reassignedTitle, setReassignedTitle] = useState<string | null>(null);

  const copyLink = (testId: string) => {
    const link = `https://uniship-4c1a1.web.app/user/test-portal/${testId}`;
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

  const handleAnswersFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAnswersFile(e.target.files[0]);
      setStatus({ type: '', message: '' });
    }
  };

  const to24Hour = (h: number, ampm: 'AM' | 'PM') => {
    if (ampm === 'AM') return h === 12 ? 0 : h;
    return h === 12 ? 12 : h + 12;
  };

  const from24Hour = (h24: number): { hour: number; ampm: 'AM' | 'PM' } => {
    if (h24 === 0) return { hour: 12, ampm: 'AM' };
    if (h24 < 12) return { hour: h24, ampm: 'AM' };
    if (h24 === 12) return { hour: 12, ampm: 'PM' };
    return { hour: h24 - 12, ampm: 'PM' };
  };

  const buildISOString = (date: Date, hour: number, minute: number, ampm: 'AM' | 'PM') => {
    const d = new Date(date);
    d.setHours(to24Hour(hour, ampm), minute, 0, 0);
    return d.toISOString();
  };

  // Calendar helpers
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(calendarYear, calendarMonth, 1).getDay();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const prevMonth = () => {
    if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear(y => y - 1); }
    else setCalendarMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear(y => y + 1); }
    else setCalendarMonth(m => m + 1);
  };

  // Edit modal calendar helpers
  const editDaysInMonth = new Date(editCalendarYear, editCalendarMonth + 1, 0).getDate();
  const editFirstDayOfMonth = new Date(editCalendarYear, editCalendarMonth, 1).getDay();

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !universityId || !examDate || !file) return;

    setIsParsing(true);
    setStatus({ type: 'info', message: 'LlamaParse is reading and Groq is thinking...' });

    try {
      const examStart = buildISOString(examDate, startHour, startMinute, startAmPm);
      const examEnd = buildISOString(examDate, endHour, endMinute, endAmPm);

      const formData = new FormData();
      formData.append('file', file);
      if (answersFile) formData.append('answersFile', answersFile);

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

  if (authLoading || fetching) return (
    <div className="flex items-center justify-center h-64">
      <div className="loading-dots"><span /><span /><span /></div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      {/* Reassign success toast */}
      {reassignedTitle && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="flex items-center gap-3 bg-[var(--bg-primary)] border border-[#4CAF50]/40 rounded-lg shadow-lg px-5 py-3">
            <div className="w-7 h-7 rounded-full bg-[#4CAF50]/10 flex items-center justify-center shrink-0">
              <CheckCircle size={15} className="text-[#4CAF50]" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-[var(--text-primary)]">
                &quot;{reassignedTitle}&quot; reassigned
              </p>
              <p className="text-[11px] text-[var(--text-tertiary)]">All students can now reattempt this test</p>
            </div>
          </div>
        </div>
      )}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-[-0.02em]">Tests</h1>
          <p className="text-[var(--text-tertiary)] text-[13px] mt-1">{testUploads.length} test{testUploads.length !== 1 ? 's' : ''} available</p>
        </div>
        <button
          onClick={() => setShowUploadForm(!showUploadForm)}
          className="btn-primary flex items-center gap-1.5 text-[12px] px-4 py-2"
        >
          <Upload size={14} />
          {showUploadForm ? 'Hide' : 'Upload PDF'}
          {showUploadForm ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {/* Upload Form (collapsible) */}
      {showUploadForm && (
        <div className="window p-6 mb-6">
          {status.message && (
            <div className={`mb-4 p-3 rounded text-[13px] font-medium border ${
              status.type === 'error' ? 'bg-[#00A8E1]/10 text-[#00A8E1] border-[#00A8E1]/20'
              : status.type === 'success' ? 'bg-[#4CAF50]/10 text-[#4CAF50] border-[#4CAF50]/20'
              : 'bg-[#4B8BBE]/10 text-[#4B8BBE] border-[#4B8BBE]/20'
            }`}>
              {status.message}
            </div>
          )}
          {status.type === 'success' && createdTestId && (
            <div className="mb-4 space-y-2">
              <button
                type="button"
                onClick={() => router.push(`/uniadmin/tests/review/${createdTestId}`)}
                className="btn-primary text-[12px] px-3 py-1.5"
              >
                Open Review &amp; Approve
              </button>
              <div className="flex items-center gap-2 mt-2">
                <span className="flex-1 px-3 py-2 rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[12px] text-[var(--text-secondary)] font-mono truncate select-all">
                  {`https://uniship-4c1a1.web.app/user/test-portal/${createdTestId}`}
                </span>
                <button
                  type="button"
                  onClick={() => copyLink(createdTestId)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-active)] transition-colors shrink-0"
                >
                  {copiedId === createdTestId ? <Check size={13} className="text-[#4CAF50]" /> : <Copy size={13} />}
                  {copiedId === createdTestId ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleUpload} className="space-y-4">
            {/* Test Name + Duration */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                  <Type size={12} className="text-[var(--text-faint)]" />
                  Test Name
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                  placeholder="e.g. Midterm Mock Test"
                  className="w-full px-3 py-2 text-[13px] rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--border-active)] transition-colors"
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                  <Clock size={12} className="text-[var(--text-faint)]" />
                  Duration (min)
                </label>
                <input
                  type="number"
                  min={5}
                  max={300}
                  value={duration}
                  onChange={e => setDuration(Number(e.target.value))}
                  className="w-full px-3 py-2 text-[13px] rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-active)] transition-colors"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                <AlignLeft size={12} className="text-[var(--text-faint)]" />
                Description
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                placeholder="Short description of this test..."
                className="w-full px-3 py-2 text-[13px] rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--border-active)] transition-colors resize-none"
              />
            </div>

            {/* Calendar */}
            <div>
              <label className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                <Calendar size={12} className="text-[var(--text-faint)]" />
                Exam Date
              </label>
              <div className="border border-[var(--border-subtle)] rounded bg-[var(--bg-elevated)] p-3">
                <div className="flex items-center justify-between mb-2">
                  <button type="button" onClick={prevMonth} className="p-1 rounded hover:bg-[var(--bg-surface)] transition-colors">
                    <ChevronLeft size={14} className="text-[var(--text-secondary)]" />
                  </button>
                  <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                    {monthNames[calendarMonth]} {calendarYear}
                  </span>
                  <button type="button" onClick={nextMonth} className="p-1 rounded hover:bg-[var(--bg-surface)] transition-colors">
                    <ChevronRight size={14} className="text-[var(--text-secondary)]" />
                  </button>
                </div>
                <div className="grid grid-cols-7 mb-1">
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                    <div key={d} className="text-center text-[10px] font-medium text-[var(--text-faint)] py-1">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                    <div key={`empty-${i}`} />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const date = new Date(calendarYear, calendarMonth, day);
                    date.setHours(0, 0, 0, 0);
                    const isPast = date < today;
                    const isSelected = examDate && examDate.getTime() === date.getTime();
                    const isToday = date.getTime() === today.getTime();
                    return (
                      <button
                        key={day}
                        type="button"
                        disabled={isPast}
                        onClick={() => setExamDate(date)}
                        className={`text-[12px] py-1.5 rounded transition-colors ${
                          isSelected
                            ? 'bg-[#4B8BBE] text-white font-semibold'
                            : isPast
                            ? 'text-[var(--text-faint)]/40 cursor-not-allowed'
                            : isToday
                            ? 'text-[#4B8BBE] font-semibold hover:bg-[#4B8BBE]/10'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Time Pickers */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                  <Clock size={12} className="text-[var(--text-faint)]" />
                  From
                </label>
                <div className="flex items-center gap-1.5 border border-[var(--border-subtle)] rounded bg-[var(--bg-elevated)] p-2">
                  <select value={startHour} onChange={e => setStartHour(Number(e.target.value))} className="bg-transparent text-[13px] text-[var(--text-primary)] focus:outline-none appearance-none text-center w-10 cursor-pointer">
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                      <option key={h} value={h}>{String(h).padStart(2, '0')}</option>
                    ))}
                  </select>
                  <span className="text-[13px] text-[var(--text-faint)] font-bold">:</span>
                  <select value={startMinute} onChange={e => setStartMinute(Number(e.target.value))} className="bg-transparent text-[13px] text-[var(--text-primary)] focus:outline-none appearance-none text-center w-10 cursor-pointer">
                    {Array.from({ length: 12 }, (_, i) => i * 5).map(m => (
                      <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                    ))}
                  </select>
                  <div className="flex rounded overflow-hidden border border-[var(--border-subtle)] ml-auto">
                    <button type="button" onClick={() => setStartAmPm('AM')} className={`px-2 py-0.5 text-[11px] font-medium transition-colors ${startAmPm === 'AM' ? 'bg-[#4B8BBE] text-white' : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-surface)]'}`}>AM</button>
                    <button type="button" onClick={() => setStartAmPm('PM')} className={`px-2 py-0.5 text-[11px] font-medium transition-colors ${startAmPm === 'PM' ? 'bg-[#4B8BBE] text-white' : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-surface)]'}`}>PM</button>
                  </div>
                </div>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                  <Clock size={12} className="text-[var(--text-faint)]" />
                  To
                </label>
                <div className="flex items-center gap-1.5 border border-[var(--border-subtle)] rounded bg-[var(--bg-elevated)] p-2">
                  <select value={endHour} onChange={e => setEndHour(Number(e.target.value))} className="bg-transparent text-[13px] text-[var(--text-primary)] focus:outline-none appearance-none text-center w-10 cursor-pointer">
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                      <option key={h} value={h}>{String(h).padStart(2, '0')}</option>
                    ))}
                  </select>
                  <span className="text-[13px] text-[var(--text-faint)] font-bold">:</span>
                  <select value={endMinute} onChange={e => setEndMinute(Number(e.target.value))} className="bg-transparent text-[13px] text-[var(--text-primary)] focus:outline-none appearance-none text-center w-10 cursor-pointer">
                    {Array.from({ length: 12 }, (_, i) => i * 5).map(m => (
                      <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                    ))}
                  </select>
                  <div className="flex rounded overflow-hidden border border-[var(--border-subtle)] ml-auto">
                    <button type="button" onClick={() => setEndAmPm('AM')} className={`px-2 py-0.5 text-[11px] font-medium transition-colors ${endAmPm === 'AM' ? 'bg-[#4B8BBE] text-white' : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-surface)]'}`}>AM</button>
                    <button type="button" onClick={() => setEndAmPm('PM')} className={`px-2 py-0.5 text-[11px] font-medium transition-colors ${endAmPm === 'PM' ? 'bg-[#4B8BBE] text-white' : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-surface)]'}`}>PM</button>
                  </div>
                </div>
              </div>
            </div>

            <div className="divider-dashed" />

            {/* PDF Upload - Two columns */}
            <div className="grid grid-cols-2 gap-4">
              {/* Questions PDF */}
              <div>
                <label className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                  <FileText size={12} className="text-[var(--text-faint)]" />
                  Questions PDF
                </label>
                <div className="relative overflow-hidden border border-dashed border-[var(--border-active)] rounded p-4 text-center bg-[var(--bg-elevated)] hover:border-[#00A8E1]/40 transition-colors duration-150 cursor-pointer">
                  <input
                    type="file"
                    accept=".pdf,.docx"
                    onChange={handleQuestionsFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <Upload size={16} className="mx-auto mb-1 text-[var(--text-faint)]" />
                  <p className="text-[12px] text-[var(--text-tertiary)] pointer-events-none truncate">
                    {file ? file.name : 'Drop or click'}
                  </p>
                </div>
              </div>

              {/* Answers PDF */}
              <div>
                <label className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                  <FileText size={12} className="text-[var(--text-faint)]" />
                  Answers PDF <span className="text-[10px] text-[var(--text-faint)]">(optional)</span>
                </label>
                <div className="relative overflow-hidden border border-dashed border-[var(--border-active)] rounded p-4 text-center bg-[var(--bg-elevated)] hover:border-[#00A8E1]/40 transition-colors duration-150 cursor-pointer">
                  <input
                    type="file"
                    accept=".pdf,.docx"
                    onChange={handleAnswersFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <Upload size={16} className="mx-auto mb-1 text-[var(--text-faint)]" />
                  <p className="text-[12px] text-[var(--text-tertiary)] pointer-events-none truncate">
                    {answersFile ? answersFile.name : 'Drop or click'}
                  </p>
                </div>
              </div>
            </div>

            {/* Validation hints */}
            {!isParsing && (!universityId || !title.trim() || !examDate || !file) && (
              <p className="text-[12px] text-[var(--text-faint)]">
                Missing: {[
                  !universityId && 'University ID (profile issue)',
                  !title.trim() && 'Test Name',
                  !examDate && 'Exam Date',
                  !file && 'Questions PDF',
                ].filter(Boolean).join(', ')}
              </p>
            )}

            <button
              type="submit"
              disabled={isParsing || !universityId || !title.trim() || !examDate || !file}
              className="btn-primary w-full"
            >
              {isParsing ? 'Processing...' : 'Upload & Parse PDF'}
            </button>
          </form>
        </div>
      )}

      {/* Test List */}
      {testUploads.length === 0 ? (
        <div className="window p-12 text-center">
          <div className="divider-dashed mb-4" />
          <p className="text-[var(--text-muted)] text-[13px]">No tests yet. Click &quot;Upload PDF&quot; to create one.</p>
          <div className="divider-dashed mt-4" />
        </div>
      ) : (
        <div className="space-y-2">
          {testUploads.map((test) => (
            <div key={test.id} className="window px-5 py-4 flex items-center justify-between group hover:border-[var(--border-active)] transition-colors duration-150">
              <div className="flex items-center gap-3 min-w-0">
                <FileText size={16} className="text-[#00A8E1] shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-[14px] font-semibold text-[var(--text-primary)] truncate">{test.title}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-[var(--text-faint)]">{test.questionCount} Questions</span>
                    {test.category && (
                      <>
                        <span className="w-px h-3 bg-[var(--border-subtle)]" />
                        <span className="flex items-center gap-1 text-[11px] text-[var(--text-faint)]"><Tag size={9} />{test.category}</span>
                      </>
                    )}
                    {test.duration && (
                      <>
                        <span className="w-px h-3 bg-[var(--border-subtle)]" />
                        <span className="flex items-center gap-1 text-[11px] text-[var(--text-faint)]"><Clock size={9} />{test.duration}min</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleToggleApproval(test.id, test.approved)}
                  disabled={togglingId === test.id}
                  className={`flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                    test.approved
                      ? 'bg-[#4CAF50]/10 text-[#4CAF50] hover:bg-[#4CAF50]/20'
                      : 'bg-[var(--bg-elevated)] text-[var(--text-faint)] hover:text-[var(--text-secondary)] border border-[var(--border-subtle)]'
                  }`}
                  title={test.approved ? 'Click to unapprove' : 'Click to approve'}
                >
                  {test.approved ? <CheckCircle size={13} /> : <XCircle size={13} />}
                  {test.approved ? 'Approved' : 'Not Approved'}
                </button>
                <button
                  onClick={() => handleReassignTest(test.id, test.title)}
                  disabled={reassigningId === test.id}
                  className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 bg-[#4B8BBE]/10 text-[#4B8BBE] hover:bg-[#4B8BBE]/20"
                  title="Allow all students to reattempt this test"
                >
                  <RefreshCw size={13} className={reassigningId === test.id ? 'animate-spin' : ''} />
                  {reassigningId === test.id ? 'Reassigning...' : 'Reassign'}
                </button>
                <Link href={`/uniadmin/tests/review/${test.id}`} className="btn-primary text-[12px] px-4 py-1.5">Review</Link>
                <button
                  onClick={() => openEdit(test)}
                  className="p-2 rounded text-[var(--text-faint)] hover:text-[#4B8BBE] hover:bg-[#4B8BBE]/10 transition-colors duration-150"
                  title="Edit schedule"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => copyLink(test.id)}
                  className="p-2 rounded text-[var(--text-faint)] hover:text-[#4B8BBE] hover:bg-[#4B8BBE]/10 transition-colors duration-150"
                  title="Copy student link"
                >
                  {copiedId === test.id ? <Check size={14} className="text-[#4CAF50]" /> : <Copy size={14} />}
                </button>
                <button
                  onClick={() => handleDelete(test.id)}
                  disabled={deletingId === test.id}
                  className="p-2 rounded text-[var(--text-faint)] hover:text-[#00A8E1] hover:bg-[#00A8E1]/10 transition-colors duration-150 disabled:opacity-50"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Schedule Modal */}
      {editingTest && (
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4" onClick={() => setEditingTest(null)}>
          <div className="window w-full max-w-md p-6 animate-fade-in overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-[#4B8BBE]" />
                <h2 className="text-[15px] font-bold text-[var(--text-primary)]">Edit Exam Schedule</h2>
              </div>
              <button onClick={() => setEditingTest(null)} className="text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Duration */}
            <div className="mb-4">
              <label className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                <Clock size={12} className="text-[var(--text-faint)]" />
                Duration (min)
              </label>
              <input
                type="number"
                min={5}
                max={300}
                value={editDuration}
                onChange={e => setEditDuration(Number(e.target.value))}
                className="w-full px-3 py-2 text-[13px] rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-active)] transition-colors"
              />
            </div>

            {/* Calendar */}
            <div className="mb-4">
              <label className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                <Calendar size={12} className="text-[var(--text-faint)]" />
                Exam Date
              </label>
              <div className="border border-[var(--border-subtle)] rounded bg-[var(--bg-elevated)] p-3">
                <div className="flex items-center justify-between mb-2">
                  <button type="button" onClick={() => { if (editCalendarMonth === 0) { setEditCalendarMonth(11); setEditCalendarYear(y => y - 1); } else setEditCalendarMonth(m => m - 1); }} className="p-1 rounded hover:bg-[var(--bg-surface)] transition-colors">
                    <ChevronLeft size={14} className="text-[var(--text-secondary)]" />
                  </button>
                  <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                    {monthNames[editCalendarMonth]} {editCalendarYear}
                  </span>
                  <button type="button" onClick={() => { if (editCalendarMonth === 11) { setEditCalendarMonth(0); setEditCalendarYear(y => y + 1); } else setEditCalendarMonth(m => m + 1); }} className="p-1 rounded hover:bg-[var(--bg-surface)] transition-colors">
                    <ChevronRight size={14} className="text-[var(--text-secondary)]" />
                  </button>
                </div>
                <div className="grid grid-cols-7 mb-1">
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                    <div key={d} className="text-center text-[10px] font-medium text-[var(--text-faint)] py-1">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {Array.from({ length: editFirstDayOfMonth }).map((_, i) => <div key={`e-empty-${i}`} />)}
                  {Array.from({ length: editDaysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const date = new Date(editCalendarYear, editCalendarMonth, day);
                    date.setHours(0, 0, 0, 0);
                    const isPast = date < today;
                    const isSelected = editExamDate && editExamDate.getTime() === date.getTime();
                    const isToday = date.getTime() === today.getTime();
                    return (
                      <button
                        key={day}
                        type="button"
                        disabled={isPast}
                        onClick={() => setEditExamDate(date)}
                        className={`text-[12px] py-1.5 rounded transition-colors ${
                          isSelected ? 'bg-[#4B8BBE] text-white font-semibold'
                          : isPast ? 'text-[var(--text-faint)]/40 cursor-not-allowed'
                          : isToday ? 'text-[#4B8BBE] font-semibold hover:bg-[#4B8BBE]/10'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Time Pickers */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-[12px] font-medium text-[var(--text-secondary)] mb-1.5 block">From</label>
                <div className="flex items-center gap-1.5 border border-[var(--border-subtle)] rounded bg-[var(--bg-elevated)] p-2">
                  <select value={editStartHour} onChange={e => setEditStartHour(Number(e.target.value))} className="bg-transparent text-[13px] text-[var(--text-primary)] focus:outline-none appearance-none text-center w-10 cursor-pointer">
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}</option>)}
                  </select>
                  <span className="text-[13px] text-[var(--text-faint)] font-bold">:</span>
                  <select value={editStartMinute} onChange={e => setEditStartMinute(Number(e.target.value))} className="bg-transparent text-[13px] text-[var(--text-primary)] focus:outline-none appearance-none text-center w-10 cursor-pointer">
                    {Array.from({ length: 12 }, (_, i) => i * 5).map(m => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
                  </select>
                  <div className="flex rounded overflow-hidden border border-[var(--border-subtle)] ml-auto">
                    <button type="button" onClick={() => setEditStartAmPm('AM')} className={`px-2 py-0.5 text-[11px] font-medium transition-colors ${editStartAmPm === 'AM' ? 'bg-[#4B8BBE] text-white' : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-surface)]'}`}>AM</button>
                    <button type="button" onClick={() => setEditStartAmPm('PM')} className={`px-2 py-0.5 text-[11px] font-medium transition-colors ${editStartAmPm === 'PM' ? 'bg-[#4B8BBE] text-white' : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-surface)]'}`}>PM</button>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-[12px] font-medium text-[var(--text-secondary)] mb-1.5 block">To</label>
                <div className="flex items-center gap-1.5 border border-[var(--border-subtle)] rounded bg-[var(--bg-elevated)] p-2">
                  <select value={editEndHour} onChange={e => setEditEndHour(Number(e.target.value))} className="bg-transparent text-[13px] text-[var(--text-primary)] focus:outline-none appearance-none text-center w-10 cursor-pointer">
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}</option>)}
                  </select>
                  <span className="text-[13px] text-[var(--text-faint)] font-bold">:</span>
                  <select value={editEndMinute} onChange={e => setEditEndMinute(Number(e.target.value))} className="bg-transparent text-[13px] text-[var(--text-primary)] focus:outline-none appearance-none text-center w-10 cursor-pointer">
                    {Array.from({ length: 12 }, (_, i) => i * 5).map(m => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
                  </select>
                  <div className="flex rounded overflow-hidden border border-[var(--border-subtle)] ml-auto">
                    <button type="button" onClick={() => setEditEndAmPm('AM')} className={`px-2 py-0.5 text-[11px] font-medium transition-colors ${editEndAmPm === 'AM' ? 'bg-[#4B8BBE] text-white' : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-surface)]'}`}>AM</button>
                    <button type="button" onClick={() => setEditEndAmPm('PM')} className={`px-2 py-0.5 text-[11px] font-medium transition-colors ${editEndAmPm === 'PM' ? 'bg-[#4B8BBE] text-white' : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-surface)]'}`}>PM</button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setEditingTest(null)} className="btn-secondary flex-1 text-[12px]">Cancel</button>
              <button onClick={handleSaveEdit} disabled={saving || !editExamDate} className="btn-primary flex-1 flex items-center justify-center gap-1.5 text-[12px] disabled:opacity-50">
                <Save size={13} /> {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
