'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';
import { UserPlus, Shield, Mail, Lock, User, Hash, Phone, Eye, EyeOff } from '@/components/icons';

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
  { name: 'name', label: 'Full Name', type: 'text', required: true, icon: User, full: false, placeholder: 'Aditya Rao' },
  { name: 'studentId', label: 'Student ID', type: 'text', required: true, icon: Hash, full: false, placeholder: 'se23uecm001' },
  { name: 'email', label: 'Email Address', type: 'email', required: true, icon: Mail, full: true, placeholder: 'student@university.edu' },
  { name: 'password', label: 'Temporary Password', type: 'password', required: true, icon: Lock, full: false, placeholder: 'Set a temporary password' },
  { name: 'phone', label: 'Phone Number', type: 'tel', required: false, icon: Phone, full: false, placeholder: 'Optional' },
] as const;

export function CreateAccountView({ loading, adminUnivId, formData, submitting, error, success, onChange, onSubmit }: CreateAccountViewProps) {
  const [showPw, setShowPw] = useState(false);

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
        <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
          <div className="flex items-center gap-2.5 px-6 h-14 border-b border-[var(--border-subtle)]">
            <span className="w-7 h-7 rounded-[8px] bg-[var(--accent-orange)]/10 text-[var(--accent-orange)] flex items-center justify-center shrink-0">
              <UserPlus size={14} />
            </span>
            <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">Account details</h2>
          </div>

          <div className="p-6">
            {error && (
              <div className="mb-4 p-3 rounded-[var(--radius)] bg-[var(--status-danger)]/10 text-[var(--status-danger)] border border-[var(--status-danger)]/20 text-[13px] font-medium">{error}</div>
            )}
            {success && (
              <div className="mb-4 p-3 rounded-[var(--radius)] bg-[var(--status-success)]/10 text-[var(--status-success)] border border-[var(--status-success)]/20 text-[13px] font-medium">{success}</div>
            )}

            <form id="form" onSubmit={onSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {FIELDS.map((f) => {
                  const isPw = f.name === 'password';
                  const Icon = f.icon;
                  return (
                    <div key={f.name} className={f.full ? 'sm:col-span-2' : ''}>
                      <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.07em] mb-1.5">
                        {f.label} {f.required && <span className="text-[var(--accent-orange)]">*</span>}
                      </label>
                      <div className="relative">
                        <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] pointer-events-none" />
                        <input
                          type={isPw ? (showPw ? 'text' : 'password') : f.type}
                          name={f.name}
                          required={f.required}
                          placeholder={f.placeholder}
                          value={formData[f.name]}
                          onChange={onChange}
                          disabled={submitting}
                          className={`w-full pl-9 ${isPw ? 'pr-10' : 'pr-3.5'} py-2.5 text-[13px] placeholder:text-[var(--text-faint)] disabled:opacity-50`}
                        />
                        {isPw && (
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => setShowPw((v) => !v)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text-secondary)] transition-colors"
                            title={showPw ? 'Hide password' : 'Show password'}
                          >
                            {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <button type="submit" disabled={submitting || !adminUnivId} className="btn-primary !rounded-[10px] w-full mt-2 inline-flex items-center justify-center gap-2">
                <UserPlus size={14} /> {submitting ? 'Registering…' : 'Complete Registration'}
              </button>
            </form>
          </div>
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
