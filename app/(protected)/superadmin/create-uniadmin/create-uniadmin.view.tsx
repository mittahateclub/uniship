'use client';

import type { FormEvent } from 'react';
import Building2 from '@/components/icons/Building2';
import ChevronDown from '@/components/icons/ChevronDown';
import Search from '@/components/icons/Search';
import CheckCircle from '@/components/icons/CheckCircle';
import XCircle from '@/components/icons/XCircle';
import ShieldCheck from '@/components/icons/ShieldCheck';
import Mail from '@/components/icons/Mail';
import Lock from '@/components/icons/Lock';

export interface University {
  id: string;
  name: string;
  code: string;
  domain: string;
  verified: boolean;
}

export interface CreateUniadminFormData {
  name: string;
  email: string;
  password: string;
  phone: string;
}

export interface CreateUniadminViewProps {
  loading: boolean;
  loadingUnis: boolean;
  universities: University[];
  selectedUni: University | null;
  uniDropdownOpen: boolean;
  uniSearch: string;
  formData: CreateUniadminFormData;
  submitting: boolean;
  error: string;
  success: string;
  onToggleDropdown: () => void;
  onSelectUni: (uni: University) => void;
  onUniSearchChange: (q: string) => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

const FIELDS = [
  { name: 'name', label: 'Full Name', type: 'text', placeholder: "Admin's full name", required: true },
  { name: 'email', label: 'Email Address', type: 'email', placeholder: 'admin@university.edu', required: true },
  { name: 'password', label: 'Password', type: 'password', placeholder: 'Min 6 characters', required: true },
  { name: 'phone', label: 'Phone Number', type: 'tel', placeholder: 'Optional', required: false },
] as const;

const fieldLabel = 'block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.07em] mb-1.5';

export function CreateUniadminView({
  loading,
  loadingUnis,
  universities,
  selectedUni,
  uniDropdownOpen,
  uniSearch,
  formData,
  submitting,
  error,
  success,
  onToggleDropdown,
  onSelectUni,
  onUniSearchChange,
  onChange,
  onSubmit,
}: CreateUniadminViewProps) {
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="loading-dots"><span /><span /><span /></div>
    </div>
  );

  const filteredUnis = uniSearch
    ? universities.filter(u =>
        u.name.toLowerCase().includes(uniSearch.toLowerCase()) ||
        u.code.toLowerCase().includes(uniSearch.toLowerCase())
      )
    : universities;

  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in">
      <div className="pt-8 mb-7">
        <h1 className="text-[26px] font-semibold text-[var(--text-primary)] tracking-[-0.025em]">Create University Admin</h1>
        <p className="text-[var(--text-tertiary)] text-[13.5px] mt-1.5">Add a new university administrator and link them to a campus.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
        {/* ── Form ── */}
        <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
          <div className="flex items-center gap-2.5 px-6 h-14 border-b border-[var(--border-subtle)]">
            <span className="w-7 h-7 rounded-[8px] bg-[var(--accent-orange)]/10 text-[var(--accent-orange)] flex items-center justify-center shrink-0">
              <ShieldCheck size={14} />
            </span>
            <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">Admin details</h2>
          </div>

          <div className="p-6">
            {error && (
              <div className="mb-4 p-3 rounded-[var(--radius)] bg-[var(--status-danger)]/10 text-[var(--status-danger)] border border-[var(--status-danger)]/20 text-[13px] font-medium">{error}</div>
            )}
            {success && (
              <div className="mb-4 p-3 rounded-[var(--radius)] bg-[var(--status-success)]/10 text-[var(--status-success)] border border-[var(--status-success)]/20 text-[13px] font-medium">{success}</div>
            )}

            <form id="form" onSubmit={onSubmit} className="space-y-4">
              {/* University picker */}
              <div>
                <label className={fieldLabel}>University <span className="text-[var(--accent-orange)]">*</span></label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={onToggleDropdown}
                    className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-[var(--radius)] text-[13px] text-left hover:border-[var(--border-active)] transition-colors"
                  >
                    {selectedUni ? (
                      <span className="flex items-center gap-2 min-w-0">
                        <Building2 size={14} className="text-[var(--type-event)] shrink-0" />
                        <span className="text-[var(--text-primary)] truncate">{selectedUni.name}</span>
                        <span className="text-[11px] font-mono text-[var(--text-faint)] shrink-0">{selectedUni.code}</span>
                        {selectedUni.verified
                          ? <CheckCircle size={12} className="text-[var(--status-success)] shrink-0" />
                          : <XCircle size={12} className="text-[var(--status-warning)] shrink-0" />}
                      </span>
                    ) : (
                      <span className="text-[var(--text-faint)]">{loadingUnis ? 'Loading universities…' : 'Select a university'}</span>
                    )}
                    <ChevronDown size={14} className={`text-[var(--text-faint)] shrink-0 transition-transform ${uniDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {uniDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[10px] shadow-xl z-50 overflow-hidden">
                      <div className="p-2 border-b border-[var(--border-subtle)]">
                        <div className="relative">
                          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
                          <input
                            type="text" placeholder="Search universities…"
                            value={uniSearch} onChange={e => onUniSearchChange(e.target.value)}
                            className="w-full h-9 pl-9 pr-3 text-[12.5px] placeholder:text-[var(--text-faint)]"
                            autoFocus
                          />
                        </div>
                      </div>
                      <div className="max-h-52 overflow-y-auto">
                        {filteredUnis.length === 0 ? (
                          <div className="px-3 py-5 text-center text-[12px] text-[var(--text-faint)]">
                            {loadingUnis ? 'Loading…' : 'No universities found. Create one first.'}
                          </div>
                        ) : (
                          filteredUnis.map(uni => (
                            <button
                              key={uni.id} type="button"
                              onClick={() => onSelectUni(uni)}
                              className={`w-full px-3.5 py-2.5 text-left hover:bg-[var(--bg-surface)] transition-colors flex items-center gap-2.5 ${selectedUni?.id === uni.id ? 'bg-[var(--bg-surface)]' : ''}`}
                            >
                              <Building2 size={14} className="text-[var(--text-faint)] shrink-0" />
                              <span className="flex-1 min-w-0">
                                <span className="flex items-center gap-1.5">
                                  <span className="text-[13px] font-medium text-[var(--text-primary)] truncate">{uni.name}</span>
                                  {uni.verified
                                    ? <CheckCircle size={11} className="text-[var(--status-success)] shrink-0" />
                                    : <XCircle size={11} className="text-[var(--status-warning)] shrink-0" />}
                                </span>
                                <span className="text-[11px] font-mono text-[var(--text-faint)]">{uni.code}</span>
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {!selectedUni && universities.length === 0 && !loadingUnis && (
                  <p className="text-[11.5px] text-[var(--status-warning)] mt-1.5">
                    No universities registered. <a href="/superadmin/universities" className="underline">Create one first →</a>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {FIELDS.map((f) => (
                  <div key={f.name} className={f.name === 'email' ? 'sm:col-span-2' : ''}>
                    <label className={fieldLabel}>{f.label} {f.required && <span className="text-[var(--accent-orange)]">*</span>}</label>
                    <input
                      type={f.type} name={f.name} placeholder={f.placeholder} required={f.required}
                      value={formData[f.name as keyof CreateUniadminFormData]}
                      onChange={onChange} disabled={submitting}
                      className="w-full px-3.5 py-2.5 text-[13px] placeholder:text-[var(--text-faint)] disabled:opacity-50"
                    />
                  </div>
                ))}
              </div>

              <button type="submit" disabled={submitting || !selectedUni} className="btn-primary !rounded-[10px] w-full mt-2 inline-flex items-center justify-center gap-2 disabled:opacity-50">
                <ShieldCheck size={14} /> {submitting ? 'Creating account…' : 'Create University Admin'}
              </button>
            </form>
          </div>
        </div>

        {/* ── Info rail ── */}
        <aside className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
          <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)] mb-3">How it works</h3>
          <ul className="space-y-3">
            {[
              { icon: Building2, text: 'The admin is scoped to the university you pick — its code links their students & tests.' },
              { icon: Mail, text: 'They sign in with this email and the password you set here.' },
              { icon: Lock, text: 'New admins start unverified; verify them from Manage Admins.' },
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
