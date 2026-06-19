'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, getDocs, limit, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Calendar from '@/components/icons/Calendar';
import MapPin from '@/components/icons/MapPin';
import Clock from '@/components/icons/Clock';
import ChevronLeft from '@/components/icons/ChevronLeft';
import ChevronRight from '@/components/icons/ChevronRight';
import Briefcase from '@/components/icons/Briefcase';
import X from '@/components/icons/X';
import { CalendarSkeleton } from '@/components/Skeleton';

interface CalendarEvent {
  id: string;
  title: string;
  date: unknown;
  type: string;
  description: string;
  location?: string;
  company?: string;
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function toDate(d: unknown): Date | null {
  if (!d) return null;
  if (typeof (d as { toDate?: unknown }).toDate === 'function') return (d as { toDate: () => Date }).toDate();
  if (d instanceof Date) return d;
  return new Date(d as string | number);
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

const TYPE_CONFIG: Record<string, { dot: string; chip: string; label: string; text: string }> = {
  event:      { dot: 'bg-[var(--type-event)]',      chip: 'bg-[var(--type-event)]/12 text-[var(--type-event)]',           label: 'Event',      text: 'var(--type-event)' },
  internship: { dot: 'bg-[var(--type-internship)]', chip: 'bg-[var(--type-internship)]/12 text-[var(--type-internship)]', label: 'Internship', text: 'var(--type-internship)' },
  hackathon:  { dot: 'bg-[var(--type-hackathon)]',  chip: 'bg-[var(--type-hackathon)]/12 text-[var(--type-hackathon)]',   label: 'Hackathon',  text: 'var(--type-hackathon)' },
  research:   { dot: 'bg-[var(--type-research)]',   chip: 'bg-[var(--type-research)]/12 text-[var(--type-research)]',     label: 'Research',   text: 'var(--type-research)' },
  workshop:   { dot: 'bg-[var(--type-workshop)]',   chip: 'bg-[var(--type-workshop)]/12 text-[var(--type-workshop)]',     label: 'Workshop',   text: 'var(--type-workshop)' },
};

export default function CalendarPage() {
  const { user, loading: authLoading } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    async function fetchAll() {
      if (!user) return;
      try {
        const savedSnap = await getDocs(
          query(collection(db, 'savedEvents'), where('userId', '==', user.uid), limit(500))
        );

        const calEvents: CalendarEvent[] = savedSnap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            title: data.title,
            date: data.date,
            type: data.type || 'event',
            description: data.description || '',
            location: data.location || undefined,
            company: data.companyName || undefined,
          };
        });

        setEvents(calEvents);
      } catch (error) {
        console.error('Error fetching calendar data:', error);
      } finally {
        setLoading(false);
      }
    }
    if (!authLoading) fetchAll();
  }, [user, authLoading]);

  // Build calendar grid
  const { weeks, eventsInMonth } = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells: { day: number; inMonth: boolean; date: Date }[] = [];
    // Leading days from previous month
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      cells.push({ day: d, inMonth: false, date: new Date(year, month - 1, d) });
    }
    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, inMonth: true, date: new Date(year, month, d) });
    }
    // Trailing days
    const remaining = 7 - (cells.length % 7);
    if (remaining < 7) {
      for (let d = 1; d <= remaining; d++) {
        cells.push({ day: d, inMonth: false, date: new Date(year, month + 1, d) });
      }
    }

    const weeks: typeof cells[] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

    const eventsInMonth = events.filter(e => {
      const d = toDate(e.date);
      return d && d.getMonth() === month && d.getFullYear() === year;
    });

    return { weeks, eventsInMonth };
  }, [currentMonth, events]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const date = toDate(event.date);
      if (!date) continue;
      const key = dateKey(date);
      const list = map.get(key);
      if (list) list.push(event);
      else map.set(key, [event]);
    }
    return map;
  }, [events]);

  const getEventsForDate = (date: Date) => eventsByDate.get(dateKey(date)) ?? [];

  const [todayParts] = useState(() => {
    const today = new Date();
    return {
      timestamp: today.getTime(),
      year: today.getFullYear(),
      month: today.getMonth(),
      date: today.getDate(),
    };
  });
  const isToday = (date: Date) =>
    date.getFullYear() === todayParts.year
    && date.getMonth() === todayParts.month
    && date.getDate() === todayParts.date;

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  const goToday = () => {
    setCurrentMonth(new Date(todayParts.year, todayParts.month, 1));
    setSelectedDate(new Date(todayParts.timestamp));
  };

  const selectedEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  // Upcoming events (next 30 days)
  const upcoming = useMemo(() => {
    const cutoff = new Date(todayParts.year, todayParts.month, todayParts.date + 30);
    return events
      .filter(e => {
        const d = toDate(e.date);
        return d && d.getTime() >= todayParts.timestamp && d <= cutoff;
      })
      .sort((a, b) => (toDate(a.date)?.getTime() || 0) - (toDate(b.date)?.getTime() || 0))
      .slice(0, 6);
  }, [events, todayParts]);

  if (loading || authLoading) {
    return <CalendarSkeleton />;
  }

  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in">
      {/* ── Header ── */}
      <div className="pt-8 mb-7 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-semibold text-[var(--text-primary)] tracking-[-0.025em]">Calendar</h1>
          <p className="text-[var(--text-tertiary)] text-[13.5px] mt-1.5">Your events, tests &amp; internship deadlines</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Legend */}
          <div className="hidden md:flex items-center gap-3 mr-3">
            {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                <span className="text-[11.5px] text-[var(--text-muted)]">{cfg.label}</span>
              </div>
            ))}
          </div>
          <button onClick={goToday} className="btn-secondary !rounded-[10px] text-[12px] !px-4 !py-1.5">Today</button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* ── Calendar grid ── */}
        <div id="calendar" className="flex-1 scroll-mt-20">
          <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
            {/* Month navigation */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
              <button onClick={prevMonth} aria-label="Previous month" className="p-2 rounded-full hover:bg-[var(--bg-elevated)] transition-colors"><ChevronLeft size={15} className="text-[var(--text-muted)]" /></button>
              <h2 className="text-[14.5px] font-semibold text-[var(--text-primary)] tracking-[-0.01em]">
                {MONTH_NAMES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </h2>
              <button onClick={nextMonth} aria-label="Next month" className="p-2 rounded-full hover:bg-[var(--bg-elevated)] transition-colors"><ChevronRight size={15} className="text-[var(--text-muted)]" /></button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-[var(--border-subtle)]">
              {DAY_LABELS.map(d => (
                <div key={d} className="py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)]">{d}</div>
              ))}
            </div>

            {/* Weeks */}
            <div>
              {weeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 border-b border-[var(--border-subtle)] last:border-b-0">
                  {week.map((cell, ci) => {
                    const dayEvents = getEventsForDate(cell.date);
                    const isSelected = selectedDate && sameDay(cell.date, selectedDate);
                    const isTodayCell = isToday(cell.date);
                    return (
                      <button
                        key={ci}
                        onClick={() => setSelectedDate(isSelected ? null : cell.date)}
                        className={`
                          relative min-h-[68px] md:min-h-[80px] p-1.5 text-left transition-colors duration-100 border-r border-[var(--border-subtle)] last:border-r-0
                          ${cell.inMonth ? '' : 'opacity-30'}
                          ${isSelected ? 'bg-[var(--accent-orange)]/[0.07]' : 'hover:bg-[var(--bg-elevated)]'}
                        `}
                      >
                        <span className={`inline-flex items-center justify-center w-6 h-6 text-[12px] font-semibold tabular-nums rounded-full ${
                          isTodayCell
                            ? 'bg-[var(--accent-orange)] text-[var(--accent-ink)]'
                            : isSelected
                              ? 'text-[var(--accent-orange)] ring-1 ring-[var(--accent-orange)]'
                              : 'text-[var(--text-primary)]'
                        }`}>
                          {cell.day}
                        </span>
                        {/* Event dots */}
                        {dayEvents.length > 0 && (
                          <div className="flex flex-wrap gap-0.5 mt-1 px-0.5">
                            {dayEvents.slice(0, 3).map((ev, i) => (
                              <span key={i} className={`w-1.5 h-1.5 rounded-full ${TYPE_CONFIG[ev.type]?.dot || 'bg-[var(--type-event)]'}`} />
                            ))}
                            {dayEvents.length > 3 && (
                              <span className="text-[8px] font-semibold text-[var(--text-faint)] ml-0.5">+{dayEvents.length - 3}</span>
                            )}
                          </div>
                        )}
                        {/* First event title preview on md+ */}
                        {dayEvents.length > 0 && cell.inMonth && (
                          <div className="hidden md:block mt-0.5">
                            <p className={`text-[9px] font-medium leading-tight truncate px-1.5 py-0.5 rounded-full ${TYPE_CONFIG[dayEvents[0].type]?.chip || ''}`}>
                              {dayEvents[0].title}
                            </p>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Sidebar ── */}
        <div className="w-full lg:w-[300px] space-y-4">
          {/* Selected date detail */}
          {selectedDate && (
            <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
              <div className="flex items-center justify-between px-4 h-10 border-b border-[var(--border-subtle)]">
                <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">
                  {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </h3>
                <button onClick={() => setSelectedDate(null)} aria-label="Close" className="p-1.5 rounded-full hover:bg-[var(--bg-elevated)] transition-colors">
                  <X size={13} className="text-[var(--text-faint)]" />
                </button>
              </div>
              <div className="px-4 py-3">
                {selectedEvents.length === 0 ? (
                  <p className="text-[12px] text-[var(--text-faint)]">No events on this day</p>
                ) : (
                  <div className="flex flex-col">
                    {selectedEvents.map(ev => {
                      const d = toDate(ev.date);
                      const cfg = TYPE_CONFIG[ev.type] || TYPE_CONFIG.event;
                      return (
                        <div key={ev.id} className="py-2.5 border-b border-[var(--border-subtle)] last:border-b-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-[2px] rounded-full text-[10px] font-medium ${cfg.chip}`}>{cfg.label}</span>
                            <span className="text-[12.5px] font-semibold text-[var(--text-primary)] truncate">{ev.title}</span>
                          </div>
                          {ev.description && <p className="text-[11.5px] text-[var(--text-muted)] line-clamp-2 mb-1">{ev.description}</p>}
                          <div className="flex flex-wrap gap-3 text-[10.5px] text-[var(--text-faint)]">
                            {d && (
                              <span className="flex items-center gap-1">
                                <Clock size={9} />
                                {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                            {ev.location && (
                              <span className="flex items-center gap-1">
                                <MapPin size={9} />
                                {ev.location}
                              </span>
                            )}
                            {ev.company && (
                              <span className="flex items-center gap-1">
                                <Briefcase size={9} />
                                {ev.company}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Upcoming */}
          <div id="upcoming" className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden scroll-mt-20">
            <div className="px-4 h-10 flex items-center border-b border-[var(--border-subtle)]">
              <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)]">Upcoming</h3>
            </div>
            {upcoming.length === 0 ? (
              <div className="text-center py-8">
                <Calendar size={18} className="mx-auto text-[var(--text-faint)] mb-2" />
                <p className="text-[12px] text-[var(--text-faint)]">No upcoming events</p>
              </div>
            ) : (
              <div className="flex flex-col">
                {upcoming.map(ev => {
                  const d = toDate(ev.date);
                  const cfg = TYPE_CONFIG[ev.type] || TYPE_CONFIG.event;
                  return (
                    <button
                      key={ev.id}
                      onClick={() => { if (d) { setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1)); setSelectedDate(d); }}}
                      className="w-full text-left flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border-subtle)] last:border-b-0 transition-colors hover:bg-[var(--bg-elevated)]"
                    >
                      <div className="flex flex-col items-center w-7 shrink-0">
                        <span className="text-[13px] font-semibold tabular-nums leading-none text-[var(--text-primary)]">{d?.getDate()}</span>
                        <span className="text-[8.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)] mt-0.5">
                          {d?.toLocaleString('default', { month: 'short' })}
                        </span>
                      </div>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-[var(--text-primary)] truncate">{ev.title}</p>
                        <p className="text-[10.5px] text-[var(--text-faint)] truncate mt-0.5">{ev.description || cfg.label}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Month summary */}
          <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
            <div className="px-4 h-10 flex items-center border-b border-[var(--border-subtle)]">
              <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)]">This Month</h3>
            </div>
            <div className="grid grid-cols-2">
              {Object.entries(TYPE_CONFIG).map(([key, cfg], i, arr) => {
                const count = eventsInMonth.filter(e => e.type === key).length;
                const isLastRow = i >= arr.length - (arr.length % 2 === 0 ? 2 : 1);
                return (
                  <div key={key} className={`px-4 py-3 border-r border-[var(--border-subtle)] [&:nth-child(2n)]:border-r-0 ${isLastRow ? '' : 'border-b'}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      <span className="text-[9.5px] font-semibold text-[var(--text-faint)] uppercase tracking-[0.07em]">{cfg.label}s</span>
                    </div>
                    <p className="text-[17px] font-semibold tabular-nums text-[var(--text-primary)]">{count}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
