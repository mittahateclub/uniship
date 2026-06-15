'use client';

import type { FormEvent } from 'react';
import { UserPlus, Shield, Mail, Lock } from '@/components/icons';

export interface CreateAccountFormData {
  name: string;
  email: string;
  password: string;
  studentId: string;
  phone: string;
}

export interface CreateAccountViewProps {
  loading: boolean;
  adminUnivId: string | null;
  formData: CreateAccountFormData;
  submitting: boolean;
  error: string;
  success: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

const FIELDS = [
  { name: 'name', label: 'Full Name', type: 'text', required: true },
  { name: 'studentId', label: 'Student ID', type: 'text', required: true },
  { name: 'email', label: 'Email Address', type: 'email', required: true },
  { name: 'password', label: 'Temporary Password', type: 'password', required: true },
  { name: 'phone', label: 'Phone Number', type: 'tel', required: false },
] as const;

export function CreateAccountView({ loading, adminUnivId, formData, submitting, error, success, onChange, onSubmit }: CreateAccountViewProps) {
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="loading-dots"><span /><span /><span /></div>
    </div>
  );

  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in">
      <div className="pt-8 mb-7">
        <h1 className="text-[26px] font-semibold text-[var(--text-primary)] tracking-[-0.025em]">Register Student</h1>
        <p className="text-[var(--text-tertiary)] text-[13.5px] mt-1.5">
          Create a new student account scoped to <span className="font-mono text-[var(--accent-orange)]">{adminUnivId || '…'}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
        {/* ── Form ── */}
        <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
          {error && (
            <div className="mb-4 p-3 rounded-[var(--radius)] bg-[var(--status-danger)]/10 text-[var(--status-danger)] border border-[var(--status-danger)]/20 text-[13px] font-medium">{error}</div>
          )}
          {success && (
            <div className="mb-4 p-3 rounded-[var(--radius)] bg-[var(--status-success)]/10 text-[var(--status-success)] border border-[var(--status-success)]/20 text-[13px] font-medium">{success}</div>
          )}

          <form id="form" onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {FIELDS.map((f) => (
                <div key={f.name} className={f.name === 'email' ? 'sm:col-span-2' : ''}>
                  <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.07em] mb-1.5">{f.label} {f.required && <span className="text-[var(--accent-orange)]">*</span>}</label>
                  <input
                    type={f.type} name={f.name} required={f.required}
                    value={formData[f.name as keyof CreateAccountFormData]}
                    onChange={onChange} disabled={submitting}
                    className="w-full px-3.5 py-2.5 text-[13px] placeholder:text-[var(--text-faint)] disabled:opacity-50"
                  />
                </div>
              ))}
            </div>
            <button type="submit" disabled={submitting || !adminUnivId} className="btn-primary !rounded-[10px] w-full mt-2 inline-flex items-center justify-center gap-2">
              <UserPlus size={14} /> {submitting ? 'Registering…' : 'Complete Registration'}
            </button>
          </form>
        </div>

        {/* ── Info rail ── */}
        <aside className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
          <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)] mb-3">How it works</h3>
          <ul className="space-y-3">
            {[
              { icon: Mail, text: 'The student signs in with the email and temporary password you set here.' },
              { icon: Lock, text: 'They’ll be prompted to change the password after first login.' },
              { icon: Shield, text: 'Accounts are scoped to your university and appear in the Student Database.' },
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="w-7 h-7 rounded-[8px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0 text-[var(--text-tertiary)]">
                  <item.icon size={13} />
                </span>
                <span className="text-[12px] text-[var(--text-muted)] leading-relaxed pt-1">{item.text}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
