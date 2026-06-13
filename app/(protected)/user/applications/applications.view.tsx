'use client';

import { ClipboardCheck, Building2, CalendarDays } from '@/components/icons';

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

function getStatusStyle(status: string) {
  switch (status) {
    case 'selected': return 'bg-[var(--status-success)]/10 text-[var(--status-success)]';
    case 'rejected': return 'bg-[var(--status-danger)]/10 text-[var(--status-danger)]';
    case 'shortlisted': return 'bg-[#4B8BBE]/12 text-[#4B8BBE]';
    default: return 'bg-[var(--status-warning)]/10 text-[var(--status-warning)]';
  }
}

export function ApplicationsView({ loading, applications }: ApplicationsViewProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-dots"><span /><span /><span /></div>
      </div>
    );
  }

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
        <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
          {applications.map((app) => (
            <div key={app.id} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 px-4 sm:px-5 py-4 border-b border-[var(--border-subtle)] last:border-b-0 transition-colors duration-150 hover:bg-[var(--bg-elevated)]">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <Building2 size={12} className="text-[var(--text-faint)]" />
                  <span className="text-[12px] font-medium text-[var(--text-secondary)]">{app.companyName}</span>
                </div>
                <h2 className="text-[14px] font-semibold text-[var(--text-primary)] tracking-[-0.01em] mb-1">{app.internshipRole}</h2>
                <div className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
                  <CalendarDays size={11} />
                  <span>Applied {app.appliedAt?.toDate().toLocaleDateString()}</span>
                </div>
              </div>
              <div className={`px-2.5 py-[3px] rounded-full text-[11.5px] font-medium capitalize ${getStatusStyle(app.status)}`}>
                {app.status}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
