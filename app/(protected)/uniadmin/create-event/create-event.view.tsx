'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef, useMemo } from 'react';
import { collection, addDoc, serverTimestamp, doc, getDoc, getDocs, query, where, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ChevronLeft, ChevronRight, Calendar, Clock, Trash2, Pencil } from '@/components/icons';

interface ExistingEvent {
  id: string;
  title: string;
  type: string;
  date: any;
  location: string;
  description: string;
}

const TYPE_OPTIONS = [
  { value: 'event', label: 'Event' },
  { value: 'internship', label: 'Internship' },
  { value: 'hackathon', label: 'Hackathon' },
  { value: 'research', label: 'Research Opportunity' },
  { value: 'workshop', label: 'Workshop' },
];

const TYPE_COLORS: Record<string, string> = {
  event: 'bg-[#4B8BBE]/10 text-[#4B8BBE] border-[#4B8BBE]/20',
  internship: 'bg-[#00C16E]/10 text-[#00C16E] border-[#00C16E]/20',
  hackathon: 'bg-[#00A8E1]/10 text-[#00A8E1] border-[#00A8E1]/20',
  research: 'bg-[#F1A82C]/10 text-[#F1A82C] border-[#F1A82C]/20',
  workshop: 'bg-[#E04DB0]/10 text-[#E04DB0] border-[#E04DB0]/20',
};

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function DateTimePicker({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const [showCal, setShowCal] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const calRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLDivElement>(null);

  // Parse current value
  const parsed = value ? new Date(value) : null;
  const selectedYear = parsed?.getFullYear() ?? new Date().getFullYear();
  const selectedMonth = parsed?.getMonth() ?? new Date().getMonth();
  const selectedDay = parsed?.getDate() ?? 0;
  const selectedHour = parsed?.getHours() ?? 10;
  const selectedMinute = parsed?.getMinutes() ?? 0;

  const [viewMonth, setViewMonth] = useState(new Date(selectedYear, selectedMonth, 1));

  // Build calendar grid
  const weeks = useMemo(() => {
    const y = viewMonth.getFullYear(), m = viewMonth.getMonth();
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const daysInPrev = new Date(y, m, 0).getDate();
    const cells: { day: number; inMonth: boolean; date: Date }[] = [];
    for (let i = firstDay - 1; i >= 0; i--) cells.push({ day: daysInPrev - i, inMonth: false, date: new Date(y, m - 1, daysInPrev - i) });
    for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, inMonth: true, date: new Date(y, m, d) });
    const rem = 7 - (cells.length % 7); if (rem < 7) for (let d = 1; d <= rem; d++) cells.push({ day: d, inMonth: false, date: new Date(y, m + 1, d) });
    const w: typeof cells[] = []; for (let i = 0; i < cells.length; i += 7) w.push(cells.slice(i, i + 7));
    return w;
  }, [viewMonth]);

  const today = new Date();
  const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const setDate = (date: Date) => {
    const h = selectedHour, m = selectedMinute;
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m);
    const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    onChange(iso);
    setShowCal(false);
  };

  const setTime = (h: number, m: number) => {
    const y = parsed ? parsed.getFullYear() : today.getFullYear();
    const mo = parsed ? parsed.getMonth() : today.getMonth();
    const dy = parsed ? parsed.getDate() : today.getDate();
    const d = new Date(y, mo, dy, h, m);
    const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    onChange(iso);
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (calRef.current && !calRef.current.contains(e.target as Node)) setShowCal(false);
      if (timeRef.current && !timeRef.current.contains(e.target as Node)) setShowTime(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const displayDate = parsed
    ? `${MONTH_NAMES[parsed.getMonth()]} ${parsed.getDate()}, ${parsed.getFullYear()}`
    : 'Select date';

  const displayTime = parsed
    ? parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Select time';

  return (
    <div className="flex gap-2">
      {/* Date picker */}
      <div className="relative flex-1" ref={calRef}>
        <button
          type="button"
          onClick={() => { setShowCal(!showCal); setShowTime(false); }}
          className="w-full flex items-center gap-2 px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded text-[13px] text-left hover:border-[#4B8BBE] focus:border-[#4B8BBE] focus:outline-none transition-all duration-150"
        >
          <Calendar size={14} className="text-[var(--text-faint)] shrink-0" />
          <span className={parsed ? 'text-[var(--text-primary)]' : 'text-[var(--text-faint)]'}>{displayDate}</span>
        </button>

        {showCal && (
          <div className="absolute top-full left-0 mt-1.5 z-50 w-[280px] window p-3 shadow-lg animate-fade-in">
            {/* Month nav */}
            <div className="flex items-center justify-between mb-2">
              <button type="button" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))} className="p-1 rounded hover:bg-[var(--bg-elevated)] transition-colors">
                <ChevronLeft size={14} className="text-[var(--text-muted)]" />
              </button>
              <span className="text-[12px] font-semibold text-[var(--text-primary)]">
                {MONTH_NAMES[viewMonth.getMonth()]} {viewMonth.getFullYear()}
              </span>
              <button type="button" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))} className="p-1 rounded hover:bg-[var(--bg-elevated)] transition-colors">
                <ChevronRight size={14} className="text-[var(--text-muted)]" />
              </button>
            </div>
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAY_LABELS.map(d => (
                <div key={d} className="text-center text-[9px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)] py-1">{d}</div>
              ))}
            </div>
            {/* Days grid */}
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7">
                {week.map((cell, ci) => {
                  const isToday = sameDay(cell.date, today);
                  const isSelected = parsed && sameDay(cell.date, parsed);
                  return (
                    <button
                      key={ci}
                      type="button"
                      onClick={() => cell.inMonth && setDate(cell.date)}
                      className={`
                        w-full aspect-square flex items-center justify-center text-[11px] font-medium rounded-full transition-colors
                        ${!cell.inMonth ? 'text-[var(--text-faint)]/40 cursor-default' : 'hover:bg-[var(--bg-elevated)] cursor-pointer'}
                        ${isSelected ? 'bg-[#4B8BBE] text-white hover:bg-[#4B8BBE]' : ''}
                        ${isToday && !isSelected ? 'text-[#00A8E1] font-semibold' : cell.inMonth ? 'text-[var(--text-primary)]' : ''}
                      `}
                    >
                      {cell.day}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Time picker */}
      <div className="relative w-[130px]" ref={timeRef}>
        <button
          type="button"
          onClick={() => { setShowTime(!showTime); setShowCal(false); }}
          className="w-full flex items-center gap-2 px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded text-[13px] text-left hover:border-[#4B8BBE] focus:border-[#4B8BBE] focus:outline-none transition-all duration-150"
        >
          <Clock size={14} className="text-[var(--text-faint)] shrink-0" />
          <span className={parsed ? 'text-[var(--text-primary)]' : 'text-[var(--text-faint)]'}>{displayTime}</span>
        </button>

        {showTime && (
          <div className="absolute top-full right-0 mt-1.5 z-50 w-[200px] window p-3 shadow-lg animate-fade-in">
            <div className="flex gap-2">
              {/* Hours */}
              <div className="flex-1">
                <p className="text-[9px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)] mb-1.5 text-center">Hour</p>
                <div className="max-h-[180px] overflow-y-auto space-y-0.5 scrollbar-thin">
                  {Array.from({ length: 24 }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setTime(i, selectedMinute)}
                      className={`w-full py-1 text-[12px] font-medium rounded transition-colors ${
                        selectedHour === i ? 'bg-[#4B8BBE] text-white' : 'text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                      }`}
                    >
                      {String(i).padStart(2, '0')}
                    </button>
                  ))}
                </div>
              </div>
              {/* Minutes */}
              <div className="flex-1">
                <p className="text-[9px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)] mb-1.5 text-center">Min</p>
                <div className="max-h-[180px] overflow-y-auto space-y-0.5 scrollbar-thin">
                  {[0,5,10,15,20,25,30,35,40,45,50,55].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setTime(selectedHour, m)}
                      className={`w-full py-1 text-[12px] font-medium rounded transition-colors ${
                        selectedMinute === m ? 'bg-[#4B8BBE] text-white' : 'text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                      }`}
                    >
                      {String(m).padStart(2, '0')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CreateEventPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [adminUnivId, setAdminUnivId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '', description: '', date: '', location: '', type: 'event',
  });

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    async function getAdminProfile() {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) setAdminUnivId(userDoc.data().universityId);
      }
    }
    getAdminProfile();
  }, [user]);

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUnivId) { setMessage({ type: 'error', text: 'Profile error: University ID not found.' }); return; }
    setSubmitting(true);
    setMessage({ type: '', text: '' });
    try {
      const eventDate = new Date(formData.date);
      await addDoc(collection(db, 'events'), {
        title: formData.title,
        description: formData.description,
        date: Timestamp.fromDate(eventDate),
        location: formData.location,
        type: formData.type,
        universityId: adminUnivId,
        createdBy: user?.uid,
        createdAt: serverTimestamp(),
        attendees: [],
      });
      setMessage({ type: 'success', text: 'Event created successfully!' });
      setFormData({ title: '', description: '', date: '', location: '', type: 'event' });
      fetchEvents();
    } catch (error: any) {
      setMessage({ type: 'error', text: `Permission Denied: ${error.message}` });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="loading-dots"><span /><span /><span /></div>
    </div>
  );

  // ── Existing events management ──
  const [events, setEvents] = useState<ExistingEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState('');

  const fetchEvents = async () => {
    if (!adminUnivId) return;
    try {
      const snap = await getDocs(query(collection(db, 'events'), where('universityId', '==', adminUnivId)));
      const list: ExistingEvent[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as ExistingEvent));
      list.sort((a, b) => {
        const da = a.date?.toDate?.() || new Date(a.date);
        const db_ = b.date?.toDate?.() || new Date(b.date);
        return db_.getTime() - da.getTime();
      });
      setEvents(list);
    } catch (e) {
      console.error('Error fetching events:', e);
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => { if (adminUnivId) fetchEvents(); }, [adminUnivId]);

  const handleUpdateType = async (eventId: string, newType: string) => {
    try {
      await updateDoc(doc(db, 'events', eventId), { type: newType });
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, type: newType } : e));
      setEditingId(null);
    } catch (e) {
      console.error('Error updating type:', e);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!window.confirm('Delete this event?')) return;
    try {
      await deleteDoc(doc(db, 'events', eventId));
      setEvents(prev => prev.filter(e => e.id !== eventId));
    } catch (e) {
      console.error('Error deleting event:', e);
    }
  };

  const inputClass = "w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-faint)] text-[13px] focus:outline-none focus:border-[#4B8BBE] transition-all duration-150";

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--text-primary)] tracking-[-0.02em]">Manage Events</h1>
        <p className="text-[var(--text-tertiary)] text-[13px] mt-1">Create new events and manage existing ones</p>
      </div>

      <div className="window p-6">
        {message.text && (
          <div className={`mb-4 p-3 rounded text-[13px] font-medium border ${message.type === 'success' ? 'bg-[#4CAF50]/10 text-[#4CAF50] border-[#4CAF50]/20' : 'bg-[#00A8E1]/10 text-[#00A8E1] border-[#00A8E1]/20'}`}>
            {message.text}
          </div>
        )}

        <form id="form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.07em] mb-1.5">Event Title *</label>
            <input name="title" type="text" required placeholder="Event Title" value={formData.title} onChange={handleChange} className={inputClass} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.07em] mb-1.5">Type</label>
            <select name="type" value={formData.type} onChange={handleChange} className={inputClass}>
              <option value="event">Event</option>
              <option value="internship">Internship</option>
              <option value="hackathon">Hackathon</option>
              <option value="research">Research Opportunity</option>
              <option value="workshop">Workshop</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.07em] mb-1.5">Date & Time *</label>
            <DateTimePicker value={formData.date} onChange={(val) => setFormData({ ...formData, date: val })} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.07em] mb-1.5">Location *</label>
            <input name="location" type="text" required placeholder="Location" value={formData.location} onChange={handleChange} className={inputClass} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.07em] mb-1.5">Description *</label>
            <textarea name="description" required rows={4} placeholder="Description" value={formData.description} onChange={handleChange} className={inputClass + ' resize-none'} />
          </div>
          <button type="submit" disabled={submitting || !adminUnivId} className="btn-primary w-full mt-2">
            {submitting ? 'Posting...' : 'Post Event'}
          </button>
        </form>
      </div>

      {/* ── Existing Events ── */}
      <div className="mt-8 mb-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] tracking-[-0.02em] mb-1">Existing Events</h2>
        <p className="text-[var(--text-tertiary)] text-[12px] mb-4">Change the type or delete events. Changes are reflected in College Space immediately.</p>

        {loadingEvents ? (
          <div className="flex justify-center py-8"><div className="loading-dots"><span /><span /><span /></div></div>
        ) : events.length === 0 ? (
          <p className="text-[var(--text-faint)] text-[13px] text-center py-6">No events yet</p>
        ) : (
          <div className="space-y-2">
            {events.map(ev => {
              const d = ev.date?.toDate?.() || new Date(ev.date);
              const typeColor = TYPE_COLORS[ev.type] || TYPE_COLORS.event;
              const typeLabel = TYPE_OPTIONS.find(t => t.value === ev.type)?.label || ev.type || 'Event';

              return (
                <div key={ev.id} className="window p-4 flex items-center gap-3">
                  {/* Date */}
                  <div className="hidden sm:flex flex-col items-center min-w-[40px]">
                    <span className="text-[15px] font-semibold tabular-nums text-[var(--text-primary)] leading-none">{d.getDate()}</span>
                    <span className="text-[9px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)] mt-0.5">
                      {d.toLocaleString('default', { month: 'short' })}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{ev.title}</h3>
                    <p className="text-[11px] text-[var(--text-faint)] truncate">{ev.location}</p>
                  </div>

                  {/* Type badge / editor */}
                  {editingId === ev.id ? (
                    <select
                      value={editType}
                      onChange={e => handleUpdateType(ev.id, e.target.value)}
                      onBlur={() => setEditingId(null)}
                      autoFocus
                      className="px-2 py-1 text-[11px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[#4B8BBE]"
                    >
                      {TYPE_OPTIONS.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  ) : (
                    <button
                      onClick={() => { setEditingId(ev.id); setEditType(ev.type || 'event'); }}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded border uppercase tracking-wider cursor-pointer hover:opacity-80 ${typeColor}`}
                      title="Click to change type"
                    >
                      {typeLabel}
                      <Pencil size={9} />
                    </button>
                  )}

                  {/* Delete */}
                  <button
                    onClick={() => handleDeleteEvent(ev.id)}
                    className="p-1.5 rounded text-[var(--text-faint)] hover:text-[#00A8E1] hover:bg-[#00A8E1]/10 transition-colors"
                    title="Delete event"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}