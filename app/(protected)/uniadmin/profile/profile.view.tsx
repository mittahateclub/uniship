'use client';

import Link from 'next/link';
import { Pencil, X, Shield, User, Phone, Mail, Hash, Users, UserPlus, FileText, ChevronRight } from '@/components/icons';
import { ProfileSkeleton } from '@/components/Skeleton';

export interface UniadminProfileViewProps {
  loading: boolean;
  profileData: any;
  isEditing: boolean;
  formData: { name: string; phone: string };
  message: string;
  onToggleEdit: () => void;
  onFormDataChange: (data: { name: string; phone: string }) => void;
  onSubmit: (e: React.FormEvent) => void;
}

const SHORTCUTS = [
  { href: '/uniadmin/student-database', icon: Users, label: 'Student Database', sub: 'Browse & manage students' },
  { href: '/uniadmin/create-account', icon: UserPlus, label: 'Register Student', sub: 'Add a new account' },
  { href: '/uniadmin/tests', icon: FileText, label: 'Tests', sub: 'Create & review tests' },
  { href: '/uniadmin/proctoring', icon: Shield, label: 'Proctoring', sub: 'Monitor live exams' },
];

export function UniadminProfileView({
  loading,
  profileData,
  isEditing,
  formData,
  message,
  onToggleEdit,
  onFormDataChange,
  onSubmit,
}: UniadminProfileViewProps) {
  if (loading || !profileData) return <ProfileSkeleton />;

  const displayName = profileData.name || profileData.email?.split('@')[0] || 'Admin';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in">
      <div className="pt-8 mb-7">
        <h1 className="text-[26px] font-semibold text-[var(--text-primary)] tracking-[-0.025em]">Admin Profile</h1>
        <p className="text-[var(--text-tertiary)] text-[13.5px] mt-1.5">Manage your account details and university settings.</p>
      </div>

      {message && (
        <div className="mb-5 p-3 rounded-[var(--radius)] bg-[var(--status-success)]/10 text-[var(--status-success)] border border-[var(--status-success)]/20 text-[13px] font-medium">{message}</div>
      )}

      {/* ── Identity hero ── */}
      <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 mb-4 flex flex-col sm:flex-row sm:items-center gap-5">
        <span className="w-20 h-20 rounded-full bg-[var(--accent-orange)] text-[var(--accent-ink)] flex items-center justify-center text-[28px] font-semibold shrink-0">
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-[20px] font-semibold text-[var(--text-primary)] tracking-[-0.01em] truncate">{displayName}</h2>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-medium bg-[var(--accent-orange)]/10 text-[var(--accent-orange)] shrink-0">
              <Shield size={12} /> University Admin
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-2.5 text-[12.5px] text-[var(--text-tertiary)]">
            <span className="inline-flex items-center gap-1.5 min-w-0">
              <Mail size={13} className="text-[var(--text-faint)] shrink-0" />
              <span className="truncate">{profileData.email}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Hash size={13} className="text-[var(--text-faint)] shrink-0" />
              <span className="font-mono text-[var(--accent-orange)]">{profileData.universityId}</span>
            </span>
            {profileData.phone && (
              <span className="inline-flex items-center gap-1.5">
                <Phone size={13} className="text-[var(--text-faint)] shrink-0" />
                <span>{profileData.phone}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Content grid (even split) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Account details */}
        <div id="account-details" className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
          <div className="flex justify-between items-center px-5 h-14 border-b border-[var(--border-subtle)]">
            <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">Account Details</h2>
            <button
              onClick={onToggleEdit}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-[8px] border border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:border-[var(--border-active)] transition-colors"
            >
              {isEditing ? <><X size={12} /> Cancel</> : <><Pencil size={12} /> Edit</>}
            </button>
          </div>

          {isEditing ? (
            <form onSubmit={onSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.07em] mb-1.5">Full Name</label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] pointer-events-none" />
                  <input
                    type="text"
                    className="w-full pl-9 pr-3.5 py-2.5 text-[13px]"
                    value={formData.name}
                    onChange={(e) => onFormDataChange({ ...formData, name: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.07em] mb-1.5">Phone</label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] pointer-events-none" />
                  <input
                    type="text"
                    className="w-full pl-9 pr-3.5 py-2.5 text-[13px]"
                    value={formData.phone}
                    onChange={(e) => onFormDataChange({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>
              <button type="submit" className="btn-primary !rounded-[10px] w-full">Save Changes</button>
            </form>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {[
                { icon: User, label: 'Full Name', value: profileData.name },
                { icon: Phone, label: 'Phone', value: profileData.phone },
                { icon: Mail, label: 'Email', value: profileData.email },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-3 px-5 py-3.5">
                  <span className="w-9 h-9 rounded-[8px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0 text-[var(--text-tertiary)]">
                    <row.icon size={15} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)]">{row.label}</p>
                    <p className={`text-[13px] mt-0.5 truncate ${row.value ? 'text-[var(--text-primary)]' : 'text-[var(--text-faint)] italic'}`}>{row.value || 'Not set'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Workspace shortcuts */}
        <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
          <div className="flex items-center px-5 h-14 border-b border-[var(--border-subtle)]">
            <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">Workspace</h2>
          </div>
          <div>
            {SHORTCUTS.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="group flex items-center gap-3 px-5 py-3.5 border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-elevated)] transition-colors"
              >
                <span className="w-9 h-9 rounded-[8px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0 text-[var(--text-tertiary)] group-hover:text-[var(--accent-orange)] transition-colors">
                  <s.icon size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{s.label}</p>
                  <p className="text-[11.5px] text-[var(--text-faint)] truncate">{s.sub}</p>
                </div>
                <ChevronRight size={15} className="text-[var(--text-faint)] group-hover:text-[var(--text-tertiary)] transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
