'use client';

import Link from 'next/link';
import { Bookmark, BookmarkCheck, MapPin, Clock, Calendar, Briefcase, Code, FlaskConical, Presentation, GraduationCap, Search } from '@/components/icons';

export interface CollegeEvent {
  id: string;
  title: string;
  date: any;
  type: string;
  description: string;
  location?: string;
  // internship-specific
  companyName?: string;
  role?: string;
  stipend?: string;
  duration?: string;
  deadline?: any;
  source: 'event' | 'internship';
}

export interface InternshipsViewProps {
  loading: boolean;
  filtered: CollegeEvent[];
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  showSaved: boolean;
  onToggleShowSaved: () => void;
  savedIds: Map<string, string>;
  savingIds: Set<string>;
  onToggleSave: (item: CollegeEvent) => void;
}

const TYPE_CONFIG: Record<string, { chip: string; icon: React.ComponentType<any>; label: string }> = {
  event:      { chip: 'bg-[#4B8BBE]/12 text-[#4B8BBE]', icon: Calendar, label: 'Event' },
  internship: { chip: 'bg-[#00C16E]/12 text-[#00C16E]', icon: Briefcase, label: 'Internship' },
  hackathon:  { chip: 'bg-[#00A8E1]/12 text-[#00A8E1]', icon: Code, label: 'Hackathon' },
  research:   { chip: 'bg-[#F1A82C]/12 text-[#F1A82C]', icon: FlaskConical, label: 'Research' },
  workshop:   { chip: 'bg-[#E04DB0]/12 text-[#E04DB0]', icon: Presentation, label: 'Workshop' },
};

function toDate(d: any): Date | null {
  if (!d) return null;
  if (typeof d.toDate === 'function') return d.toDate();
  if (d instanceof Date) return d;
  return new Date(d);
}

export function InternshipsView({
  loading,
  filtered,
  searchQuery,
  onSearchQueryChange,
  showSaved,
  onToggleShowSaved,
  savedIds,
  savingIds,
  onToggleSave,
}: InternshipsViewProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-dots"><span /><span /><span /></div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in">
      {/* ── Page header ── */}
      <div className="pt-8 mb-7">
        <h1 className="text-[26px] font-semibold text-[var(--text-primary)] tracking-[-0.025em]">College Space</h1>
        <p className="text-[var(--text-tertiary)] text-[13.5px] mt-1.5">All events, internships &amp; opportunities from your university</p>
      </div>

      {/* ── Search & Saved ── */}
      <div className="flex gap-2.5 mb-5">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
          <input
            type="text"
            placeholder="Search events, companies, locations..."
            value={searchQuery}
            onChange={e => onSearchQueryChange(e.target.value)}
            className="w-full h-9 pl-9 pr-3 text-[13px] placeholder:text-[var(--text-faint)]"
          />
        </div>
        <button
          onClick={onToggleShowSaved}
          className={`flex items-center gap-1.5 h-9 px-3.5 text-[12.5px] font-medium rounded-[10px] border whitespace-nowrap transition-colors duration-150 ${
            showSaved
              ? 'bg-[var(--accent-orange)]/10 text-[var(--accent-orange)] border-[var(--accent-orange)]/30'
              : 'bg-transparent text-[var(--text-muted)] border-[var(--border-subtle)] hover:border-[var(--border-active)] hover:text-[var(--text-primary)]'
          }`}
        >
          {showSaved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
          Saved ({savedIds.size})
        </button>
      </div>

      {/* ── Listings ── */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 border border-[var(--border-subtle)] rounded-[var(--radius)] bg-[var(--bg-surface)]">
          <GraduationCap size={26} className="mx-auto text-[var(--text-faint)] mb-3" />
          <p className="text-[var(--text-primary)] text-[13px] font-medium">
            {'No listings found'}
          </p>
          <p className="text-[var(--text-faint)] text-[12px] mt-1">
            {'Check back for new opportunities'}
          </p>
        </div>
      ) : (
        <div id="listings" className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
          {filtered.map((item) => {
            const key = `${item.source}-${item.id}`;
            const isSaved = savedIds.has(key);
            const isSaving = savingIds.has(key);
            const d = toDate(item.date);
            const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.event;
            const TypeIcon = cfg.icon;

            return (
              <div key={key} className="group flex items-start gap-4 px-4 sm:px-5 py-4 border-b border-[var(--border-subtle)] last:border-b-0 transition-colors duration-150 hover:bg-[var(--bg-elevated)]">
                {/* Date block */}
                {d && (
                  <div className="hidden sm:flex flex-col items-center justify-center w-11 shrink-0 pt-0.5">
                    <span className="text-[17px] font-semibold tabular-nums text-[var(--text-primary)] leading-none">{d.getDate()}</span>
                    <span className="text-[9.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)] mt-1">
                      {d.toLocaleString('default', { month: 'short' })}
                    </span>
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-[3px] text-[10.5px] font-medium rounded-full ${cfg.chip}`}>
                      <TypeIcon size={10} />
                      {cfg.label}
                    </span>
                    {item.companyName && (
                      <span className="text-[12px] font-medium text-[var(--text-secondary)]">{item.companyName}</span>
                    )}
                    {item.location && (
                      <span className="flex items-center gap-1 text-[11.5px] text-[var(--text-muted)]">
                        <MapPin size={10} />
                        {item.location}
                      </span>
                    )}
                  </div>

                  <h2 className="text-[14px] font-semibold text-[var(--text-primary)] tracking-[-0.01em] mb-1">{item.title}</h2>
                  <p className="text-[12.5px] text-[var(--text-muted)] line-clamp-2 mb-2 leading-relaxed">{item.description}</p>

                  <div className="flex flex-wrap gap-3 text-[11.5px] text-[var(--text-faint)]">
                    {d && (
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        {' · '}
                        {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    {item.stipend && (
                      <span className="flex items-center gap-1 text-[var(--status-success)]">
                        {item.stipend}
                      </span>
                    )}
                    {item.duration && (
                      <span className="flex items-center gap-1">
                        <Calendar size={10} />
                        {item.duration}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                  <button
                    onClick={() => onToggleSave(item)}
                    disabled={isSaving}
                    className={`p-2 rounded-full transition-colors duration-150 ${
                      isSaved
                        ? 'text-[var(--accent-orange)] bg-[var(--accent-orange)]/10'
                        : 'text-[var(--text-faint)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
                    } ${isSaving ? 'opacity-50' : ''}`}
                    title={isSaved ? 'Unsave' : 'Save to calendar'}
                  >
                    {isSaved ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
                  </button>
                  {item.source === 'internship' && (
                    <Link
                      href={`/user/internships/${item.id}`}
                      className="btn-primary !rounded-[10px] text-[11.5px] !px-3.5 !py-1.5"
                    >
                      Details
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
