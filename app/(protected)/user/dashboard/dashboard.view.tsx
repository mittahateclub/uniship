'use client';

import Link from 'next/link';
import {
  FileText,
  Briefcase,
  ClipboardCheck,
  BarChart3,
  Calendar as CalendarIcon,
  User,
  ArrowRight,
  Download,
  Sparkles,
  TrendingUp,
  MapPin,
  Clock,
} from '@/components/icons';

export interface CalendarEvent {
  id: string;
  title: string;
  date: Date | null;
  type: string;
  description: string;
  location?: string;
  company?: string;
}

export interface DashboardViewProps {
  loading: boolean;
  todayEvents: CalendarEvent[];
}

const EVENT_TYPE_STYLES: Record<string, { bg: string; border: string; text: string; icon: string; label: string }> = {
  event:      { bg: 'rgba(75,139,190,0.12)', border: 'rgba(75,139,190,0.3)',  text: '#4B8BBE', icon: '#4B8BBE', label: 'Event' },
  internship: { bg: 'rgba(0,193,110,0.12)',  border: 'rgba(0,193,110,0.3)',   text: '#00C16E', icon: '#00C16E', label: 'Internship' },
  hackathon:  { bg: 'rgba(0,168,225,0.12)',  border: 'rgba(0,168,225,0.3)',   text: '#00A8E1', icon: '#00A8E1', label: 'Hackathon' },
  research:   { bg: 'rgba(241,168,44,0.12)', border: 'rgba(241,168,44,0.3)',  text: '#F1A82C', icon: '#F1A82C', label: 'Research' },
  workshop:   { bg: 'rgba(224,77,176,0.12)', border: 'rgba(224,77,176,0.3)',  text: '#E04DB0', icon: '#E04DB0', label: 'Workshop' },
};

export function DashboardView({ loading, todayEvents }: DashboardViewProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-dots"><span /><span /><span /></div>
      </div>
    );
  }

  const menuItems = [
    { title: 'Test Portal', desc: 'Take assessments, mock tests, and track your exam readiness', href: '/user/test-portal', icon: FileText },
    { title: 'College Space', desc: 'Explore events, internships, and campus opportunities', href: '/user/internships', icon: Briefcase },
    { title: 'Applications', desc: 'Track your submissions and application statuses in one place', href: '/user/applications', icon: ClipboardCheck },
    { title: 'AI Resume Builder', desc: 'Craft a professional resume with intelligent AI suggestions', href: '/user/resume', icon: Sparkles },
    { title: 'Export Resume', desc: 'Download your polished resume as a print-ready A4 PDF', href: '/user/resume/download', icon: Download },
    { title: 'Results', desc: 'View scores, percentiles, and detailed performance breakdowns', href: '/user/results', icon: BarChart3 },
    { title: 'Practice', desc: 'Sharpen your skills with curated problems and timed challenges', href: '/user/practice', icon: TrendingUp },
    { title: 'Profile', desc: 'Manage your academic details and account preferences', href: '/user/profile', icon: User },
  ];

  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in">
      <style>{`
        .dash-card {
          position: relative;
          overflow: hidden;
          border-radius: var(--radius);
          border: 1px solid var(--border-subtle);
          background: var(--bg-surface);
          transition: border-color 0.2s ease, background 0.2s ease;
          cursor: pointer;
        }
        .dash-card:hover {
          border-color: var(--border-active);
          background: var(--bg-elevated);
        }
        .dash-card::before {
          content: '';
          position: absolute;
          inset: 0;
          opacity: 0;
          transition: opacity 0.2s ease;
          background: radial-gradient(420px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255,255,255,0.04), transparent 40%);
          pointer-events: none;
        }
        .dash-card:hover::before {
          opacity: 1;
        }
        [data-theme='light'] .dash-card::before {
          background: radial-gradient(420px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(0,0,0,0.025), transparent 40%);
        }
        .dash-card-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
          color: var(--text-tertiary);
          transition: color 0.2s ease, border-color 0.2s ease;
        }
        .dash-card:hover .dash-card-icon {
          color: var(--text-primary);
          border-color: var(--border-active);
        }
        .dash-card .card-arrow {
          transition: all 0.2s ease;
          opacity: 0;
          transform: translateX(-4px);
        }
        .dash-card:hover .card-arrow {
          opacity: 0.6;
          transform: translateX(0);
        }
      `}</style>

      {/* ── Page header ── */}
      <div className="pt-8 mb-6">
        <h1 className="text-[26px] font-semibold tracking-[-0.025em] text-[var(--text-primary)]">Dashboard</h1>
      </div>

      {/* ── Today's Events ── */}
      <Link
        href="/user/calendar"
        className="group block rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] mb-8 no-underline hover:border-[var(--border-active)] transition-colors duration-200 overflow-hidden"
        style={{ textDecoration: 'none' }}
      >
        <div className="flex items-center justify-between px-5 h-11 border-b border-[var(--border-subtle)]">
          <div className="flex items-baseline gap-2.5">
            <h2 className="text-[13px] font-semibold text-[var(--text-primary)] tracking-[-0.01em]">Today&apos;s Events</h2>
            <span className="text-[11.5px] text-[var(--text-faint)]">
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </div>
          <span className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--accent-orange)]">
            <CalendarIcon size={12} />
            View Calendar
            <ArrowRight size={12} className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </span>
        </div>

        <div className="px-5 py-3.5">
          {todayEvents.length === 0 ? (
            <p className="flex items-center gap-2 text-[12.5px] text-[var(--text-muted)]">
              <CalendarIcon size={13} className="text-[var(--text-faint)]" />
              No events scheduled for today
            </p>
          ) : (
            <div className="flex flex-col">
              {todayEvents.map(ev => {
                const style = EVENT_TYPE_STYLES[ev.type] || EVENT_TYPE_STYLES.event;
                return (
                  <div
                    key={ev.id}
                    className="flex items-center gap-3 py-2.5 border-b border-[var(--border-subtle)] last:border-b-0"
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: style.text }} />
                    <span className="text-[11.5px] font-medium shrink-0" style={{ color: style.text }}>
                      {style.label}
                    </span>
                    <span className="text-[13px] text-[var(--text-primary)] truncate">{ev.title}</span>
                    <div className="flex items-center gap-3 shrink-0 ml-auto text-[11.5px] text-[var(--text-muted)]">
                      {ev.date && (
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {ev.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                      {ev.location && (
                        <span className="hidden sm:flex items-center gap-1">
                          <MapPin size={10} />
                          {ev.location}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Link>

      {/* ── Tools ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 stagger-children">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="dash-card group"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
              e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
            }}
          >
            <div className="relative z-10 p-4 flex flex-col h-full min-h-[128px]">
              <div className="dash-card-icon">
                <item.icon size={15} />
              </div>
              <div className="mt-auto pt-4">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-[13.5px] font-semibold text-[var(--text-primary)] tracking-[-0.01em]">{item.title}</h3>
                  <ArrowRight size={12} className="card-arrow text-[var(--text-faint)]" />
                </div>
                <p className="text-[var(--text-muted)] text-[12px] mt-1 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
