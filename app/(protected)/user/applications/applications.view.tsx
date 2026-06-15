'use client';

import { ClipboardCheck, Building2, CalendarDays, Clock, BadgeCheck, CheckCircle2, XCircle, Briefcase } from '@/components/icons';
import { ListSkeleton } from '@/components/Skeleton';

export interface Application {
  id: string;
  internshipRole: string;
  companyName: string;
  status: 'pending' | 'shortlisted' | 'selected' | 'rejected';
  appliedAt: any;
}

export interface ApplicationsViewProps {
  loading: boolean;
  applications: Application[];
}

type StatusKey = Application['status'];

const STATUS_CONFIG: Record<StatusKey, { label: string; pill: string; chip: string; icon: React.ComponentType<any> }> = {
  pending:     { label: 'Pending',     pill: 'bg-[var(--status-warning)]/10 text-[var(--status-warning)]', chip: 'bg-[var(--status-warning)]/10 text-[var(--status-warning)]', icon: Clock },
  shortlisted: { label: 'Shortlisted', pill: 'bg-[var(--type-event)]/12 text-[var(--type-event)]', chip: 'bg-[var(--type-event)]/12 text-[var(--type-event)]', icon: BadgeCheck },
  selected:    { label: 'Selected',    pill: 'bg-[var(--status-success)]/10 text-[var(--status-success)]', chip: 'bg-[var(--status-success)]/10 text-[var(--status-success)]', icon: CheckCircle2 },
  rejected:    { label: 'Rejected',    pill: 'bg-[var(--status-danger)]/10 text-[var(--status-danger)]',   chip: 'bg-[var(--status-danger)]/10 text-[var(--status-danger)]',   icon: XCircle },
};

export function ApplicationsView({ loading, applications }: ApplicationsViewProps) {
  if (loading) {
    return <ListSkeleton withStats rows={4} />;
  }

  const counts = applications.reduce(
    (acc, a) => { acc[a.status] = (acc[a.status] || 0) + 1; return acc; },
    {} as Record<StatusKey, number>,
  );

  const stats = [
    { icon: Briefcase, value: applications.length, label: 'Total', tone: 'text-[var(--text-faint)]' },
    { icon: Clock, value: counts.pending || 0, label: 'Pending', tone: 'text-[var(--status-warning)]' },
    { icon: BadgeCheck, value: counts.shortlisted || 0, label: 'Shortlisted', tone: 'text-[var(--type-event)]' },
    { icon: CheckCircle2, value: counts.selected || 0, label: 'Selected', tone: 'text-[var(--status-success)]' },
  ];

  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in">
      <div className="pt-8 mb-7">
        <h1 className="text-[26px] font-semibold text-[var(--text-primary)] tracking-[-0.025em]">My Applications</h1>
        <p className="text-[var(--text-tertiary)] text-[13.5px] mt-1.5">Track the status of your professional opportunities.</p>
      </div>

      {applications.length === 0 ? (
        <div className="text-center py-16 border border-[var(--border-subtle)] rounded-[var(--radius)] bg-[var(--bg-surface)]">
          <ClipboardCheck size={26} className="mx-auto text-[var(--text-faint)] mb-3" />
          <p className="text-[var(--text-primary)] text-[13px] font-medium">No applications found.</p>
          <p className="text-[var(--text-faint)] text-[12px] mt-1">Apply to internships to see them here.</p>
        </div>
      ) : (
        <>
          {/* ── Status summary strip ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden mb-6">
            {stats.map((s) => (
              <div key={s.label} className="p-4 border-b md:border-b-0 border-r border-[var(--border-subtle)] [&:nth-child(2n)]:border-r-0 md:[&:nth-child(2n)]:border-r md:last:!border-r-0">
                <div className={`flex items-center gap-1.5 mb-2.5 ${s.tone}`}>
                  <s.icon size={13} />
                  <span className="text-[10.5px] font-semibold uppercase tracking-[0.07em]">{s.label}</span>
                </div>
                <p className="text-[19px] font-semibold text-[var(--text-primary)] tabular-nums tracking-[-0.01em]">{s.value}</p>
              </div>
            ))}
          </div>

          {/* ── Application rows ── */}
          <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
            {applications.map((app) => {
              const cfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.pending;
              const StatusIcon = cfg.icon;
              const initial = (app.companyName || app.internshipRole || '•')[0]?.toUpperCase() ?? '•';
              return (
                <div key={app.id} className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4 border-b border-[var(--border-subtle)] last:border-b-0 transition-colors duration-150 hover:bg-[var(--bg-elevated)]">
                  {/* Company initial chip */}
                  <span className="hidden sm:flex w-9 h-9 rounded-[8px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] items-center justify-center shrink-0 text-[14px] font-semibold text-[var(--text-tertiary)]">
                    {initial}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Building2 size={11} className="text-[var(--text-faint)] shrink-0" />
                      <span className="text-[12px] font-medium text-[var(--text-secondary)] truncate">{app.companyName}</span>
                    </div>
                    <h2 className="text-[14px] font-semibold text-[var(--text-primary)] tracking-[-0.01em] truncate">{app.internshipRole}</h2>
                    <div className="flex items-center gap-1.5 text-[11.5px] text-[var(--text-faint)] mt-0.5">
                      <CalendarDays size={10} />
                      <span>Applied {app.appliedAt?.toDate?.().toLocaleDateString() || '—'}</span>
                    </div>
                  </div>

                  {/* Status pill */}
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-medium shrink-0 ${cfg.pill}`}>
                    <StatusIcon size={12} />
                    {cfg.label}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
