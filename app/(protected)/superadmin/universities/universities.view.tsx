'use client';

import { Building2, Plus, Search, CheckCircle, XCircle, Trash2, Shield, Users, X } from '@/components/icons';

export interface University {
  id: string;
  name: string;
  code: string;
  domain: string;
  verified: boolean;
  createdAt: any;
  adminCount?: number;
  studentCount?: number;
}

export interface UniversitiesViewProps {
  loading: boolean;
  loadingData: boolean;
  universities: University[];
  filtered: University[];
  searchTerm: string;
  showCreate: boolean;
  creating: boolean;
  newUni: { name: string; code: string; domain: string };
  error: string;
  onSearchTermChange: (q: string) => void;
  onShowCreate: () => void;
  onHideCreate: () => void;
  onNewUniChange: (uni: { name: string; code: string; domain: string }) => void;
  onCreate: (e: React.FormEvent) => void;
  onToggleVerification: (uni: University) => void;
  onDelete: (uni: University) => void;
}

export function UniversitiesView({
  loading,
  loadingData,
  universities,
  filtered,
  searchTerm,
  showCreate,
  creating,
  newUni,
  error,
  onSearchTermChange,
  onShowCreate,
  onHideCreate,
  onNewUniChange,
  onCreate,
  onToggleVerification,
  onDelete,
}: UniversitiesViewProps) {
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="loading-dots"><span /><span /><span /></div>
    </div>
  );

  return (
    <div className="max-w-[900px] mx-auto animate-fade-in">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)] tracking-[-0.02em]">Manage Universities</h1>
          <p className="text-[var(--text-tertiary)] text-[13px] mt-1">{universities.length} registered universit{universities.length !== 1 ? 'ies' : 'y'}</p>
        </div>
        <button onClick={onShowCreate} className="btn-primary inline-flex items-center gap-2">
          <Plus size={14} /> Add University
        </button>
      </div>

      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
        <input
          type="text" placeholder="Search universities..."
          value={searchTerm} onChange={e => onSearchTermChange(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[#4B8BBE] transition-all duration-150"
        />
      </div>

      {loadingData ? (
        <div className="flex items-center justify-center py-12">
          <div className="loading-dots"><span /><span /><span /></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="window p-12 text-center">
          <Building2 size={32} className="mx-auto text-[var(--text-faint)] mb-3" />
          <p className="text-[var(--text-tertiary)] text-[13px]">
            {searchTerm ? 'No universities match your search.' : 'No universities registered yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(uni => (
            <div key={uni.id} className="window p-4 hover:border-[var(--border-active)] transition-colors duration-150">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  uni.verified ? 'bg-[#4CAF50]/10' : 'bg-[var(--bg-surface)]'
                }`}>
                  <Building2 size={18} className={uni.verified ? 'text-[#4CAF50]' : 'text-[var(--text-faint)]'} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[14px] font-semibold text-[var(--text-primary)] truncate">{uni.name}</h3>
                    {uni.verified ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#4CAF50]/10 text-[#4CAF50] border border-[#4CAF50]/20">
                        <CheckCircle size={10} /> Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#F1A82C]/10 text-[#F1A82C] border border-[#F1A82C]/20">
                        <XCircle size={10} /> Pending
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[12px] text-[var(--text-tertiary)]">
                    <span className="font-mono text-[#00A8E1]">{uni.code}</span>
                    {uni.domain && <span>· {uni.domain}</span>}
                    <span className="flex items-center gap-1"><Shield size={10} /> {uni.adminCount} admin{uni.adminCount !== 1 ? 's' : ''}</span>
                    <span className="flex items-center gap-1"><Users size={10} /> {uni.studentCount} student{uni.studentCount !== 1 ? 's' : ''}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onToggleVerification(uni)}
                    className={`px-2.5 py-1.5 rounded text-[11px] font-semibold transition-colors duration-150 ${
                      uni.verified
                        ? 'text-[#F1A82C] hover:bg-[#F1A82C]/10'
                        : 'text-[#4CAF50] hover:bg-[#4CAF50]/10'
                    }`}
                  >
                    {uni.verified ? 'Revoke' : 'Verify'}
                  </button>
                  <button
                    onClick={() => onDelete(uni)}
                    className="p-1.5 rounded text-[var(--text-faint)] hover:text-[#00A8E1] hover:bg-[#00A8E1]/10 transition-colors duration-150"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4" onClick={onHideCreate}>
          <div className="window w-full max-w-md p-6 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-[#4B8BBE]" />
                <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Register University</h2>
              </div>
              <button onClick={onHideCreate} className="text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors">
                <X size={16} />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded bg-[#00A8E1]/10 text-[#00A8E1] border border-[#00A8E1]/20 text-[13px] font-medium">{error}</div>
            )}

            <form onSubmit={onCreate} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.07em] mb-1.5">University Name *</label>
                <input
                  type="text" required value={newUni.name}
                  onChange={e => onNewUniChange({ ...newUni, name: e.target.value })}
                  placeholder="e.g., Harvard University"
                  className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-faint)] text-[13px] focus:outline-none focus:border-[#4B8BBE] transition-all duration-150"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.07em] mb-1.5">University Code *</label>
                <input
                  type="text" required value={newUni.code}
                  onChange={e => onNewUniChange({ ...newUni, code: e.target.value })}
                  placeholder="e.g., HARV-001"
                  className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-faint)] text-[13px] focus:outline-none focus:border-[#4B8BBE] transition-all duration-150 uppercase"
                />
                <p className="text-[10px] text-[var(--text-faint)] mt-1">Unique identifier. Used to link admins & students.</p>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.07em] mb-1.5">Domain</label>
                <input
                  type="text" value={newUni.domain}
                  onChange={e => onNewUniChange({ ...newUni, domain: e.target.value })}
                  placeholder="e.g., harvard.edu"
                  className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-faint)] text-[13px] focus:outline-none focus:border-[#4B8BBE] transition-all duration-150"
                />
              </div>
              <button type="submit" disabled={creating} className="btn-primary w-full mt-2">
                {creating ? 'Registering...' : 'Register University'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
