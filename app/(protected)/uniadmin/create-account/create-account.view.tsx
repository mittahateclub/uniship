'use client';

import type { FormEvent } from 'react';

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
    <div className="max-w-lg mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--text-primary)] tracking-[-0.02em]">Register Student</h1>
        <p className="text-[var(--text-tertiary)] text-[13px] mt-1">
          University ID: <span className="font-mono text-[#00A8E1]">{adminUnivId || 'Loading...'}</span>
        </p>
      </div>

      <div className="window p-6">
        {error && (
          <div className="mb-4 p-3 rounded bg-[#00A8E1]/10 text-[#00A8E1] border border-[#00A8E1]/20 text-[13px] font-medium">{error}</div>
        )}
        {success && (
          <div className="mb-4 p-3 rounded bg-[#4CAF50]/10 text-[#4CAF50] border border-[#4CAF50]/20 text-[13px] font-medium">{success}</div>
        )}

        <form id="form" onSubmit={onSubmit} className="space-y-4">
          {FIELDS.map((f) => (
            <div key={f.name}>
              <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.07em] mb-1.5">{f.label} {f.required && '*'}</label>
              <input
                type={f.type} name={f.name} required={f.required}
                value={formData[f.name as keyof CreateAccountFormData]}
                onChange={onChange} disabled={submitting}
                className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-faint)] text-[13px] focus:outline-none focus:border-[#4B8BBE] transition-all duration-150 disabled:opacity-50"
              />
            </div>
          ))}
          <button type="submit" disabled={submitting || !adminUnivId} className="btn-primary w-full mt-2">
            {submitting ? 'Registering...' : 'Complete Registration'}
          </button>
        </form>
      </div>
    </div>
  );
}
