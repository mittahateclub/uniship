'use client';

import Link from 'next/link';
import { ArrowLeft, MapPin, CalendarDays, Wallet, Clock, CheckCircle2, Building2 } from '@/components/icons';

export interface Internship {
  id: string;
  companyName: string;
  role: string;
  location: string;
  stipend: string;
  duration: string;
  deadline: any;
  description: string;
  requirements?: string[];
  responsibilities?: string[];
}

export interface InternshipDetailViewProps {
  loading: boolean;
  internship: Internship | null;
  hasApplied: boolean;
  isApplying: boolean;
  onApply: () => void;
}

export function InternshipDetailView({ loading, internship, hasApplied, isApplying, onApply }: InternshipDetailViewProps) {
  if (loading) return <div className="flex items-center justify-center py-24"><div className="loading-dots"><span /><span /><span /></div></div>;
  if (!internship) return <div className="flex items-center justify-center py-24 text-[var(--text-tertiary)]">Internship not found.</div>;

  const facts = [
    { icon: MapPin, label: 'Location', value: internship.location },
    { icon: Wallet, label: 'Stipend', value: internship.stipend },
    { icon: Clock, label: 'Duration', value: internship.duration },
    { icon: CalendarDays, label: 'Deadline', value: internship.deadline?.toDate().toLocaleDateString() },
  ];

  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in">
      {/* Back */}
      <div className="pt-8 mb-5">
        <Link href="/user/internships" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
          <ArrowLeft size={14} /> College Space
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* ── Main content ── */}
        <div className="lg:col-span-2 space-y-5">
          {/* Title card */}
          <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
            <div className="flex items-center gap-1.5 mb-3">
              <Building2 size={14} className="text-[var(--accent-orange)]" />
              <span className="text-[12.5px] font-medium text-[var(--accent-orange)]">{internship.companyName}</span>
            </div>
            <h1 className="text-[26px] font-semibold tracking-[-0.025em] text-[var(--text-primary)] leading-tight">{internship.role}</h1>
            <p className="text-[var(--text-tertiary)] mt-1.5 text-[13.5px] flex items-center gap-1.5">
              <MapPin size={13} className="text-[var(--text-faint)]" />{internship.location}
            </p>
          </div>

          {/* About */}
          <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
            <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)] mb-3">About the Role</h3>
            <p className="leading-relaxed text-[var(--text-secondary)] text-[13.5px] whitespace-pre-wrap">{internship.description}</p>

            {internship.requirements && internship.requirements.length > 0 && (
              <>
                <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)] mb-3 mt-7">Requirements</h3>
                <ul className="space-y-2">
                  {internship.requirements.map((req, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[var(--text-secondary)] text-[13.5px]">
                      <CheckCircle2 size={15} className="text-[var(--accent-orange)] shrink-0 mt-0.5" />
                      <span>{req}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {internship.responsibilities && internship.responsibilities.length > 0 && (
              <>
                <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)] mb-3 mt-7">Responsibilities</h3>
                <ul className="space-y-2">
                  {internship.responsibilities.map((r, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[var(--text-secondary)] text-[13.5px]">
                      <CheckCircle2 size={15} className="text-[var(--accent-orange)] shrink-0 mt-0.5" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>

        {/* ── Sticky apply rail ── */}
        <div className="lg:sticky lg:top-4 space-y-4">
          <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
            <div className="divide-y divide-[var(--border-subtle)]">
              {facts.map((f) => (
                <div key={f.label} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-[8px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0 text-[var(--text-tertiary)]">
                    <f.icon size={14} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)]">{f.label}</p>
                    <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">{f.value || '—'}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-[var(--border-subtle)]">
              {hasApplied ? (
                <div className="flex items-center justify-center gap-2 py-2.5 rounded-[10px] bg-[var(--status-success)]/10 text-[var(--status-success)] text-[13px] font-semibold">
                  <CheckCircle2 size={15} /> Application Submitted
                </div>
              ) : (
                <button
                  onClick={onApply}
                  disabled={isApplying}
                  className="btn-primary w-full !py-3 text-sm font-semibold"
                >
                  {isApplying ? 'Processing…' : 'Apply Now'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
