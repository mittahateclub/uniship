'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, getDocs, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Calendar, MapPin, Clock, ChevronLeft, ChevronRight, Briefcase, X } from 'lucide-react';

interface CalendarEvent {
  id: string;
  title: string;
  date: any;
  type: string;
  description: string;
  location?: string;
  company?: string;
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function toDate(d: any): Date | null {
  if (!d) return null;
  if (typeof d.toDate === 'function') return d.toDate();
  if (d instanceof Date) return d;
  return new Date(d);
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const TYPE_CONFIG: Record<string, { dot: string; badge: string; label: string }> = {
  event:      { dot: 'bg-[#5E6AD2]', badge: 'bg-[#5E6AD2]/10 text-[#5E6AD2] border-[#5E6AD2]/20', label: 'Event' },
  internship: { dot: 'bg-[#00C16E]', badge: 'bg-[#00C16E]/10 text-[#00C16E] border-[#00C16E]/20', label: 'Internship' },
  hackathon:  { dot: 'bg-[#F54E00]', badge: 'bg-[#F54E00]/10 text-[#F54E00] border-[#F54E00]/20', label: 'Hackathon' },
  research:   { dot: 'bg-[#F1A82C]', badge: 'bg-[#F1A82C]/10 text-[#F1A82C] border-[#F1A82C]/20', label: 'Research' },
  workshop:   { dot: 'bg-[#E04DB0]', badge: 'bg-[#E04DB0]/10 text-[#E04DB0] border-[#E04DB0]/20', label: 'Workshop' },
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
          query(collection(db, 'savedEvents'), where('userId', '==', user.uid))
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

  const getEventsForDate = (date: Date) => events.filter(e => { const d = toDate(e.date); return d && sameDay(d, date); });

  const today = new Date();
  const isToday = (date: Date) => sameDay(date, today);

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  const goToday = () => { setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDate(today); };

  const selectedEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  // Upcoming events (next 30 days)
  const upcoming = useMemo(() => {
    const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30);
    return events
      .filter(e => { const d = toDate(e.date); return d && d >= today && d <= cutoff; })
      .sort((a, b) => (toDate(a.date)?.getTime() || 0) - (toDate(b.date)?.getTime() || 0))
      .slice(0, 6);
  }, [events, today]);

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-dots"><span /><span /><span /></div>
      </div>
    );
  }

  return (
    <div className="max-w-[1100px] mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-[-0.02em]">Calendar</h1>
          <p className="text-[var(--text-tertiary)] text-[13px] mt-1">Your events, tests & internship deadlines</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Legend */}
          <div className="hidden md:flex items-center gap-3 mr-3">
            {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                <span className="text-[11px] text-[var(--text-muted)]">{cfg.label}</span>
              </div>
            ))}
          </div>
          <button onClick={goToday} className="btn-secondary text-[12px] px-3 py-1.5">Today</button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Calendar Grid */}
        <div className="flex-1">
          <div className="window overflow-hidden">
            {/* Month navigation */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border-subtle)]">
              <button onClick={prevMonth} className="p-1.5 rounded hover:bg-[var(--bg-elevated)] transition-colors"><ChevronLeft size={16} className="text-[var(--text-muted)]" /></button>
              <h2 className="text-[15px] font-bold text-[var(--text-primary)] tracking-[-0.01em]">
                {MONTH_NAMES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </h2>
              <button onClick={nextMonth} className="p-1.5 rounded hover:bg-[var(--bg-elevated)] transition-colors"><ChevronRight size={16} className="text-[var(--text-muted)]" /></button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-[var(--border-subtle)]">
              {DAY_LABELS.map(d => (
                <div key={d} className="py-2.5 text-center text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">{d}</div>
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
                          relative min-h-[72px] md:min-h-[82px] p-1.5 text-left transition-colors duration-100 border-r border-[var(--border-subtle)] last:border-r-0
                          ${cell.inMonth ? '' : 'opacity-35'}
                          ${isSelected ? 'bg-[#5E6AD2]/8' : 'hover:bg-[var(--bg-elevated)]'}
                        `}
                      >
                        <span className={`
                          inline-flex items-center justify-center w-6 h-6 text-[12px] font-bold tabular-nums rounded-full
                          ${isTodayCell ? 'bg-[#F54E00] text-white' : 'text-[var(--text-primary)]'}
                          ${isSelected && !isTodayCell ? 'bg-[#5E6AD2] text-white' : ''}
                        `}>
                          {cell.day}
                        </span>
                        {/* Event dots */}
                        {dayEvents.length > 0 && (
                          <div className="flex flex-wrap gap-0.5 mt-1 px-0.5">
                            {dayEvents.slice(0, 3).map((ev, i) => (
                              <span key={i} className={`w-1.5 h-1.5 rounded-full ${TYPE_CONFIG[ev.type]?.dot || 'bg-[#5E6AD2]'}`} />
                            ))}
                            {dayEvents.length > 3 && (
                              <span className="text-[8px] font-bold text-[var(--text-faint)] ml-0.5">+{dayEvents.length - 3}</span>
                            )}
                          </div>
                        )}
                        {/* First event title preview on md+ */}
                        {dayEvents.length > 0 && cell.inMonth && (
                          <div className="hidden md:block mt-0.5">
                            <p className={`text-[9px] font-semibold leading-tight truncate px-1 py-0.5 rounded ${TYPE_CONFIG[dayEvents[0].type]?.badge || ''}`}>
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

        {/* Sidebar */}
        <div className="w-full lg:w-[300px] space-y-4">
          {/* Selected date detail */}
          {selectedDate && (
            <div className="window p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] font-bold text-[var(--text-primary)]">
                  {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </h3>
                <button onClick={() => setSelectedDate(null)} className="p-1 rounded hover:bg-[var(--bg-elevated)] transition-colors">
                  <X size={14} className="text-[var(--text-faint)]" />
                </button>
              </div>
              {selectedEvents.length === 0 ? (
                <p className="text-[12px] text-[var(--text-faint)]">No events on this day</p>
              ) : (
                <div className="space-y-2">
                  {selectedEvents.map(ev => {
                    const d = toDate(ev.date);
                    const cfg = TYPE_CONFIG[ev.type] || TYPE_CONFIG.event;
                    return (
                      <div key={ev.id} className="p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                          <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded border ${cfg.badge}`}>{cfg.label}</span>
                        </div>
                        <h4 className="text-[13px] font-bold text-[var(--text-primary)] leading-snug mb-1">{ev.title}</h4>
                        {ev.description && <p className="text-[11px] text-[var(--text-muted)] line-clamp-2 mb-1.5">{ev.description}</p>}
                        <div className="flex flex-wrap gap-3 text-[11px] text-[var(--text-faint)]">
                          {d && (
                            <span className="flex items-center gap-1">
                              <Clock size={10} />
                              {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                          {ev.location && (
                            <span className="flex items-center gap-1">
                              <MapPin size={10} />
                              {ev.location}
                            </span>
                          )}
                          {ev.company && (
                            <span className="flex items-center gap-1">
                              <Briefcase size={10} />
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
          )}

          {/* Upcoming */}
          <div className="window p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-faint)] mb-3">Upcoming</h3>
            {upcoming.length === 0 ? (
              <div className="text-center py-6">
                <Calendar size={20} className="mx-auto text-[var(--text-faint)] mb-2" />
                <p className="text-[12px] text-[var(--text-faint)]">No upcoming events</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {upcoming.map(ev => {
                  const d = toDate(ev.date);
                  const cfg = TYPE_CONFIG[ev.type] || TYPE_CONFIG.event;
                  return (
                    <button
                      key={ev.id}
                      onClick={() => { if (d) { setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1)); setSelectedDate(d); }}}
                      className="w-full text-left p-2.5 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors group"
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="flex flex-col items-center min-w-[32px] pt-0.5">
                          <span className="text-[14px] font-bold tabular-nums text-[var(--text-primary)] leading-none">{d?.getDate()}</span>
                          <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-faint)] mt-0.5">
                            {d?.toLocaleString('default', { month: 'short' })}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                            <span className="text-[12px] font-semibold text-[var(--text-primary)] truncate">{ev.title}</span>
                          </div>
                          <p className="text-[10px] text-[var(--text-faint)] truncate">{ev.description || cfg.label}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Month summary */}
          <div className="window p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-faint)] mb-3">This Month</h3>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
                const count = eventsInMonth.filter(e => e.type === key).length;
                return (
                  <div key={key} className="p-2.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                      <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">{cfg.label}s</span>
                    </div>
                    <p className="text-[18px] font-bold tabular-nums text-[var(--text-primary)]">{count}</p>
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