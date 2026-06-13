'use client';

import Link from 'next/link';
import { FileText, Clock, HelpCircle, Tag, ArrowRight, Calendar } from '@/components/icons';

export interface Test {
  id: string;
  title: string;
  description: string;
  duration: number;
  totalQuestions: number;
  category: string;
  examStart?: string;
  examEnd?: string;
  approved?: boolean;
  published?: boolean;
  sourceType?: string;
}

export interface TestPortalViewProps {
  loading: boolean;
  tests: Test[];
}

export function TestPortalView({ loading, tests }: TestPortalViewProps) {
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
        <h1 className="text-[26px] font-semibold text-[var(--text-primary)] tracking-[-0.025em]">Tests</h1>
        <p className="text-[var(--text-tertiary)] text-[13.5px] mt-1.5">Select a test to begin.</p>
      </div>

      {tests.length === 0 ? (
        <div className="text-center py-16 border border-[var(--border-subtle)] rounded-[var(--radius)] bg-[var(--bg-surface)]">
          <FileText size={26} className="mx-auto text-[var(--text-faint)] mb-3" />
          <p className="text-[var(--text-primary)] text-[13px] font-medium">No tests available at the moment.</p>
          <p className="text-[var(--text-faint)] text-[12px] mt-1">New tests will appear here when published.</p>
        </div>
      ) : (
        <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
          {tests.map((test) => {
            const now = new Date();
            const start = test.examStart ? new Date(test.examStart) : null;
            const end = test.examEnd ? new Date(test.examEnd) : null;
            const isActive = (!start || now >= start) && (!end || now <= end);
            const isUpcoming = start && now < start;
            const isExpired = end && now > end;

            return (
              <div
                key={test.id}
                className={`group flex items-start gap-4 px-4 sm:px-5 py-4 border-b border-[var(--border-subtle)] last:border-b-0 transition-colors duration-150 ${
                  isActive ? 'hover:bg-[var(--bg-elevated)]' : 'opacity-60'
                }`}
              >
                {/* Icon chip */}
                <div className="hidden sm:flex w-9 h-9 rounded-[8px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] items-center justify-center shrink-0 mt-0.5">
                  <FileText size={15} className="text-[var(--text-tertiary)]" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="text-[14px] font-semibold text-[var(--text-primary)] tracking-[-0.01em]">{test.title}</h3>
                    <span className="inline-flex items-center gap-1 bg-[var(--accent-orange)]/10 text-[var(--accent-orange)] px-2 py-[2px] rounded-full text-[10.5px] font-medium">
                      <Tag size={9} />
                      {test.category}
                    </span>
                    {isActive && start && (
                      <span className="inline-flex items-center gap-1 bg-[var(--status-success)]/10 text-[var(--status-success)] px-2 py-[2px] rounded-full text-[10.5px] font-medium">
                        <span className="w-1 h-1 rounded-full bg-current" />
                        Live
                      </span>
                    )}
                    {isUpcoming && (
                      <span className="inline-flex items-center bg-[#4B8BBE]/12 text-[#4B8BBE] px-2 py-[2px] rounded-full text-[10.5px] font-medium">
                        Upcoming
                      </span>
                    )}
                    {isExpired && (
                      <span className="inline-flex items-center bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-faint)] px-2 py-[2px] rounded-full text-[10.5px] font-medium">
                        Ended
                      </span>
                    )}
                  </div>

                  <p className="text-[12.5px] text-[var(--text-muted)] leading-relaxed line-clamp-2 mb-1.5">{test.description}</p>

                  <div className="flex items-center gap-3 flex-wrap text-[11.5px] text-[var(--text-faint)]">
                    {(start || end) && (
                      <span className="flex items-center gap-1.5">
                        <Calendar size={11} />
                        {start && <span>{start.toLocaleDateString([], { month: 'short', day: 'numeric' })} {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                        {start && end && <span>—</span>}
                        {end && <span>{end.toLocaleDateString([], { month: 'short', day: 'numeric' })} {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      {test.duration} min
                    </span>
                    <span className="flex items-center gap-1">
                      <HelpCircle size={11} />
                      {test.totalQuestions} questions
                    </span>
                  </div>
                </div>

                {/* Action */}
                <div className="shrink-0 self-center">
                  {isActive ? (
                    <Link
                      href={`/user/test-portal/${test.id}`}
                      className="btn-primary !rounded-[10px] flex items-center gap-1.5 text-[12px] !py-1.5 !px-3.5"
                    >
                      Start
                      <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform duration-150" />
                    </Link>
                  ) : (
                    <span className="text-[11.5px] text-[var(--text-faint)] font-medium whitespace-nowrap">
                      {isUpcoming ? `Opens ${start!.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : 'Closed'}
                    </span>
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
