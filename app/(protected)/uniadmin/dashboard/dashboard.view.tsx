'use client';
import { Link } from 'next-view-transitions';

import ClipboardCheck from '@/components/icons/ClipboardCheck';
import UserPlus from '@/components/icons/UserPlus';
import CalendarPlus from '@/components/icons/CalendarPlus';
import Database from '@/components/icons/Database';
import Settings from '@/components/icons/Settings';
import PlusCircle from '@/components/icons/PlusCircle';
import ArrowUpRight from '@/components/icons/ArrowUpRight';
import Users from '@/components/icons/Users';
import FileText from '@/components/icons/FileText';
import Monitor from '@/components/icons/Monitor';
import AlertTriangle from '@/components/icons/AlertTriangle';
import Clock from '@/components/icons/Clock';
import Calendar from '@/components/icons/Calendar';
import CheckCircle2 from '@/components/icons/CheckCircle2';
import { CardGridSkeleton } from '@/components/Skeleton';

export interface DashStats {
  students: number;
  tests: number;
  events: number;
  pendingApproval: number;
  flagged: number;
}

export interface UpcomingTest {
  id: string;
  title: string;
  examStart: string;
  examEnd: string | null;
  approved: boolean;
}

export interface UniAdminDashboardViewProps {
  loading: boolean;
  dataLoading: boolean;
  userName: string | null | undefined;
  stats: DashStats | null;
  liveSessions: number;
  upcoming: UpcomingTest[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtSchedule(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${h}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function relativeWindow(start: Date, end: Date, now: Date): { isLive: boolean; label: string } {
  if (start <= now && end >= now) return { isLive: true, label: 'Live now' };
  const diffMs = start.getTime() - now.getTime();
  const diffH = Math.floor(diffMs / 3_600_000);
  const diffM = Math.floor((diffMs % 3_600_000) / 60_000);
  const diffD = Math.floor(diffH / 24);
  if (diffD >= 1) return { isLive: false, label: `in ${diffD}d` };
  if (diffH >= 1) return { isLive: false, label: `in ${diffH}h ${diffM}m` };
  return { isLive: false, label: `in ${diffM}m` };
}

export function UniAdminDashboardView({
  loading, dataLoading, userName, stats, liveSessions, upcoming,
}: UniAdminDashboardViewProps) {
  if (loading) return <CardGridSkeleton />;

  const tools = [
    { title: 'Create AI Test', desc: 'Generate structured exam questions from a PDF', href: '/uniadmin/create-test', icon: PlusCircle },
    { title: 'Manage Tests', desc: 'Review, approve and share tests with students', href: '/uniadmin/tests', icon: ClipboardCheck },
    { title: 'Create Account', desc: 'Register a new student profile', href: '/uniadmin/create-account', icon: UserPlus },
    { title: 'Create Event', desc: 'Post workshops, seminars and listings', href: '/uniadmin/create-event', icon: CalendarPlus },
    { title: 'Student Database', desc: 'Browse all registered students', href: '/uniadmin/student-database', icon: Database },
    { title: 'Admin Profile', desc: 'Update your details and settings', href: '/uniadmin/profile', icon: Settings },
  ];

  const statsReady = !(dataLoading && stats === null);
  const metrics: Array<{
    label: string;
    value: number;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    href: string;
    note: string;
    valueClass?: string;
    pulse?: boolean;
    live?: boolean;
  }> = [
    { label: 'Students', value: stats?.students ?? 0, icon: Users, href: '/uniadmin/student-database', note: 'Registered' },
    { label: 'Tests', value: stats?.tests ?? 0, icon: FileText, href: '/uniadmin/tests', note: stats && stats.pendingApproval > 0 ? `${stats.pendingApproval} pending approval` : 'All approved' },
    { label: 'Live Now', value: liveSessions, icon: Monitor, href: '/uniadmin/proctoring', note: liveSessions > 0 ? 'Active sessions' : 'No live exams', valueClass: liveSessions > 0 ? 'text-[var(--status-success)]' : undefined, pulse: liveSessions > 0, live: true },
    { label: 'Flagged', value: stats?.flagged ?? 0, icon: AlertTriangle, href: '/uniadmin/proctoring', note: 'Submissions to review', valueClass: (stats?.flagged ?? 0) > 0 ? 'text-[var(--status-danger)]' : undefined },
  ];

  const now = new Date();

  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in">
      <div className="pt-8 mb-7">
        <h1 className="text-[26px] font-semibold text-[var(--text-primary)] tracking-[-0.025em]">University Admin Dashboard</h1>
        <p className="text-[var(--text-tertiary)] text-[13.5px] mt-1.5">Welcome back, <span className="text-[var(--text-primary)]">{userName}</span></p>
      </div>

      {/* Overview — quiet hairline metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden mb-10">
        {metrics.map((m, i) => (
          <Link
            key={m.label}
            href={m.href}
            className={`group p-5 transition-colors hover:bg-[var(--bg-elevated)] border-[var(--border-subtle)] ${i % 2 === 0 ? 'border-r' : 'lg:border-r'} ${i < 2 ? 'border-b lg:border-b-0' : ''} last:border-r-0`}
          >
            <div className="flex items-center justify-between mb-3.5">
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)]">{m.label}</span>
              <m.icon size={14} className="text-[var(--text-faint)] group-hover:text-[var(--text-tertiary)] transition-colors" />
            </div>
            <div className="flex items-center gap-2">
              {statsReady || m.live ? (
                <span className={`text-[27px] font-semibold tabular-nums tracking-[-0.03em] leading-none ${m.valueClass ?? 'text-[var(--text-primary)]'}`}>{m.value}</span>
              ) : (
                <span className="skeleton h-[26px] w-10 rounded" />
              )}
              {m.pulse && <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-success)] animate-pulse" />}
            </div>
            <p className="text-[11.5px] text-[var(--text-faint)] mt-2 truncate">{m.note}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-10 gap-y-10">
        {/* Quick actions */}
        <div className="lg:col-span-2">
          <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)] mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 stagger-children">
            {tools.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 hover:border-[var(--border-active)] hover:bg-[var(--bg-elevated)] transition-colors"
              >
                <div className="flex items-center justify-between mb-7">
                  <span className="w-9 h-9 rounded-[8px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center group-hover:border-[var(--border-active)] transition-colors">
                    <item.icon size={16} className="text-[var(--text-tertiary)] group-hover:text-[var(--accent-orange)] transition-colors" />
                  </span>
                  <ArrowUpRight size={15} className="text-[var(--text-faint)] opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition" />
                </div>
                <h3 className="text-[13.5px] font-semibold text-[var(--text-primary)] tracking-[-0.01em]">{item.title}</h3>
                <p className="text-[12px] text-[var(--text-muted)] mt-1 leading-relaxed">{item.desc}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Upcoming tests rail */}
        <div className="lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)]">Upcoming Tests</h2>
            <Link href="/uniadmin/tests" className="text-[11.5px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">View all</Link>
          </div>
          <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
            {!statsReady ? (
              <div className="divide-y divide-[var(--border-subtle)]">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="px-4 py-4 flex items-center gap-3">
                    <span className="skeleton w-8 h-8 rounded-[8px] shrink-0" />
                    <div className="flex-1 space-y-2">
                      <span className="skeleton h-3 w-3/4 rounded block" />
                      <span className="skeleton h-2.5 w-1/2 rounded block" />
                    </div>
                  </div>
                ))}
              </div>
            ) : upcoming.length === 0 ? (
              <div className="px-5 py-14 text-center">
                <Calendar size={22} className="mx-auto text-[var(--text-faint)] mb-3" />
                <p className="text-[12.5px] font-medium text-[var(--text-primary)]">No scheduled tests</p>
                <p className="text-[11.5px] text-[var(--text-faint)] mt-1">Tests you schedule will appear here</p>
                <Link href="/uniadmin/create-test" className="inline-flex items-center gap-1 mt-3.5 text-[12px] font-medium text-[var(--accent-orange)] hover:underline">
                  <PlusCircle size={13} /> Create a test
                </Link>
              </div>
            ) : (
              upcoming.map((t) => {
                const start = new Date(t.examStart);
                const end = t.examEnd ? new Date(t.examEnd) : start;
                const { isLive, label } = relativeWindow(start, end, now);
                return (
                  <Link
                    key={t.id}
                    href={`/uniadmin/tests/review/${t.id}`}
                    className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-elevated)] transition-colors"
                  >
                    <span className={`w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0 ${isLive ? 'bg-[var(--status-success)]/10' : 'bg-[var(--bg-elevated)] border border-[var(--border-subtle)]'}`}>
                      {isLive
                        ? <Monitor size={14} className="text-[var(--status-success)]" />
                        : <Clock size={14} className="text-[var(--text-tertiary)]" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12.5px] font-semibold text-[var(--text-primary)] truncate">{t.title}</span>
                        {isLive ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-[var(--status-success)] bg-[var(--status-success)]/10 px-1.5 py-0.5 rounded-full shrink-0">
                            <span className="w-1 h-1 rounded-full bg-[var(--status-success)] animate-pulse" /> LIVE
                          </span>
                        ) : (
                          <span className="text-[9px] font-semibold text-[var(--text-tertiary)] bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded-full shrink-0">{label}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[10.5px] text-[var(--text-faint)]">
                        <span>{fmtSchedule(t.examStart)}</span>
                        <span className="w-px h-2.5 bg-[var(--border-subtle)]" />
                        <span className={`inline-flex items-center gap-0.5 ${t.approved ? 'text-[var(--status-success)]' : 'text-[var(--status-warning)]'}`}>
                          {t.approved ? <CheckCircle2 size={9} /> : <AlertTriangle size={9} />}
                          {t.approved ? 'Approved' : 'Pending'}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
