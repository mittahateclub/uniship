'use client';

import { Pencil, X, Shield } from '@/components/icons';
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* ── Identity rail ── */}
        <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 flex flex-col items-center text-center">
          <span className="w-20 h-20 rounded-full bg-[var(--accent-orange)] text-[var(--accent-ink)] flex items-center justify-center text-[28px] font-semibold mb-4">
            {initial}
          </span>
          <p className="text-[16px] font-semibold text-[var(--text-primary)] tracking-[-0.01em]">{displayName}</p>
          <span className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full text-[11.5px] font-medium bg-[var(--accent-orange)]/10 text-[var(--accent-orange)]">
            <Shield size={12} /> University Admin
          </span>
          <div className="w-full mt-5 pt-5 border-t border-[var(--border-subtle)] space-y-3 text-left">
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)]">Email</p>
              <p className="text-[12.5px] text-[var(--text-secondary)] truncate mt-0.5">{profileData.email}</p>
            </div>
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)]">University ID</p>
              <p className="text-[12.5px] font-mono text-[var(--accent-orange)] mt-0.5">{profileData.universityId}</p>
            </div>
          </div>
        </div>

        {/* ── Account details ── */}
        <div id="account-details" className="lg:col-span-2 rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
          <div className="flex justify-between items-center px-6 h-14 border-b border-[var(--border-subtle)]">
            <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">Account Details</h2>
            <button
              onClick={onToggleEdit}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-[10px] border border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:border-[var(--border-active)] transition-colors"
            >
              {isEditing ? <><X size={12} /> Cancel</> : <><Pencil size={12} /> Edit</>}
            </button>
          </div>

          <form onSubmit={onSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.07em] mb-1.5">Full Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    className="w-full px-3.5 py-2.5 text-[13px]"
                    value={formData.name}
                    onChange={(e) => onFormDataChange({...formData, name: e.target.value})}
                  />
                ) : (
                  <p className="text-[13px] text-[var(--text-primary)] py-2.5">{profileData.name || 'Not set'}</p>
                )}
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.07em] mb-1.5">Phone</label>
                {isEditing ? (
                  <input
                    type="text"
                    className="w-full px-3.5 py-2.5 text-[13px]"
                    value={formData.phone}
                    onChange={(e) => onFormDataChange({...formData, phone: e.target.value})}
                  />
                ) : (
                  <p className="text-[13px] text-[var(--text-primary)] py-2.5">{profileData.phone || 'Not set'}</p>
                )}
              </div>
            </div>

            {isEditing && (
              <button type="submit" className="btn-primary !rounded-[10px] mt-1">Save Changes</button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
