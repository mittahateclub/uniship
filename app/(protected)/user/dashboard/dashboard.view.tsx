'use client';
import { Link, useTransitionRouter } from 'next-view-transitions';

import { useEffect, useRef, useState } from 'react';
import { EventComments } from '@/components/EventComments';
import { buildResumePrefill, setResumePrefill } from '@/lib/resume-prefill';
import MessageCircle from '@/components/icons/MessageCircle';
import Bookmark from '@/components/icons/Bookmark';
import BookmarkCheck from '@/components/icons/BookmarkCheck';
import MapPin from '@/components/icons/MapPin';
import Clock from '@/components/icons/Clock';
import Calendar from '@/components/icons/Calendar';
import Briefcase from '@/components/icons/Briefcase';
import Code from '@/components/icons/Code';
import FlaskConical from '@/components/icons/FlaskConical';
import Presentation from '@/components/icons/Presentation';
import Check from '@/components/icons/Check';
import ExternalLink from '@/components/icons/ExternalLink';
import Send from '@/components/icons/Send';
import Sparkles from '@/components/icons/Sparkles';
import ArrowRight from '@/components/icons/ArrowRight';
import FileText from '@/components/icons/FileText';
import TrendingUp from '@/components/icons/TrendingUp';
import { FeedSkeleton } from '@/components/Skeleton';

export interface FeedPost {
  id: string;
  title: string;
  type: string;
  description: string;
  location?: string;
  company?: string;
  date: Date | null;
  createdAt?: Date | null;
  imageUrl?: string;
  link?: string;
  universityId?: string;
  source?: 'event' | 'internship';
  stipend?: string;
}

export interface SidebarEvent {
  id: string;
  title: string;
  type: string;
  date: Date | null;
}

export interface Suggestion {
  id: string;
  title: string;
  companyName?: string;
  stipend?: string;
}

export interface DashboardViewProps {
  loading: boolean;
  posts: FeedPost[];
  savedIds: Map<string, string>;
  savingIds: Set<string>;
  onToggleSave: (post: FeedPost) => void;
  appliedIds: Set<string>;
  applyingIds: Set<string>;
  onApply: (post: FeedPost) => void;
  trendingIds: Set<string>;
  upcoming: SidebarEvent[];
  suggestions: Suggestion[];
  userName: string | null;
  userPhotoURL: string | null;
  universityName: string | null;
  branch: string | null;
  savedCount: number;
}

// Route external post images through our own origin so hotlink/referrer-protected
// URLs (which load in the native app but not the browser) render on the web too.
function proxiedImage(url: string): string {
  if (/^https?:\/\//i.test(url) && !url.includes('firebasestorage.googleapis.com')) {
    return `/api/image-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}

const TYPE_CONFIG: Record<string, { chip: string; dot: string; icon: React.ComponentType<{ size?: number; className?: string }>; label: string }> = {
  event:      { chip: 'bg-[var(--type-event)]/12 text-[var(--type-event)]',           dot: 'bg-[var(--type-event)]',      icon: Calendar, label: 'Event' },
  internship: { chip: 'bg-[var(--type-internship)]/12 text-[var(--type-internship)]', dot: 'bg-[var(--type-internship)]', icon: Briefcase, label: 'Internship' },
  hackathon:  { chip: 'bg-[var(--type-hackathon)]/12 text-[var(--type-hackathon)]',   dot: 'bg-[var(--type-hackathon)]',  icon: Code, label: 'Hackathon' },
  research:   { chip: 'bg-[var(--type-research)]/12 text-[var(--type-research)]',     dot: 'bg-[var(--type-research)]',   icon: FlaskConical, label: 'Research' },
  workshop:   { chip: 'bg-[var(--type-workshop)]/12 text-[var(--type-workshop)]',     dot: 'bg-[var(--type-workshop)]',   icon: Presentation, label: 'Workshop' },
};

function PostCard({
  post, saved, saving, onToggleSave, applied, applying, onApply, onOpenComments, trending,
}: {
  post: FeedPost; saved: boolean; saving: boolean; onToggleSave: () => void;
  applied: boolean; applying: boolean; onApply: () => void; onOpenComments: () => void; trending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const descRef = useRef<HTMLParagraphElement>(null);
  const router = useTransitionRouter();
  const source = post.source ?? 'event';
  const isInternship = source === 'internship';
  const cfg = TYPE_CONFIG[post.type] || TYPE_CONFIG.event;
  const TypeIcon = cfg.icon;
  const initial = (post.company || post.title)[0]?.toUpperCase() ?? '•';

  // Only offer "more" when the caption actually spills past two lines.
  useEffect(() => {
    const el = descRef.current;
    if (!el || expanded) return; // overflow is only measurable while clamped
    const measure = () => setOverflowing(el.scrollHeight > el.clientHeight + 1);
    const raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [post.description, expanded]);

  const generateResume = () => {
    setResumePrefill(buildResumePrefill({
      title: post.title, company: post.company, location: post.location, description: post.description,
    }));
    router.push('/user/resume#ai-tailor');
  };

  return (
    <article className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
      {/* Trending strip — surfaces high-priority posts, mirroring the app */}
      {trending && (
        <div className="flex items-center gap-1.5 px-4 pt-3.5 -mb-1.5">
          <span className="inline-flex items-center gap-1 px-2 py-[3px] text-[10.5px] font-semibold rounded-full bg-[var(--type-workshop)]/12 text-[var(--type-workshop)]">
            <TrendingUp size={11} /> Trending
          </span>
        </div>
      )}
      {/* Header — internships lead with the company; events lead with a type
          avatar + meta so the title shows once, in the body (no duplication). */}
      <div className="flex items-center gap-3 px-4 py-3">
        {post.company ? (
          <span className="w-9 h-9 rounded-full bg-[var(--accent-orange)]/15 text-[var(--accent-orange)] flex items-center justify-center text-[14px] font-bold shrink-0">
            {initial}
          </span>
        ) : (
          <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${cfg.chip}`}>
            <TypeIcon size={16} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          {post.company && <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{post.company}</p>}
          <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
            {post.location && <span className="flex items-center gap-0.5 truncate min-w-0"><MapPin size={10} className="shrink-0" />{post.location}</span>}
            {post.date && <span className="flex items-center gap-0.5 shrink-0"><Clock size={10} />{isInternship ? 'Apply by ' : ''}{post.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
            {isInternship && post.stipend && <span className="truncate">· {post.stipend}</span>}
            {!post.location && !post.date && !isInternship && <span className="text-[var(--text-faint)]">{cfg.label}</span>}
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-[3px] text-[10.5px] font-medium rounded-full shrink-0 ${cfg.chip}`}>
          <TypeIcon size={10} />{cfg.label}
        </span>
      </div>

      {/* Image — proxied through our origin so app-scraped URLs load on the web;
          still hidden if genuinely broken. */}
      {post.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={proxiedImage(post.imageUrl)}
          alt={post.title}
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
          width={1200}
          height={675}
          className="w-full aspect-video max-h-[360px] object-cover border-y border-[var(--border-subtle)]"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      )}

      {/* Body */}
      <div className="px-4 pt-3">
        <h2 className="text-[14.5px] font-semibold text-[var(--text-primary)] tracking-[-0.01em]">{post.title}</h2>
        {post.description && (
          <p ref={descRef} className={`text-[12.5px] text-[var(--text-muted)] mt-1 leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
            {post.description}
          </p>
        )}
        {post.description && (overflowing || expanded) && (
          <button onClick={() => setExpanded((v) => !v)} className="text-[11.5px] font-semibold text-[var(--text-faint)] mt-1 hover:text-[var(--text-secondary)]">
            {expanded ? 'less' : 'more'}
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 px-2.5 py-2.5 mt-1">
        {!isInternship && (
          <button onClick={onOpenComments} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors">
            <MessageCircle size={16} /> Comment
          </button>
        )}
        <button onClick={onToggleSave} disabled={saving} className={`flex items-center px-2 py-1.5 rounded-[8px] transition-colors ${saved ? 'text-[var(--accent-orange)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'}`}>
          {saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
        </button>
        <div className="flex-1" />
        <button
          onClick={generateResume}
          title="Tailor your resume to this role"
          className="btn-secondary !rounded-[10px] text-[11.5px] !px-3 !py-1.5 inline-flex items-center gap-1"
        >
          <FileText size={12} /> Resume
        </button>
        {applied ? (
          <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold rounded-[10px] px-3 py-1.5 bg-[var(--status-success)]/12 text-[var(--status-success)]">
            <Check size={13} /> Applied
          </span>
        ) : isInternship ? (
          <button onClick={onApply} disabled={applying} className="btn-primary !rounded-[10px] text-[11.5px] !px-4 !py-1.5 inline-flex items-center gap-1 disabled:opacity-50">
            View <ArrowRight size={12} />
          </button>
        ) : (
          <button onClick={onApply} disabled={applying} className="btn-primary !rounded-[10px] text-[11.5px] !px-4 !py-1.5 inline-flex items-center gap-1 disabled:opacity-50">
            {post.link ? <ExternalLink size={12} /> : <Send size={12} />} Apply
          </button>
        )}
      </div>
    </article>
  );
}

export function DashboardView(props: DashboardViewProps) {
  const {
    loading, posts, savedIds, savingIds, onToggleSave, appliedIds, applyingIds, onApply, trendingIds,
    upcoming, suggestions, savedCount,
  } = props;
  const [commentsFor, setCommentsFor] = useState<string | null>(null);

  if (loading) {
    return <FeedSkeleton />;
  }

  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in">
      <div className="pt-8 mb-7">
        <h1 className="text-[26px] font-semibold tracking-[-0.025em] text-[var(--text-primary)]">Dashboard</h1>
        <p className="text-[var(--text-tertiary)] text-[13.5px] mt-1.5">Your feed of events, opportunities, and placement updates.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
        {/* ── Feed ── */}
        <div id="feed" className="min-w-0 flex flex-col gap-5 scroll-mt-20">
          {posts.length === 0 ? (
            <div className="text-center py-20 border border-[var(--border-subtle)] rounded-[var(--radius)] bg-[var(--bg-surface)]">
              <Calendar size={26} className="mx-auto text-[var(--text-faint)] mb-3" />
              <p className="text-[var(--text-primary)] text-[13px] font-medium">No posts yet</p>
              <p className="text-[var(--text-faint)] text-[12px] mt-1">Events and opportunities from your university will appear here</p>
            </div>
          ) : (
            posts.map((post) => {
              const key = `${post.source ?? 'event'}-${post.id}`;
              return (
                <PostCard
                  key={post.id}
                  post={post}
                  saved={savedIds.has(key)}
                  saving={savingIds.has(key)}
                  onToggleSave={() => onToggleSave(post)}
                  applied={appliedIds.has(post.id)}
                  applying={applyingIds.has(post.id)}
                  onApply={() => onApply(post)}
                  onOpenComments={() => setCommentsFor(post.id)}
                  trending={trendingIds.has(post.id)}
                />
              );
            })
          )}
        </div>

        {/* ── Right rail ── */}
        <aside className="hidden lg:flex flex-col gap-5">
          {/* Messages */}
          <button
            onClick={() => document.dispatchEvent(new CustomEvent('open-support-chat'))}
            className="flex items-center gap-3 px-3.5 py-3 rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-active)] transition-colors text-left"
          >
            <span className="w-9 h-9 rounded-full bg-[var(--accent-indigo)]/12 text-[var(--accent-indigo)] flex items-center justify-center shrink-0">
              <MessageCircle size={17} />
            </span>
            <span className="min-w-0">
              <span className="block text-[12.5px] font-semibold text-[var(--text-primary)]">Messages</span>
              <span className="block text-[11px] text-[var(--text-muted)]">Chat with the placement cell</span>
            </span>
          </button>

          {/* Upcoming deadlines */}
          <div id="upcoming" className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden scroll-mt-20">
            <div className="flex items-center justify-between px-4 h-10 border-b border-[var(--border-subtle)]">
              <span className="text-[12px] font-semibold text-[var(--text-primary)]">Upcoming</span>
              <Link href="/user/calendar" className="text-[11px] font-medium text-[var(--accent-orange)] flex items-center gap-0.5">Calendar <ArrowRight size={11} /></Link>
            </div>
            <div className="px-4 py-2">
              {upcoming.length === 0 ? (
                <p className="text-[11.5px] text-[var(--text-faint)] py-2">Nothing scheduled yet</p>
              ) : (
                upcoming.map((ev) => {
                  const cfg = TYPE_CONFIG[ev.type] || TYPE_CONFIG.event;
                  return (
                    <div key={ev.id} className="flex items-center gap-2.5 py-2 border-b border-[var(--border-subtle)] last:border-b-0">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                      <span className="text-[12px] text-[var(--text-secondary)] truncate flex-1">{ev.title}</span>
                      {ev.date && <span className="text-[10.5px] text-[var(--text-faint)] shrink-0">{ev.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Suggested internships */}
          <div id="suggested" className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden scroll-mt-20">
            <div className="flex items-center justify-between px-4 h-10 border-b border-[var(--border-subtle)]">
              <span className="text-[12px] font-semibold text-[var(--text-primary)]">Suggested for you</span>
              <Link href="/user/internships" className="text-[11px] font-medium text-[var(--accent-orange)] flex items-center gap-0.5">All <ArrowRight size={11} /></Link>
            </div>
            <div className="px-4 py-2">
              {suggestions.length === 0 ? (
                <p className="text-[11.5px] text-[var(--text-faint)] py-2">No internships posted yet</p>
              ) : (
                suggestions.map((s) => (
                  <Link key={s.id} href={`/user/internships/${s.id}`} className="flex items-center gap-2.5 py-2 border-b border-[var(--border-subtle)] last:border-b-0 group">
                    <span className="w-7 h-7 rounded-full bg-[var(--type-internship)]/12 text-[var(--type-internship)] flex items-center justify-center shrink-0"><Briefcase size={13} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px] font-medium text-[var(--text-primary)] truncate group-hover:text-[var(--accent-orange)] transition-colors">{s.title}</span>
                      <span className="block text-[10.5px] text-[var(--text-faint)] truncate">{[s.companyName, s.stipend].filter(Boolean).join(' · ') || 'View details'}</span>
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* AI resume nudge */}
          <Link href="/user/resume" className="flex items-center gap-3 px-3.5 py-3 rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-active)] transition-colors">
            <span className="w-9 h-9 rounded-full bg-[var(--accent-orange)]/12 text-[var(--accent-orange)] flex items-center justify-center shrink-0"><Sparkles size={17} /></span>
            <span className="min-w-0">
              <span className="block text-[12.5px] font-semibold text-[var(--text-primary)]">AI Resume Builder</span>
              <span className="block text-[11px] text-[var(--text-muted)]">{savedCount > 0 ? `${savedCount} saved items to tailor for` : 'Craft a tailored resume'}</span>
            </span>
          </Link>

          <p className="text-[10.5px] text-[var(--text-faint)] px-1 leading-relaxed">UNISHIP · Placement & Testing Ecosystem</p>
        </aside>
      </div>

      {commentsFor && <EventComments eventId={commentsFor} onClose={() => setCommentsFor(null)} />}
    </div>
  );
}
