'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  collection, addDoc, serverTimestamp, doc, getDoc, getDocs, limit, query,
  where, updateDoc, deleteDoc, Timestamp, documentId, orderBy, startAfter,
  type DocumentData, type QueryDocumentSnapshot,
} from 'firebase/firestore';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import ChevronLeft from '@/components/icons/ChevronLeft';
import ChevronRight from '@/components/icons/ChevronRight';
import ChevronDown from '@/components/icons/ChevronDown';
import ChevronUp from '@/components/icons/ChevronUp';
import Calendar from '@/components/icons/Calendar';
import CalendarDays from '@/components/icons/CalendarDays';
import CalendarClock from '@/components/icons/CalendarClock';
import Clock from '@/components/icons/Clock';
import Trash2 from '@/components/icons/Trash2';
import Pencil from '@/components/icons/Pencil';
import Users from '@/components/icons/Users';
import X from '@/components/icons/X';
import Plus from '@/components/icons/Plus';
import Sparkles from '@/components/icons/Sparkles';
import CheckCircle2 from '@/components/icons/CheckCircle2';
import AlertCircle from '@/components/icons/AlertCircle';
import Loader2 from '@/components/icons/Loader2';
import MapPin from '@/components/icons/MapPin';
import { StatBar } from '@/components/StatBar';
import { kBranches, kGpaCutoffs } from '@/lib/college';
import { scrapeEvent } from '@/app/actions/scrape-event';

interface ExistingEvent {
  id: string;
  title: string;
  type: string;
  date: unknown;
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
  event: 'bg-[var(--type-event)]/10 text-[var(--type-event)] border-[var(--type-event)]/20',
  internship: 'bg-[var(--type-internship)]/10 text-[var(--type-internship)] border-[var(--type-internship)]/20',
  hackathon: 'bg-[var(--accent-orange)]/10 text-[var(--accent-orange)] border-[var(--accent-orange)]/20',
  research: 'bg-[var(--type-research)]/10 text-[var(--type-research)] border-[var(--type-research)]/20',
  workshop: 'bg-[var(--type-workshop)]/10 text-[var(--type-workshop)] border-[var(--type-workshop)]/20',
};

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa'];
const microLabel = 'text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)]';
const fieldLabel = 'block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.07em] mb-1.5';

function eventDate(value: unknown): Date {
  return (value as { toDate?: () => Date } | undefined)?.toDate?.()
    ?? new Date(value as string | number | Date);
}
const inputClass = 'w-full px-3.5 py-2.5 text-[13px] placeholder:text-[var(--text-faint)]';

function DateTimePicker({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const [showCal, setShowCal] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const calRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLDivElement>(null);

  const parsed = value ? new Date(value) : null;
  const selectedYear = parsed?.getFullYear() ?? new Date().getFullYear();
  const selectedMonth = parsed?.getMonth() ?? new Date().getMonth();
  const selectedHour = parsed?.getHours() ?? 10;
  const selectedMinute = parsed?.getMinutes() ?? 0;

  const [viewMonth, setViewMonth] = useState(new Date(selectedYear, selectedMonth, 1));

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

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (calRef.current && !calRef.current.contains(e.target as Node)) setShowCal(false);
      if (timeRef.current && !timeRef.current.contains(e.target as Node)) setShowTime(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const displayDate = parsed ? `${MONTH_NAMES[parsed.getMonth()]} ${parsed.getDate()}, ${parsed.getFullYear()}` : 'Select date';
  const displayTime = parsed ? parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Select time';
  const triggerClass = 'w-full flex items-center gap-2 px-3.5 py-2.5 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-[var(--radius)] text-[13px] text-left hover:border-[var(--border-active)] focus:border-[var(--border-active)] focus:outline-none transition-colors duration-150';

  return (
    <div className="flex gap-2">
      <div className="relative flex-1" ref={calRef}>
        <button type="button" onClick={() => { setShowCal(!showCal); setShowTime(false); }} className={triggerClass}>
          <Calendar size={14} className="text-[var(--text-faint)] shrink-0" />
          <span className={parsed ? 'text-[var(--text-primary)]' : 'text-[var(--text-faint)]'}>{displayDate}</span>
        </button>
        {showCal && (
          <div className="absolute top-full left-0 mt-1.5 z-50 w-[280px] window p-3 shadow-lg animate-fade-in">
            <div className="flex items-center justify-between mb-2">
              <button type="button" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))} className="p-1 rounded-full hover:bg-[var(--bg-elevated)] transition-colors">
                <ChevronLeft size={14} className="text-[var(--text-muted)]" />
              </button>
              <span className="text-[12px] font-semibold text-[var(--text-primary)]">{MONTH_NAMES[viewMonth.getMonth()]} {viewMonth.getFullYear()}</span>
              <button type="button" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))} className="p-1 rounded-full hover:bg-[var(--bg-elevated)] transition-colors">
                <ChevronRight size={14} className="text-[var(--text-muted)]" />
              </button>
            </div>
            <div className="grid grid-cols-7 mb-1">
              {DAY_LABELS.map(d => (
                <div key={d} className="text-center text-[9px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)] py-1">{d}</div>
              ))}
            </div>
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
                      className={`w-full aspect-square flex items-center justify-center text-[11px] font-medium rounded-full transition-colors
                        ${!cell.inMonth ? 'text-[var(--text-faint)]/40 cursor-default' : 'hover:bg-[var(--bg-elevated)] cursor-pointer'}
                        ${isSelected ? 'bg-[var(--type-event)] text-white hover:bg-[var(--type-event)]' : ''}
                        ${isToday && !isSelected ? 'text-[var(--accent-orange)] font-semibold' : cell.inMonth ? 'text-[var(--text-primary)]' : ''}`}
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

      <div className="relative w-[130px]" ref={timeRef}>
        <button type="button" onClick={() => { setShowTime(!showTime); setShowCal(false); }} className={triggerClass}>
          <Clock size={14} className="text-[var(--text-faint)] shrink-0" />
          <span className={parsed ? 'text-[var(--text-primary)]' : 'text-[var(--text-faint)]'}>{displayTime}</span>
        </button>
        {showTime && (
          <div className="absolute top-full right-0 mt-1.5 z-50 w-[200px] window p-3 shadow-lg animate-fade-in">
            <div className="flex gap-2">
              <div className="flex-1">
                <p className="text-[9px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)] mb-1.5 text-center">Hour</p>
                <div className="max-h-[180px] overflow-y-auto space-y-0.5 scrollbar-thin">
                  {Array.from({ length: 24 }, (_, i) => (
                    <button key={i} type="button" onClick={() => setTime(i, selectedMinute)} className={`w-full py-1 text-[12px] font-medium rounded-[8px] transition-colors ${selectedHour === i ? 'bg-[var(--type-event)] text-white' : 'text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'}`}>
                      {String(i).padStart(2, '0')}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1">
                <p className="text-[9px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)] mb-1.5 text-center">Min</p>
                <div className="max-h-[180px] overflow-y-auto space-y-0.5 scrollbar-thin">
                  {[0,5,10,15,20,25,30,35,40,45,50,55].map(m => (
                    <button key={m} type="button" onClick={() => setTime(selectedHour, m)} className={`w-full py-1 text-[12px] font-medium rounded-[8px] transition-colors ${selectedMinute === m ? 'bg-[var(--type-event)] text-white' : 'text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'}`}>
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
    title: '', description: '', date: '', location: '', type: 'event', company: '', link: '', expiry: '',
  });
  const [targetBranches, setTargetBranches] = useState<Set<string>>(new Set());
  const [minGpa, setMinGpa] = useState<number | null>(null);
  const [scrapedImageUrl, setScrapedImageUrl] = useState<string | null>(null);
  const [scraping, setScraping] = useState(false);
  const [scrapeNote, setScrapeNote] = useState<string | null>(null);
  const [scrapeError, setScrapeError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showForm, setShowForm] = useState(true);

  // Existing events
  const [events, setEvents] = useState<ExistingEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [lastEventDoc, setLastEventDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMoreEvents, setHasMoreEvents] = useState(false);
  const [loadingMoreEvents, setLoadingMoreEvents] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState('');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(clock);
  }, []);

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

  const fetchEvents = useCallback(async () => {
    if (!adminUnivId) return;
    try {
      const snap = await getDocs(query(
        collection(db, 'events'),
        where('universityId', '==', adminUnivId),
        orderBy(documentId()),
        limit(50),
      ));
      const list: ExistingEvent[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as ExistingEvent));
      list.sort((a, b) => {
        const da = eventDate(a.date);
        const db_ = eventDate(b.date);
        return db_.getTime() - da.getTime();
      });
      setEvents(list);
      setLastEventDoc(snap.docs.at(-1) ?? null);
      setHasMoreEvents(snap.size === 50);
    } catch (e) {
      console.error('Error fetching events:', e);
    } finally {
      setLoadingEvents(false);
    }
  }, [adminUnivId]);

  const loadMoreEvents = async () => {
    if (!adminUnivId || !lastEventDoc || loadingMoreEvents) return;
    setLoadingMoreEvents(true);
    try {
      const snapshot = await getDocs(query(
        collection(db, 'events'),
        where('universityId', '==', adminUnivId),
        orderBy(documentId()),
        startAfter(lastEventDoc),
        limit(50),
      ));
      const next = snapshot.docs.map((eventDoc) => ({ id: eventDoc.id, ...eventDoc.data() } as ExistingEvent));
      setEvents((previous) => [...previous, ...next].sort((a, b) => eventDate(b.date).getTime() - eventDate(a.date).getTime()));
      setLastEventDoc(snapshot.docs.at(-1) ?? lastEventDoc);
      setHasMoreEvents(snapshot.size === 50);
    } finally {
      setLoadingMoreEvents(false);
    }
  };

  useEffect(() => {
    if (!adminUnivId) return;
    const start = window.setTimeout(() => void fetchEvents(), 0);
    return () => window.clearTimeout(start);
  }, [adminUnivId, fetchEvents]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleScrape = async () => {
    if (!formData.link.trim()) { setScrapeNote('Enter a link first.'); setScrapeError(true); return; }
    setScraping(true);
    setScrapeNote(null);
    setScrapeError(false);
    try {
      const r = await scrapeEvent(formData.link);
      if (!r.ok) { setScrapeNote(r.error ?? 'Could not read the page.'); setScrapeError(true); return; }
      setFormData((prev) => ({
        ...prev,
        title: r.title ?? prev.title,
        company: r.company ?? prev.company,
        description: r.description ?? prev.description,
        location: r.location ?? prev.location,
        type: r.type ?? prev.type,
        expiry: r.deadline ? `${r.deadline}T10:00` : prev.expiry,
      }));
      setScrapedImageUrl(r.imageUrl ?? null);
      setScrapeNote(r.note ?? 'Details filled — review below.');
      setScrapeError(false);
    } catch {
      setScrapeNote('Something went wrong while reading the link.');
      setScrapeError(true);
    } finally {
      setScraping(false);
    }
  };

  const clearImage = () => setScrapedImageUrl(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUnivId) { setMessage({ type: 'error', text: 'Profile error: University ID not found.' }); return; }
    setSubmitting(true);
    setMessage({ type: '', text: '' });
    try {
      const eventDate = new Date(formData.date);
      await addDoc(collection(db, 'events'), {
        title: formData.title,
        company: formData.company.trim() || null,
        description: formData.description,
        date: Timestamp.fromDate(eventDate),
        location: formData.location,
        type: formData.type,
        universityId: adminUnivId,
        createdBy: user?.uid,
        createdAt: serverTimestamp(),
        attendees: [],
        link: formData.link.trim() || null,
        imageUrl: scrapedImageUrl,
        expiresAt: formData.expiry ? Timestamp.fromDate(new Date(formData.expiry)) : null,
        targetBranches: targetBranches.size === 0 ? ['all'] : Array.from(targetBranches),
        minGpa,
      });
      setMessage({ type: 'success', text: 'Event created successfully!' });
      setFormData({ title: '', description: '', date: '', location: '', type: 'event', company: '', link: '', expiry: '' });
      setTargetBranches(new Set());
      setMinGpa(null);
      setScrapedImageUrl(null);
      setScrapeNote(null);
      fetchEvents();
    } catch (error) {
      setMessage({ type: 'error', text: `Permission Denied: ${error instanceof Error ? error.message : 'Unknown error'}` });
    } finally {
      setSubmitting(false);
    }
  };

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

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="loading-dots"><span /><span /><span /></div>
    </div>
  );

  const tsOf = (ev: ExistingEvent) => eventDate(ev.date).getTime();
  const upcomingCount = events.filter(e => tsOf(e) >= now).length;

  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in">
      {/* Header */}
      <div className="pt-8 mb-7 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-semibold text-[var(--text-primary)] tracking-[-0.025em]">Events</h1>
          <p className="text-[var(--text-tertiary)] text-[13.5px] mt-1.5">Post opportunities to College Space and manage what students see.</p>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="btn-primary flex items-center gap-1.5 text-[12.5px] !px-3.5 !py-2">
          <Plus size={14} /> {showForm ? 'Hide form' : 'New Event'} {showForm ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {/* Overview — slim inline summary */}
      <StatBar
        className="mb-6"
        items={[
          { label: 'events', value: events.length, icon: CalendarDays },
          { label: 'upcoming', value: upcomingCount, icon: CalendarClock },
          { label: 'past', value: events.length - upcomingCount, icon: Clock },
        ]}
      />

      {/* New event form */}
      {showForm && (
        <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 sm:p-6 mb-7">
          {message.text && (
            <div className={`mb-5 p-3 rounded-[var(--radius)] text-[13px] font-medium border ${message.type === 'success' ? 'bg-[var(--status-success)]/10 text-[var(--status-success)] border-[var(--status-success)]/20' : 'bg-[var(--status-danger)]/10 text-[var(--status-danger)] border-[var(--status-danger)]/20'}`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Details */}
            <p className={`${microLabel} mb-3`}>Details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              <div className="sm:col-span-2">
                <label className={fieldLabel}>Event Title *</label>
                <input name="title" type="text" required placeholder="Event title" value={formData.title} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={fieldLabel}>Company / Organizer</label>
                <input name="company" type="text" placeholder="e.g. Google, IEEE chapter…" value={formData.company} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={fieldLabel}>Type</label>
                <select name="type" value={formData.type} onChange={handleChange} className={inputClass}>
                  {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={fieldLabel}>Apply / Event Link</label>
                <div className="flex gap-2">
                  <input name="link" type="url" placeholder="https://company.com/careers/role (leave blank for in-app apply)" value={formData.link} onChange={handleChange} className={inputClass} />
                  <button type="button" onClick={handleScrape} disabled={scraping} className="btn-secondary shrink-0 inline-flex items-center gap-1.5 text-[12px] !px-3 disabled:opacity-60">
                    {scraping ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    <span className="hidden sm:inline">{scraping ? 'Reading…' : 'Auto-fill'}</span>
                  </button>
                </div>
                {scrapeNote && (
                  <div className={`mt-2 flex items-start gap-2 px-3 py-2 rounded-[var(--radius)] text-[11.5px] font-medium border ${scrapeError ? 'bg-[var(--status-danger)]/10 text-[var(--status-danger)] border-[var(--status-danger)]/30' : 'bg-[var(--status-success)]/10 text-[var(--status-success)] border-[var(--status-success)]/30'}`}>
                    {scrapeError ? <AlertCircle size={13} className="mt-px shrink-0" /> : <CheckCircle2 size={13} className="mt-px shrink-0" />}
                    <span>{scrapeNote}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Schedule & location */}
            <div className="mt-6 pt-6 border-t border-[var(--border-subtle)]">
              <p className={`${microLabel} mb-3`}>Schedule &amp; location</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <label className={fieldLabel}>Date &amp; Time *</label>
                  <DateTimePicker value={formData.date} onChange={(val) => setFormData({ ...formData, date: val })} />
                </div>
                <div>
                  <label className={fieldLabel}>Apply By / Expiry</label>
                  <DateTimePicker value={formData.expiry} onChange={(val) => setFormData({ ...formData, expiry: val })} />
                  <p className="text-[10.5px] text-[var(--text-faint)] mt-1">Listing hides after this date. Defaults to the event date.</p>
                </div>
                <div className="sm:col-span-2">
                  <label className={fieldLabel}>Location *</label>
                  <input name="location" type="text" required placeholder="Location" value={formData.location} onChange={handleChange} className={inputClass} />
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="mt-6 pt-6 border-t border-[var(--border-subtle)]">
              <p className={`${microLabel} mb-3`}>Description</p>
              <textarea name="description" required rows={4} placeholder="What is this opportunity about?" value={formData.description} onChange={handleChange} className={`${inputClass} resize-none`} />
              {scrapedImageUrl && (
                <div className="mt-4">
                  <label className={fieldLabel}>Post Image</label>
                  <div className="relative rounded-[var(--radius)] overflow-hidden border border-[var(--border-subtle)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={scrapedImageUrl} alt="Event preview" className="w-full max-h-[220px] object-cover" onError={() => setScrapedImageUrl(null)} />
                    <button type="button" onClick={clearImage} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/55 text-white flex items-center justify-center hover:bg-black/75 transition-colors" title="Remove image">
                      <X size={15} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Audience */}
            <div className="mt-6 pt-6 border-t border-[var(--border-subtle)]">
              <p className={`${microLabel} mb-3`}>Audience</p>
              <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-2">Send to branches</label>
              <div className="flex flex-wrap gap-1.5 mb-4">
                <button type="button" onClick={() => setTargetBranches(new Set())} className={`px-2.5 py-1 text-[11.5px] font-semibold rounded-full border transition-colors ${targetBranches.size === 0 ? 'bg-[var(--accent-orange)]/15 text-[var(--accent-orange)] border-[var(--accent-orange)]/40' : 'text-[var(--text-muted)] border-[var(--border-subtle)] hover:border-[var(--border-active)]'}`}>
                  All students
                </button>
                {kBranches.map((b) => {
                  const on = targetBranches.has(b);
                  return (
                    <button key={b} type="button" onClick={() => setTargetBranches((prev) => { const s = new Set(prev); if (s.has(b)) s.delete(b); else s.add(b); return s; })} className={`px-2.5 py-1 text-[11.5px] font-semibold rounded-full border transition-colors ${on ? 'bg-[var(--accent-orange)]/15 text-[var(--accent-orange)] border-[var(--accent-orange)]/40' : 'text-[var(--text-muted)] border-[var(--border-subtle)] hover:border-[var(--border-active)]'}`}>
                      {b}
                    </button>
                  );
                })}
              </div>
              <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1.5">Minimum CGPA</label>
              <select value={minGpa ?? ''} onChange={(e) => setMinGpa(e.target.value === '' ? null : parseFloat(e.target.value))} className={`${inputClass} sm:max-w-xs`}>
                <option value="">All students (no cutoff)</option>
                {kGpaCutoffs.map((g) => <option key={g} value={g}>{g} and above</option>)}
              </select>
            </div>

            <button type="submit" disabled={submitting || !adminUnivId} className="btn-primary w-full mt-6">
              {submitting ? 'Posting…' : 'Post Event'}
            </button>
          </form>
        </div>
      )}

      {/* Existing events */}
      <div className="flex items-baseline justify-between mb-3">
        <h2 className={microLabel}>All events</h2>
        <span className="text-[11.5px] text-[var(--text-faint)]">{events.length} live</span>
      </div>

      {loadingEvents ? (
        <div className="flex justify-center py-10"><div className="loading-dots"><span /><span /><span /></div></div>
      ) : events.length === 0 ? (
        <div className="text-center py-16 border border-[var(--border-subtle)] rounded-[var(--radius)] bg-[var(--bg-surface)]">
          <Calendar size={24} className="mx-auto text-[var(--text-faint)] mb-3" />
          <p className="text-[var(--text-primary)] text-[13px] font-medium">No events yet</p>
          <p className="text-[var(--text-faint)] text-[12px] mt-1">Post your first event with the form above.</p>
        </div>
      ) : (
        <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
          {events.map(ev => {
            const d = eventDate(ev.date);
            const typeColor = TYPE_COLORS[ev.type] || TYPE_COLORS.event;
            const typeLabel = TYPE_OPTIONS.find(t => t.value === ev.type)?.label || ev.type || 'Event';
            const isPast = d.getTime() < now;
            return (
              <div key={ev.id} className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-elevated)] transition-colors duration-150">
                {/* Date block */}
                <div className={`flex flex-col items-center justify-center w-11 h-11 rounded-[8px] border border-[var(--border-subtle)] shrink-0 ${isPast ? 'opacity-55' : ''}`}>
                  <span className="text-[15px] font-semibold tabular-nums text-[var(--text-primary)] leading-none">{d.getDate()}</span>
                  <span className="text-[8.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)] mt-0.5">{d.toLocaleString('default', { month: 'short' })}</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-[13.5px] font-semibold text-[var(--text-primary)] truncate">{ev.title}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-[var(--text-faint)] truncate">
                    <MapPin size={10} className="shrink-0" />
                    <span className="truncate">{ev.location || '—'}</span>
                  </div>
                </div>

                {/* Type pill / editor */}
                {editingId === ev.id ? (
                  <select value={editType} onChange={e => handleUpdateType(ev.id, e.target.value)} onBlur={() => setEditingId(null)} autoFocus className="!w-auto px-2 py-1 text-[11px]">
                    {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                ) : (
                  <button onClick={() => { setEditingId(ev.id); setEditType(ev.type || 'event'); }} className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-semibold rounded-full border uppercase tracking-[0.07em] cursor-pointer hover:opacity-80 transition-opacity ${typeColor}`} title="Click to change type">
                    {typeLabel}
                    <Pencil size={9} />
                  </button>
                )}

                {/* Actions */}
                <Link href={`/uniadmin/events/${ev.id}/applicants`} className="p-2 rounded-full text-[var(--text-faint)] hover:text-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/10 transition-colors" title="View applicants">
                  <Users size={14} />
                </Link>
                <button onClick={() => handleDeleteEvent(ev.id)} className="p-2 rounded-full text-[var(--text-faint)] hover:text-[var(--status-danger)] hover:bg-[var(--status-danger)]/10 transition-colors" title="Delete event">
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
          {hasMoreEvents && (
            <div className="flex justify-center p-3 border-t border-[var(--border-subtle)]">
              <button type="button" onClick={loadMoreEvents} disabled={loadingMoreEvents} className="btn-secondary !rounded-[10px] text-[12px] disabled:opacity-50">
                {loadingMoreEvents ? 'Loading…' : 'Load more events'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
