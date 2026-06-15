'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EventComments } from '@/components/EventComments';
import { buildResumePrefill, setResumePrefill } from '@/lib/resume-prefill';
import {
  MessageCircle, Bookmark, BookmarkCheck, MapPin, Clock, Calendar, Briefcase,
  Code, FlaskConical, Presentation, Check, ExternalLink, Send, Sparkles, ArrowRight, FileText,
} from '@/components/icons';
import { FeedSkeleton } from '@/components/Skeleton';

export interface FeedPost {
  id: string;
  title: string;
  type: string;
  description: string;
  location?: string;
  company?: string;
  date: Date | null;
  imageUrl?: string;
  link?: string;
  universityId?: string;
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

const TYPE_CONFIG: Record<string, { chip: string; dot: string; icon: React.ComponentType<any>; label: string }> = {
  event:      { chip: 'bg-[var(--type-event)]/12 text-[var(--type-event)]',           dot: 'bg-[var(--type-event)]',      icon: Calendar, label: 'Event' },
  internship: { chip: 'bg-[var(--type-internship)]/12 text-[var(--type-internship)]', dot: 'bg-[var(--type-internship)]', icon: Briefcase, label: 'Internship' },
  hackathon:  { chip: 'bg-[var(--type-hackathon)]/12 text-[var(--type-hackathon)]',   dot: 'bg-[var(--type-hackathon)]',  icon: Code, label: 'Hackathon' },
  research:   { chip: 'bg-[var(--type-research)]/12 text-[var(--type-research)]',     dot: 'bg-[var(--type-research)]',   icon: FlaskConical, label: 'Research' },
  workshop:   { chip: 'bg-[var(--type-workshop)]/12 text-[var(--type-workshop)]',     dot: 'bg-[var(--type-workshop)]',   icon: Presentation, label: 'Workshop' },
};

function PostCard({
  post, saved, saving, onToggleSave, applied, applying, onApply, onOpenComments,
}: {
  post: FeedPost; saved: boolean; saving: boolean; onToggleSave: () => void;
  applied: boolean; applying: boolean; onApply: () => void; onOpenComments: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();
  const cfg = TYPE_CONFIG[post.type] || TYPE_CONFIG.event;
  const TypeIcon = cfg.icon;
  const initial = (post.company || post.title)[0]?.toUpperCase() ?? '•';

  const generateResume = () => {
    setResumePrefill(buildResumePrefill({
      title: post.title, company: post.company, location: post.location, description: post.description,
    }));
    router.push('/user/resume#ai-tailor');
  };

  return (
    <article className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="w-9 h-9 rounded-full bg-[var(--accent-orange)]/15 text-[var(--accent-orange)] flex items-center justify-center text-[14px] font-bold shrink-0">
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{post.company || post.title}</p>
          <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
            {post.location && <span className="flex items-center gap-0.5 truncate"><MapPin size={10} />{post.location}</span>}
            {post.date && <span className="flex items-center gap-0.5"><Clock size={10} />{post.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
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
          className="w-full max-h-[360px] object-cover border-y border-[var(--border-subtle)]"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      )}

      {/* Body */}
      <div className="px-4 pt-3">
        <h2 className="text-[14.5px] font-semibold text-[var(--text-primary)] tracking-[-0.01em]">{post.title}</h2>
        {post.description && (
          <p className={`text-[12.5px] text-[var(--text-muted)] mt-1 leading-relaxed ${expanded ? '' : 'line-clamp-3'}`}>
            {post.description}
          </p>
        )}
        {post.description && post.description.length > 140 && (
          <button onClick={() => setExpanded((v) => !v)} className="text-[11.5px] font-semibold text-[var(--text-faint)] mt-1 hover:text-[var(--text-secondary)]">
            {expanded ? 'less' : 'more'}
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 px-2.5 py-2.5 mt-1">
        <button onClick={onOpenComments} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors">
          <MessageCircle size={16} /> Comment
        </button>
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
    loading, posts, savedIds, savingIds, onToggleSave, appliedIds, applyingIds, onApply,
    upcoming, suggestions, userName, userPhotoURL, universityName, branch, savedCount,
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
        <div className="min-w-0 flex flex-col gap-5">
          {posts.length === 0 ? (
            <div className="text-center py-20 border border-[var(--border-subtle)] rounded-[var(--radius)] bg-[var(--bg-surface)]">
              <Calendar size={26} className="mx-auto text-[var(--text-faint)] mb-3" />
              <p className="text-[var(--text-primary)] text-[13px] font-medium">No posts yet</p>
              <p className="text-[var(--text-faint)] text-[12px] mt-1">Events and opportunities from your university will appear here</p>
            </div>
          ) : (
            posts.map((post) => {
              const key = `event-${post.id}`;
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
                />
              );
            })
          )}
        </div>

        {/* ── Right rail ── */}
        <aside className="hidden lg:flex flex-col gap-5">
          {/* Profile mini-card */}
          <div className="flex items-center gap-3">
            {userPhotoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={userPhotoURL} alt="" className="w-12 h-12 rounded-full object-cover" />
            ) : (
              <span className="w-12 h-12 rounded-full bg-[var(--accent-orange)] text-[var(--accent-ink)] flex items-center justify-center text-[18px] font-semibold">
                {(userName || 'U')[0]?.toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold text-[var(--text-primary)] truncate">{userName || 'Student'}</p>
              <p className="text-[11.5px] text-[var(--text-muted)] truncate">{[branch, universityName].filter(Boolean).join(' · ') || 'Welcome back'}</p>
            </div>
          </div>

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
          <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
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
          <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
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
