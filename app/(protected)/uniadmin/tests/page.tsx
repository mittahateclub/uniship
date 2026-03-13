'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { FileText, Trash2, CheckCircle, XCircle, Clock, Tag, Pencil, X, Calendar, ChevronLeft, ChevronRight, Save } from 'lucide-react';

export default function ReviewTestsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [testUploads, setTestUploads] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [editingTest, setEditingTest] = useState<any | null>(null);
  const [editDuration, setEditDuration] = useState(60);
  const [examDate, setExamDate] = useState<Date | null>(null);
  const [startHour, setStartHour] = useState(9);
  const [startMinute, setStartMinute] = useState(0);
  const [startAmPm, setStartAmPm] = useState<'AM' | 'PM'>('AM');
  const [endHour, setEndHour] = useState(10);
  const [endMinute, setEndMinute] = useState(0);
  const [endAmPm, setEndAmPm] = useState<'AM' | 'PM'>('PM');
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [saving, setSaving] = useState(false);

  // Calendar helpers
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(calendarYear, calendarMonth, 1).getDay();
  const todayDate = new Date(); todayDate.setHours(0,0,0,0);
  const prevMonth = () => { if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear(y => y-1); } else setCalendarMonth(m => m-1); };
  const nextMonth = () => { if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear(y => y+1); } else setCalendarMonth(m => m+1); };
  const to24Hour = (h: number, ampm: 'AM' | 'PM') => ampm === 'AM' ? (h === 12 ? 0 : h) : (h === 12 ? 12 : h + 12);
  const from24Hour = (h24: number): { hour: number; ampm: 'AM' | 'PM' } => {
    if (h24 === 0) return { hour: 12, ampm: 'AM' };
    if (h24 < 12) return { hour: h24, ampm: 'AM' };
    if (h24 === 12) return { hour: 12, ampm: 'PM' };
    return { hour: h24 - 12, ampm: 'PM' };
  };

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

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
          return {
            id: d.id,
            ...data,
            title: data.title || data.sourceFileName || 'Untitled Test',
            approved: data.approved ?? false,
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

  const openEdit = (test: any) => {
    setEditingTest(test);
    setEditDuration(test.duration || 60);
    if (test.examStart) {
      const d = new Date(test.examStart);
      const day = new Date(d); day.setHours(0,0,0,0);
      setExamDate(day);
      setCalendarMonth(d.getMonth());
      setCalendarYear(d.getFullYear());
      const s = from24Hour(d.getHours());
      setStartHour(s.hour); setStartAmPm(s.ampm); setStartMinute(d.getMinutes());
    } else {
      setExamDate(null);
      setCalendarMonth(new Date().getMonth());
      setCalendarYear(new Date().getFullYear());
      setStartHour(9); setStartMinute(0); setStartAmPm('AM');
    }
    if (test.examEnd) {
      const d = new Date(test.examEnd);
      const e = from24Hour(d.getHours());
      setEndHour(e.hour); setEndAmPm(e.ampm); setEndMinute(d.getMinutes());
    } else {
      setEndHour(10); setEndMinute(0); setEndAmPm('AM');
    }
  };

  const handleSaveEdit = async () => {
    if (!editingTest || !examDate) return;
    setSaving(true);
    try {
      const buildISO = (date: Date, h: number, m: number, ampm: 'AM' | 'PM') => {
        const d = new Date(date);
        d.setHours(to24Hour(h, ampm), m, 0, 0);
        return d.toISOString();
      };
      const updates: Record<string, any> = {
        approved: false,
        duration: editDuration,
        examStart: buildISO(examDate, startHour, startMinute, startAmPm),
        examEnd: buildISO(examDate, endHour, endMinute, endAmPm),
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

  if (loading || fetching) return (
    <div className="flex items-center justify-center h-64">
      <div className="loading-dots"><span /><span /><span /></div>
    </div>
  );

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-[-0.02em]">Manage Tests</h1>
        <p className="text-[var(--text-tertiary)] text-[13px] mt-1">{testUploads.length} test{testUploads.length !== 1 ? 's' : ''} available</p>
      </div>

      {testUploads.length === 0 ? (
        <div className="window p-12 text-center">
          <div className="divider-dashed mb-4" />
          <p className="text-[var(--text-muted)] text-[13px]">No tests found. Generate one from the Create Test page.</p>
          <div className="divider-dashed mt-4" />
        </div>
      ) : (
        <div className="space-y-2">
          {testUploads.map((test) => (
            <div key={test.id} className="window px-5 py-4 flex items-center justify-between group hover:border-[var(--border-active)] transition-colors duration-150">
              <div className="flex items-center gap-3 min-w-0">
                <FileText size={16} className="text-[#F54E00] shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-[14px] font-semibold text-[var(--text-primary)] truncate">{test.title}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-[var(--text-faint)]">{test.problems?.length || 0} Problems</span>
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
                <Link href={`/uniadmin/tests/review/${test.id}`} className="btn-primary text-[12px] px-4 py-1.5">Review</Link>
                <button
                  onClick={() => openEdit(test)}
                  className="p-2 rounded text-[var(--text-faint)] hover:text-[#5E6AD2] hover:bg-[#5E6AD2]/10 transition-colors duration-150"
                  title="Edit schedule"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(test.id)}
                  disabled={deletingId === test.id}
                  className="p-2 rounded text-[var(--text-faint)] hover:text-[#F54E00] hover:bg-[#F54E00]/10 transition-colors duration-150 disabled:opacity-50"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editingTest && (
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4" onClick={() => setEditingTest(null)}>
          <div className="window w-full max-w-md p-6 animate-fade-in overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-[#5E6AD2]" />
                <h2 className="text-[15px] font-bold text-[var(--text-primary)]">Edit Exam Schedule</h2>
              </div>
              <button onClick={() => setEditingTest(null)} className="text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors">
                <X size={16} />
              </button>
            </div>

            <p className="text-[12px] text-[var(--text-tertiary)] mb-4 truncate">{editingTest.title}</p>

            {/* Duration */}
            <div className="mb-4">
              <label className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                <Clock size={12} className="text-[var(--text-faint)]" />
                Duration (minutes)
              </label>
              <input
                type="number" min="1"
                value={editDuration}
                onChange={e => setEditDuration(Number(e.target.value))}
                className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded px-3 py-2 text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[#5E6AD2] transition-colors"
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
                  <button type="button" onClick={prevMonth} className="p-1 rounded hover:bg-[var(--bg-surface)] transition-colors">
                    <ChevronLeft size={14} className="text-[var(--text-secondary)]" />
                  </button>
                  <span className="text-[13px] font-semibold text-[var(--text-primary)]">{monthNames[calendarMonth]} {calendarYear}</span>
                  <button type="button" onClick={nextMonth} className="p-1 rounded hover:bg-[var(--bg-surface)] transition-colors">
                    <ChevronRight size={14} className="text-[var(--text-secondary)]" />
                  </button>
                </div>
                <div className="grid grid-cols-7 mb-1">
                  {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                    <div key={d} className="text-center text-[10px] font-medium text-[var(--text-faint)] py-1">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {Array.from({ length: firstDayOfMonth }).map((_,i) => <div key={`e-${i}`} />)}
                  {Array.from({ length: daysInMonth }).map((_,i) => {
                    const day = i + 1;
                    const date = new Date(calendarYear, calendarMonth, day); date.setHours(0,0,0,0);
                    const isPast = date < todayDate;
                    const isSelected = examDate && examDate.getTime() === date.getTime();
                    const isToday = date.getTime() === todayDate.getTime();
                    return (
                      <button key={day} type="button" disabled={isPast} onClick={() => setExamDate(date)}
                        className={`text-[12px] py-1.5 rounded transition-colors ${
                          isSelected ? 'bg-[#5E6AD2] text-white font-semibold'
                          : isPast ? 'text-[var(--text-faint)]/40 cursor-not-allowed'
                          : isToday ? 'text-[#5E6AD2] font-semibold hover:bg-[#5E6AD2]/10'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
                        }`}>{day}</button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Time pickers */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                  <Clock size={12} className="text-[var(--text-faint)]" /> From
                </label>
                <div className="flex items-center gap-1.5 border border-[var(--border-subtle)] rounded bg-[var(--bg-elevated)] p-2">
                  <select value={startHour} onChange={e => setStartHour(Number(e.target.value))} className="bg-transparent text-[13px] text-[var(--text-primary)] focus:outline-none appearance-none text-center w-10 cursor-pointer">
                    {Array.from({length:12},(_,i)=>i+1).map(h=><option key={h} value={h}>{String(h).padStart(2,'0')}</option>)}
                  </select>
                  <span className="text-[13px] text-[var(--text-faint)] font-bold">:</span>
                  <select value={startMinute} onChange={e => setStartMinute(Number(e.target.value))} className="bg-transparent text-[13px] text-[var(--text-primary)] focus:outline-none appearance-none text-center w-10 cursor-pointer">
                    {Array.from({length:12},(_,i)=>i*5).map(m=><option key={m} value={m}>{String(m).padStart(2,'0')}</option>)}
                  </select>
                  <div className="flex rounded overflow-hidden border border-[var(--border-subtle)] ml-auto">
                    <button type="button" onClick={() => setStartAmPm('AM')} className={`px-2 py-0.5 text-[11px] font-medium transition-colors ${startAmPm==='AM' ? 'bg-[#5E6AD2] text-white' : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-surface)]'}`}>AM</button>
                    <button type="button" onClick={() => setStartAmPm('PM')} className={`px-2 py-0.5 text-[11px] font-medium transition-colors ${startAmPm==='PM' ? 'bg-[#5E6AD2] text-white' : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-surface)]'}`}>PM</button>
                  </div>
                </div>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                  <Clock size={12} className="text-[var(--text-faint)]" /> To
                </label>
                <div className="flex items-center gap-1.5 border border-[var(--border-subtle)] rounded bg-[var(--bg-elevated)] p-2">
                  <select value={endHour} onChange={e => setEndHour(Number(e.target.value))} className="bg-transparent text-[13px] text-[var(--text-primary)] focus:outline-none appearance-none text-center w-10 cursor-pointer">
                    {Array.from({length:12},(_,i)=>i+1).map(h=><option key={h} value={h}>{String(h).padStart(2,'0')}</option>)}
                  </select>
                  <span className="text-[13px] text-[var(--text-faint)] font-bold">:</span>
                  <select value={endMinute} onChange={e => setEndMinute(Number(e.target.value))} className="bg-transparent text-[13px] text-[var(--text-primary)] focus:outline-none appearance-none text-center w-10 cursor-pointer">
                    {Array.from({length:12},(_,i)=>i*5).map(m=><option key={m} value={m}>{String(m).padStart(2,'0')}</option>)}
                  </select>
                  <div className="flex rounded overflow-hidden border border-[var(--border-subtle)] ml-auto">
                    <button type="button" onClick={() => setEndAmPm('AM')} className={`px-2 py-0.5 text-[11px] font-medium transition-colors ${endAmPm==='AM' ? 'bg-[#5E6AD2] text-white' : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-surface)]'}`}>AM</button>
                    <button type="button" onClick={() => setEndAmPm('PM')} className={`px-2 py-0.5 text-[11px] font-medium transition-colors ${endAmPm==='PM' ? 'bg-[#5E6AD2] text-white' : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-surface)]'}`}>PM</button>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-[#F1A82C]/5 border border-[#F1A82C]/20 rounded-lg mb-4">
              <p className="text-[11px] text-[#F1A82C]">⚠ Saving will unapprove this test. Re-approve it after reviewing the changes.</p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setEditingTest(null)} className="btn-secondary flex-1 py-2.5 text-[13px]">Cancel</button>
              <button
                onClick={handleSaveEdit}
                disabled={saving || !examDate}
                className="btn-primary flex-1 py-2.5 text-[13px] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? <div className="loading-dots" style={{transform:'scale(0.5)'}}><span /><span /><span /></div> : <Save size={13} />}
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}