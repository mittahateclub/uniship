'use client';

// Shared exam-schedule controls — the inline date picker + hour/minute/AM-PM
// fields used by the test upload form (create-test) and the per-test
// management subpage (tests/review/[id]). Kept here so both stay in sync.

import Clock from '@/components/icons/Clock';
import ChevronLeft from '@/components/icons/ChevronLeft';
import ChevronRight from '@/components/icons/ChevronRight';

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export type AmPm = 'AM' | 'PM';

export const to24Hour = (h: number, ampm: AmPm) => {
  if (ampm === 'AM') return h === 12 ? 0 : h;
  return h === 12 ? 12 : h + 12;
};

export const from24Hour = (h24: number): { hour: number; ampm: AmPm } => {
  if (h24 === 0) return { hour: 12, ampm: 'AM' };
  if (h24 < 12) return { hour: h24, ampm: 'AM' };
  if (h24 === 12) return { hour: 12, ampm: 'PM' };
  return { hour: h24 - 12, ampm: 'PM' };
};

export const buildISOString = (date: Date, hour: number, minute: number, ampm: AmPm) => {
  const d = new Date(date);
  d.setHours(to24Hour(hour, ampm), minute, 0, 0);
  return d.toISOString();
};

// ── Reusable inline date picker ──
export function MiniCalendar({ month, year, selected, onPrev, onNext, onPick }: {
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
export function TimeField({ label, hour, minute, ampm, onHour, onMinute, onAmPm }: {
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

// Format an ISO timestamp like "Jun 18, 2:30 PM".
export function formatSchedule(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
