'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { addDoc, collection, doc, getDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { processTestDocument } from '@/app/actions/process-test';
import {
  Upload, FileText, Clock, Type, AlignLeft, Calendar,
  ChevronLeft, ChevronRight,
} from 'lucide-react';

export default function CreateTestPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [file, setFile] = useState<File | null>(null);
  const [universityId, setUniversityId] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(60);
  const [totalQuestions, setTotalQuestions] = useState(0);
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

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus({ type: '', message: '' });
      setCreatedTestId(null);
    }
  };

  const to24Hour = (h: number, ampm: 'AM' | 'PM') => {
    if (ampm === 'AM') return h === 12 ? 0 : h;
    return h === 12 ? 12 : h + 12;
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

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !user || !universityId || !examDate) return;

    setIsParsing(true);
    setStatus({ type: 'info', message: 'LlamaParse is reading and Groq is thinking...' });

    try {
      const formData = new FormData();
      formData.append('file', file);

      const examStart = buildISOString(examDate, startHour, startMinute, startAmPm);
      const examEnd = buildISOString(examDate, endHour, endMinute, endAmPm);

      const result = await processTestDocument(formData, user.uid, universityId, {
        title: title.trim(),
        description: description.trim(),
        duration,
        category: 'General',
        totalQuestions: totalQuestions || undefined,
        examStart,
        examEnd,
      });

      if (result.success) {
        setStatus({ type: 'success', message: 'Uploaded PDF successfully. Please approve the test before students can take it.' });
        setCreatedTestId(result.id || null);
      } else {
        setStatus({ type: 'error', message: result.error });
        setCreatedTestId(null);
      }
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setIsParsing(false);
    }
  };

  if (authLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="loading-dots"><span /><span /><span /></div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-[-0.02em]">AI Test Generator</h1>
        <p className="text-[var(--text-tertiary)] text-[13px] mt-1">Create tests using PDF upload</p>
      </div>

      <div id="generator" className="window p-6">
            {status.message && (
              <div className={`mb-4 p-3 rounded text-[13px] font-medium border ${
                status.type === 'error' ? 'bg-[#F54E00]/10 text-[#F54E00] border-[#F54E00]/20'
                : status.type === 'success' ? 'bg-[#4CAF50]/10 text-[#4CAF50] border-[#4CAF50]/20'
                : 'bg-[#5E6AD2]/10 text-[#5E6AD2] border-[#5E6AD2]/20'
              }`}>
                {status.message}
              </div>
            )}
            {status.type === 'success' && (
              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => router.push('/uniadmin/tests')}
                  className="btn-secondary text-[12px] px-3 py-1.5"
                >
                  Go to Manage Tests
                </button>
                {createdTestId && (
                  <button
                    type="button"
                    onClick={() => router.push(`/uniadmin/tests/review/${createdTestId}`)}
                    className="btn-primary text-[12px] px-3 py-1.5"
                  >
                    Open Review & Approve
                  </button>
                )}
              </div>
            )}
            <form onSubmit={handleGenerate} className="space-y-4">
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
                      <div key={`mock-empty-${i}`} />
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
                          key={`mock-${day}`}
                          type="button"
                          disabled={isPast}
                          onClick={() => setExamDate(date)}
                          className={`text-[12px] py-1.5 rounded transition-colors ${
                            isSelected
                              ? 'bg-[#5E6AD2] text-white font-semibold'
                              : isPast
                              ? 'text-[var(--text-faint)]/40 cursor-not-allowed'
                              : isToday
                              ? 'text-[#5E6AD2] font-semibold hover:bg-[#5E6AD2]/10'
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

          {/* Time Pickers — From / To */}
          <div className="grid grid-cols-2 gap-3">
            {/* From Time */}
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
                  <button type="button" onClick={() => setStartAmPm('AM')} className={`px-2 py-0.5 text-[11px] font-medium transition-colors ${startAmPm === 'AM' ? 'bg-[#5E6AD2] text-white' : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-surface)]'}`}>AM</button>
                  <button type="button" onClick={() => setStartAmPm('PM')} className={`px-2 py-0.5 text-[11px] font-medium transition-colors ${startAmPm === 'PM' ? 'bg-[#5E6AD2] text-white' : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-surface)]'}`}>PM</button>
                </div>
              </div>
            </div>
            {/* To Time */}
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
                  <button type="button" onClick={() => setEndAmPm('AM')} className={`px-2 py-0.5 text-[11px] font-medium transition-colors ${endAmPm === 'AM' ? 'bg-[#5E6AD2] text-white' : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-surface)]'}`}>AM</button>
                  <button type="button" onClick={() => setEndAmPm('PM')} className={`px-2 py-0.5 text-[11px] font-medium transition-colors ${endAmPm === 'PM' ? 'bg-[#5E6AD2] text-white' : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-surface)]'}`}>PM</button>
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="divider-dashed" />

          {/* File upload */}
          <div>
            <label className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
              <FileText size={12} className="text-[var(--text-faint)]" />
              Source PDF
            </label>
            <div className="relative overflow-hidden border border-dashed border-[var(--border-active)] rounded p-6 text-center bg-[var(--bg-elevated)] hover:border-[#F54E00]/40 transition-colors duration-150 cursor-pointer">
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <Upload size={18} className="mx-auto mb-1.5 text-[var(--text-faint)]" />
              <p className="text-[13px] text-[var(--text-tertiary)] pointer-events-none">
                {file ? file.name : 'Drop PDF or click to select'}
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={isParsing || !file || !universityId || !title.trim() || !examDate}
            className="btn-primary w-full"
          >
            {isParsing ? 'Processing...' : 'Generate & Save Test'}
          </button>
            </form>
      </div>
    </div>
  );
}
