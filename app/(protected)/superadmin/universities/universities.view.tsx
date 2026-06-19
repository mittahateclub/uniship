'use client';

import { Building2, Plus, Search, CheckCircle, XCircle, Trash2, Shield, Users } from '@/components/icons';
import { StatBar } from '@/components/StatBar';
import { Modal, ModalHeader, ModalBody } from '@/components/Modal';

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

const fieldLabel = 'block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.07em] mb-1.5';

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

  const verifiedCount = universities.filter(u => u.verified).length;
  const pendingCount = universities.length - verifiedCount;

  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in">
      {/* ── Header ── */}
      <div className="pt-8 mb-7 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-semibold text-[var(--text-primary)] tracking-[-0.025em]">Universities</h1>
          <p className="text-[var(--text-tertiary)] text-[13.5px] mt-1.5">{universities.length} registered universit{universities.length !== 1 ? 'ies' : 'y'}</p>
        </div>
        <button onClick={onShowCreate} className="btn-primary !rounded-[10px] inline-flex items-center gap-2 text-[12.5px] !px-3.5 !py-2">
          <Plus size={14} /> Add University
        </button>
      </div>

      {/* ── Overview ── */}
      <StatBar
        className="mb-6"
        items={[
          { label: 'universities', value: universities.length, icon: Building2 },
          { label: 'verified', value: verifiedCount, icon: CheckCircle, accent: verifiedCount > 0 ? 'text-[var(--status-success)]' : undefined },
          { label: 'pending', value: pendingCount, icon: XCircle, accent: pendingCount > 0 ? 'text-[var(--status-warning)]' : undefined },
        ]}
      />

      {/* ── Search ── */}
      <div className="relative mb-5">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
        <input
          type="text" placeholder="Search universities…"
          value={searchTerm} onChange={e => onSearchTermChange(e.target.value)}
          className="w-full h-9 pl-9 pr-3 text-[13px] placeholder:text-[var(--text-faint)]"
        />
      </div>

      {/* ── List ── */}
      {loadingData ? (
        <div className="flex items-center justify-center py-12"><div className="loading-dots"><span /><span /><span /></div></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-[var(--border-subtle)] rounded-[var(--radius)] bg-[var(--bg-surface)]">
          <Building2 size={26} className="mx-auto text-[var(--text-faint)] mb-3" />
          <p className="text-[var(--text-primary)] text-[13px] font-medium">{searchTerm ? 'No universities match your search.' : 'No universities registered yet.'}</p>
          <p className="text-[var(--text-faint)] text-[12px] mt-1">{searchTerm ? 'Try a different search.' : 'Add a university to get started.'}</p>
        </div>
      ) : (
        <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
          {filtered.map(uni => (
            <div key={uni.id} className="group flex items-center gap-3.5 px-4 sm:px-5 py-3.5 border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-elevated)] transition-colors">
              <span className={`w-10 h-10 rounded-[8px] flex items-center justify-center shrink-0 ${uni.verified ? 'bg-[var(--status-success)]/10 text-[var(--status-success)]' : 'bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-faint)]'}`}>
                <Building2 size={18} />
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-[14px] font-semibold text-[var(--text-primary)] truncate">{uni.name}</h3>
                  {uni.verified ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--status-success)]/10 text-[var(--status-success)] shrink-0">
                      <CheckCircle size={10} /> Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--status-warning)]/10 text-[var(--status-warning)] shrink-0">
                      <XCircle size={10} /> Pending
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11.5px] text-[var(--text-tertiary)]">
                  <span className="font-mono text-[var(--accent-orange)]">{uni.code}</span>
                  {uni.domain && <span>{uni.domain}</span>}
                  <span className="flex items-center gap-1"><Shield size={11} /> {uni.adminCount ?? 0} admin{uni.adminCount !== 1 ? 's' : ''}</span>
                  <span className="flex items-center gap-1"><Users size={11} /> {uni.studentCount ?? 0} student{uni.studentCount !== 1 ? 's' : ''}</span>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-within:opacity-100 transition-opacity">
                <button
                  onClick={() => onToggleVerification(uni)}
                  className={`px-2.5 py-1.5 rounded-[8px] text-[11px] font-semibold transition-colors ${uni.verified ? 'text-[var(--status-warning)] hover:bg-[var(--status-warning)]/10' : 'text-[var(--status-success)] hover:bg-[var(--status-success)]/10'}`}
                >
                  {uni.verified ? 'Revoke' : 'Verify'}
                </button>
                <button
                  onClick={() => onDelete(uni)}
                  className="p-2 rounded-full text-[var(--text-faint)] hover:text-[var(--status-danger)] hover:bg-[var(--status-danger)]/10 transition-colors"
                  title="Delete university"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create modal ── */}
      <Modal open={showCreate} onClose={onHideCreate} size="sm">
        <ModalHeader
          icon={Building2}
          iconClass="text-[var(--accent-orange)]"
          iconWrapClass="bg-[var(--accent-orange)]/10"
          title="Register University"
          onClose={onHideCreate}
        />
        <ModalBody>
          {error && (
            <div className="mb-4 p-3 rounded-[var(--radius)] bg-[var(--status-danger)]/10 text-[var(--status-danger)] border border-[var(--status-danger)]/20 text-[13px] font-medium">{error}</div>
          )}
          <form onSubmit={onCreate} className="space-y-4">
            <div>
              <label className={fieldLabel}>University Name <span className="text-[var(--accent-orange)]">*</span></label>
              <input
                type="text" required value={newUni.name}
                onChange={e => onNewUniChange({ ...newUni, name: e.target.value })}
                placeholder="e.g. Harvard University"
                className="w-full px-3.5 py-2.5 text-[13px] placeholder:text-[var(--text-faint)]"
              />
            </div>
            <div>
              <label className={fieldLabel}>University Code <span className="text-[var(--accent-orange)]">*</span></label>
              <input
                type="text" required value={newUni.code}
                onChange={e => onNewUniChange({ ...newUni, code: e.target.value })}
                placeholder="e.g. HARV-001"
                className="w-full px-3.5 py-2.5 text-[13px] placeholder:text-[var(--text-faint)] uppercase"
              />
              <p className="text-[11px] text-[var(--text-faint)] mt-1.5">Unique identifier — links admins & students to this campus.</p>
            </div>
            <div>
              <label className={fieldLabel}>Domain</label>
              <input
                type="text" value={newUni.domain}
                onChange={e => onNewUniChange({ ...newUni, domain: e.target.value })}
                placeholder="e.g. harvard.edu"
                className="w-full px-3.5 py-2.5 text-[13px] placeholder:text-[var(--text-faint)]"
              />
            </div>
            <button type="submit" disabled={creating} className="btn-primary !rounded-[10px] w-full mt-1 disabled:opacity-50">
              {creating ? 'Registering…' : 'Register University'}
            </button>
          </form>
        </ModalBody>
      </Modal>
    </div>
  );
}
