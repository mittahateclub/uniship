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
  Info,
  MapPin,
  Clock,
} from 'lucide-react';

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

const cardArt: Record<string, React.ReactNode> = {
  tests: (
    <svg className="absolute right-0 top-0 h-full w-1/2" viewBox="0 0 200 200" fill="none">
      <rect x="30" y="20" width="60" height="80" rx="4" stroke="currentColor" strokeWidth="2"/>
      <line x1="45" y1="45" x2="75" y2="45" stroke="currentColor" strokeWidth="2"/>
      <line x1="45" y1="58" x2="70" y2="58" stroke="currentColor" strokeWidth="2"/>
      <line x1="45" y1="71" x2="65" y2="71" stroke="currentColor" strokeWidth="2"/>
      <circle cx="140" cy="60" r="35" stroke="currentColor" strokeWidth="2"/>
      <path d="M125 60l10 10 20-20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="110" y="120" width="50" height="50" rx="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3"/>
      <circle cx="50" cy="150" r="20" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3"/>
    </svg>
  ),
  college: (
    <svg className="absolute right-0 top-0 h-full w-1/2" viewBox="0 0 200 200" fill="none">
      <path d="M100 30L30 65v40l70 35 70-35V65L100 30z" stroke="currentColor" strokeWidth="2"/>
      <path d="M100 100v50" stroke="currentColor" strokeWidth="2"/>
      <path d="M30 65v40" stroke="currentColor" strokeWidth="2"/>
      <circle cx="30" cy="115" r="6" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="130" y="130" width="40" height="40" rx="4" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3"/>
      <circle cx="60" cy="160" r="15" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3"/>
    </svg>
  ),
  applications: (
    <svg className="absolute right-0 top-0 h-full w-1/2" viewBox="0 0 200 200" fill="none">
      <rect x="40" y="25" width="55" height="70" rx="4" stroke="currentColor" strokeWidth="2"/>
      <rect x="50" y="35" width="35" height="4" rx="1" fill="currentColor"/>
      <rect x="50" y="45" width="28" height="4" rx="1" fill="currentColor"/>
      <rect x="50" y="55" width="32" height="4" rx="1" fill="currentColor"/>
      <path d="M120 50l30 30M150 50l-30 30" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M110 120h60v50H110z" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" rx="4"/>
      <circle cx="60" cy="140" r="18" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3"/>
      <path d="M52 140l5 5 11-11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  resume: (
    <svg className="absolute right-0 top-0 h-full w-1/2" viewBox="0 0 200 200" fill="none">
      <rect x="50" y="20" width="60" height="80" rx="4" stroke="currentColor" strokeWidth="2"/>
      <circle cx="80" cy="42" r="10" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="62" y="60" width="36" height="3" rx="1" fill="currentColor"/>
      <rect x="62" y="68" width="28" height="3" rx="1" fill="currentColor"/>
      <rect x="62" y="76" width="32" height="3" rx="1" fill="currentColor"/>
      <path d="M140 60c0-20-15-30-15-30s-15 10-15 30 15 30 15 30 15-10 15-30z" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="125" cy="60" r="5" fill="currentColor" opacity="0.4"/>
      <path d="M30 140l15-15 12 12 18-18 15 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  export: (
    <svg className="absolute right-0 top-0 h-full w-1/2" viewBox="0 0 200 200" fill="none">
      <rect x="50" y="30" width="50" height="65" rx="3" stroke="currentColor" strokeWidth="2"/>
      <path d="M75 110v40M60 135l15 15 15-15" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="130" y="50" width="35" height="45" rx="3" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3"/>
      <circle cx="35" cy="140" r="15" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3"/>
    </svg>
  ),
  results: (
    <svg className="absolute right-0 top-0 h-full w-1/2" viewBox="0 0 200 200" fill="none">
      <rect x="30" y="120" width="20" height="50" rx="2" fill="currentColor" opacity="0.3"/>
      <rect x="60" y="90" width="20" height="80" rx="2" fill="currentColor" opacity="0.3"/>
      <rect x="90" y="60" width="20" height="110" rx="2" fill="currentColor" opacity="0.3"/>
      <rect x="120" y="40" width="20" height="130" rx="2" fill="currentColor" opacity="0.3"/>
      <path d="M30 110 Q75 30 150 50" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="150" cy="50" r="5" fill="currentColor" opacity="0.5"/>
    </svg>
  ),
  practice: (
    <svg className="absolute right-0 top-0 h-full w-1/2" viewBox="0 0 200 200" fill="none">
      <rect x="40" y="50" width="120" height="100" rx="6" stroke="currentColor" strokeWidth="2"/>
      <path d="M80 90l15 15 25-30" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="40" y1="75" x2="160" y2="75" stroke="currentColor" strokeWidth="1.5" opacity="0.4"/>
      <circle cx="55" cy="62" r="4" fill="currentColor" opacity="0.3"/>
      <circle cx="70" cy="62" r="4" fill="currentColor" opacity="0.3"/>
      <circle cx="85" cy="62" r="4" fill="currentColor" opacity="0.3"/>
      <rect x="55" y="120" width="90" height="8" rx="2" fill="currentColor" opacity="0.1"/>
    </svg>
  ),
  profile: (
    <svg className="absolute right-0 top-0 h-full w-1/2" viewBox="0 0 200 200" fill="none">
      <circle cx="100" cy="60" r="25" stroke="currentColor" strokeWidth="2"/>
      <path d="M55 140c0-25 20-45 45-45s45 20 45 45" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <rect x="130" y="25" width="35" height="35" rx="17.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3"/>
      <circle cx="40" cy="130" r="12" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3"/>
    </svg>
  ),
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
    { title: 'Test Portal', desc: 'Take assessments, mock tests, and track your exam readiness', href: '/user/test-portal', icon: FileText, art: cardArt.tests },
    { title: 'College Space', desc: 'Explore events, internships, and campus opportunities', href: '/user/internships', icon: Briefcase, art: cardArt.college },
    { title: 'Applications', desc: 'Track your submissions and application statuses in one place', href: '/user/applications', icon: ClipboardCheck, art: cardArt.applications },
    { title: 'AI Resume Builder', desc: 'Craft a professional resume with intelligent AI suggestions', href: '/user/resume', icon: Sparkles, art: cardArt.resume },
    { title: 'Export Resume', desc: 'Download your polished resume as a print-ready A4 PDF', href: '/user/resume/download', icon: Download, art: cardArt.export },
    { title: 'Results', desc: 'View scores, percentiles, and detailed performance breakdowns', href: '/user/results', icon: BarChart3, art: cardArt.results },
    { title: 'Practice', desc: 'Sharpen your skills with curated problems and timed challenges', href: '/user/practice', icon: TrendingUp, art: cardArt.practice },
    { title: 'Profile', desc: 'Manage your academic details and account preferences', href: '/user/profile', icon: User, art: cardArt.profile },
  ];

  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in">
      <style>{`
        .dash-card {
          position: relative;
          overflow: hidden;
          border-radius: 10px;
          border: 1px solid var(--border-subtle);
          background: var(--bg-surface);
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
        }
        .dash-card:hover {
          border-color: var(--border-active);
          transform: translateY(-1px);
          box-shadow: 0 4px 20px -4px rgba(0,0,0,0.15);
        }
        .dash-card::before {
          content: '';
          position: absolute;
          inset: 0;
          opacity: 0;
          transition: opacity 0.2s ease;
          background: radial-gradient(500px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255,255,255,0.03), transparent 40%);
          pointer-events: none;
        }
        .dash-card:hover::before {
          opacity: 1;
        }
        [data-theme='light'] .dash-card::before {
          background: radial-gradient(500px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(0,0,0,0.02), transparent 40%);
        }
        .dash-card-icon {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
          transition: border-color 0.2s ease;
        }
        .dash-card:hover .dash-card-icon {
          border-color: var(--border-active);
        }
        .dash-card .card-arrow {
          transition: all 0.2s ease;
          opacity: 0;
          transform: translateX(-4px);
        }
        .dash-card:hover .card-arrow {
          opacity: 0.5;
          transform: translateX(0);
        }
        .dash-card .card-art {
          transition: opacity 0.3s ease;
          color: var(--text-faint);
          opacity: 0.4;
        }
        .dash-card:hover .card-art {
          opacity: 0.6;
        }
        [data-theme='light'] .dash-card:hover {
          box-shadow: 0 4px 20px -4px rgba(0,0,0,0.08);
        }
      `}</style>

      {/* ── Today's Events ── */}
      <Link href="/user/calendar" className="group relative block overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 sm:p-5 mt-5 mb-6 no-underline hover:border-[var(--border-active)] transition-all duration-200" style={{ textDecoration: 'none' }}>
        <svg className="absolute right-0 top-0 h-full w-2/5 opacity-[0.12] text-[#00A8E1] pointer-events-none" viewBox="0 0 300 200" fill="none">
          <rect x="30" y="20" width="120" height="110" rx="8" stroke="currentColor" strokeWidth="2.5"/>
          <line x1="30" y1="50" x2="150" y2="50" stroke="currentColor" strokeWidth="2"/>
          <circle cx="55" cy="35" r="4" fill="currentColor" opacity="0.6"/>
          <circle cx="125" cy="35" r="4" fill="currentColor" opacity="0.6"/>
          <line x1="55" y1="20" x2="55" y2="10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="125" y1="20" x2="125" y2="10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
          <rect x="42" y="62" width="18" height="14" rx="2" fill="currentColor" opacity="0.15"/>
          <rect x="68" y="62" width="18" height="14" rx="2" fill="currentColor" opacity="0.15"/>
          <rect x="94" y="62" width="18" height="14" rx="2" fill="currentColor" opacity="0.15"/>
          <rect x="120" y="62" width="18" height="14" rx="2" fill="currentColor" opacity="0.15"/>
          <rect x="42" y="84" width="18" height="14" rx="2" fill="currentColor" opacity="0.15"/>
          <rect x="68" y="84" width="18" height="14" rx="2" fill="currentColor" opacity="0.25"/>
          <rect x="94" y="84" width="18" height="14" rx="2" fill="currentColor" opacity="0.15"/>
          <rect x="120" y="84" width="18" height="14" rx="2" fill="currentColor" opacity="0.15"/>
          <rect x="42" y="106" width="18" height="14" rx="2" fill="currentColor" opacity="0.15"/>
          <rect x="68" y="106" width="18" height="14" rx="2" fill="currentColor" opacity="0.15"/>
          <circle cx="220" cy="70" r="35" stroke="currentColor" strokeWidth="2"/>
          <path d="M220 70V48" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <path d="M220 70L240 80" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <circle cx="220" cy="70" r="3" fill="currentColor" opacity="0.5"/>
        </svg>

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <CalendarIcon size={15} className="text-[#00A8E1]" />
              <h2 className="text-[13px] font-bold text-[var(--text-primary)] tracking-[-0.01em]">Today&apos;s Events</h2>
              <span className="text-[11px] text-[var(--text-faint)]">
                {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
            </div>

            {todayEvents.length === 0 ? (
              <div className="flex items-center gap-2 py-2">
                <CalendarIcon size={14} className="text-[var(--text-faint)]" />
                <p className="text-[12px] text-[var(--text-muted)]">No events scheduled for today</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {todayEvents.map(ev => {
                  const style = EVENT_TYPE_STYLES[ev.type] || EVENT_TYPE_STYLES.event;
                  return (
                    <div
                      key={ev.id}
                      className="flex items-center gap-3 px-4 py-2.5 rounded-lg border"
                      style={{ background: style.bg, borderColor: style.border }}
                    >
                      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 border" style={{ borderColor: style.text, color: style.text }}>
                        <Info size={13} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[13px] font-semibold" style={{ color: style.text }}>
                          {style.label}
                        </span>
                        <span className="text-[13px] text-[var(--text-secondary)] mx-1.5">—</span>
                        <span className="text-[13px] text-[var(--text-primary)]">{ev.title}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-[11px] text-[var(--text-muted)]">
                        {ev.date && (
                          <span className="flex items-center gap-1">
                            <Clock size={10} />
                            {ev.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                        {ev.location && (
                          <span className="flex items-center gap-1 hidden sm:flex">
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

          <div className="shrink-0 flex items-center justify-center sm:justify-end">
            <div className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#00A8E1]/10 border border-[#00A8E1]/20 text-[12px] text-[#00A8E1] font-semibold group-hover:bg-[#00A8E1]/20 transition-all duration-150">
              <CalendarIcon size={12} />
              View Calendar
              <ArrowRight size={12} />
            </div>
          </div>
        </div>
      </Link>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 stagger-children">
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
            <div className="card-art pointer-events-none">
              {item.art}
            </div>

            <div className="relative z-10 p-5 flex flex-col h-full min-h-[150px]">
              <div className="flex items-start justify-between mb-auto">
                <div className="dash-card-icon">
                  <item.icon size={16} className="text-[#00A8E1]" />
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-[13px] font-semibold text-[var(--text-primary)] tracking-[-0.01em]">{item.title}</h3>
                  <ArrowRight size={12} className="card-arrow text-[var(--text-faint)]" />
                </div>
                <p className="text-[var(--text-muted)] text-[11px] mt-1 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
