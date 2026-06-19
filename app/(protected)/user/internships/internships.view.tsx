'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { buildResumePrefill, setResumePrefill } from '@/lib/resume-prefill';
import Bookmark from '@/components/icons/Bookmark';
import BookmarkCheck from '@/components/icons/BookmarkCheck';
import MapPin from '@/components/icons/MapPin';
import Clock from '@/components/icons/Clock';
import Calendar from '@/components/icons/Calendar';
import Briefcase from '@/components/icons/Briefcase';
import Code from '@/components/icons/Code';
import FlaskConical from '@/components/icons/FlaskConical';
import Presentation from '@/components/icons/Presentation';
import GraduationCap from '@/components/icons/GraduationCap';
import Search from '@/components/icons/Search';
import Check from '@/components/icons/Check';
import ExternalLink from '@/components/icons/ExternalLink';
import Send from '@/components/icons/Send';
import FileText from '@/components/icons/FileText';
import { ListSkeleton } from '@/components/Skeleton';

export interface CollegeEvent {
  id: string;
  title: string;
  date: unknown;
  type: string;
  description: string;
  location?: string;
  // internship-specific
  companyName?: string;
  role?: string;
  stipend?: string;
  duration?: string;
  deadline?: unknown;
  // event-specific
  link?: string;
  universityId?: string;
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
  appliedIds: Set<string>;
  applyingIds: Set<string>;
  onApply: (item: CollegeEvent) => void;
}

const TYPE_CONFIG: Record<string, { chip: string; icon: React.ComponentType<{ size?: number; className?: string }>; label: string }> = {
  event:      { chip: 'bg-[var(--type-event)]/12 text-[var(--type-event)]',           icon: Calendar, label: 'Event' },
  internship: { chip: 'bg-[var(--type-internship)]/12 text-[var(--type-internship)]', icon: Briefcase, label: 'Internship' },
  hackathon:  { chip: 'bg-[var(--type-hackathon)]/12 text-[var(--type-hackathon)]',   icon: Code, label: 'Hackathon' },
  research:   { chip: 'bg-[var(--type-research)]/12 text-[var(--type-research)]',     icon: FlaskConical, label: 'Research' },
  workshop:   { chip: 'bg-[var(--type-workshop)]/12 text-[var(--type-workshop)]',     icon: Presentation, label: 'Workshop' },
};

function toDate(d: unknown): Date | null {
  if (!d) return null;
  if (typeof (d as { toDate?: unknown }).toDate === 'function') return (d as { toDate: () => Date }).toDate();
  if (d instanceof Date) return d;
  return new Date(d as string | number);
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
  appliedIds,
  applyingIds,
  onApply,
}: InternshipsViewProps) {
  const router = useRouter();
  const generateResume = (item: CollegeEvent) => {
    setResumePrefill(buildResumePrefill({
      title: item.title, company: item.companyName, location: item.location, description: item.description,
    }));
    router.push('/user/resume#ai-tailor');
  };

  if (loading) {
    return <ListSkeleton rows={5} />;
  }

  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in">
      {/* ── Page header ── */}
      <div className="pt-8 mb-7">
        <h1 className="text-[26px] font-semibold text-[var(--text-primary)] tracking-[-0.025em]">College Space</h1>
        <p className="text-[var(--text-tertiary)] text-[13.5px] mt-1.5">All events, internships &amp; opportunities from your university</p>
      </div>

      {/* ── Search & Saved ── */}
      <div id="saved" className="flex gap-2.5 mb-5 scroll-mt-20">
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
              <div key={key} className="group flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4 px-4 sm:px-5 py-4 border-b border-[var(--border-subtle)] last:border-b-0 transition-colors duration-150 hover:bg-[var(--bg-elevated)]">
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
                <div className="flex items-center gap-1.5 flex-wrap sm:shrink-0 sm:pt-0.5">
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
                  {item.source === 'event' && (
                    <button
                      onClick={() => generateResume(item)}
                      title="Tailor your resume to this role"
                      className="btn-secondary !rounded-[10px] text-[11.5px] !px-3 !py-1.5 inline-flex items-center gap-1"
                    >
                      <FileText size={12} /> Resume
                    </button>
                  )}
                  {item.source === 'event' && (
                    appliedIds.has(item.id) ? (
                      <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold rounded-[10px] px-3 py-1.5 bg-[var(--status-success)]/12 text-[var(--status-success)]">
                        <Check size={13} /> Applied
                      </span>
                    ) : (
                      <button
                        onClick={() => onApply(item)}
                        disabled={applyingIds.has(item.id)}
                        className="btn-primary !rounded-[10px] text-[11.5px] !px-3.5 !py-1.5 inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        {item.link ? <ExternalLink size={12} /> : <Send size={12} />}
                        Apply
                      </button>
                    )
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
