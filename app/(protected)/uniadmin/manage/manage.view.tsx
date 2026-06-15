'use client';

import { Search, Trash2 } from '@/components/icons';
import { ListSkeleton } from '@/components/Skeleton';

export interface StudentAccount {
  id: string;
  name: string;
  email: string;
  studentId?: string;
  createdAt: any;
}

export interface ManageViewProps {
  loading: boolean;
  loadingData: boolean;
  filteredStudents: StudentAccount[];
  searchTerm: string;
  onSearchTermChange: (q: string) => void;
  onDelete: (studentId: string) => void;
}

export function ManageView({ loading, loadingData, filteredStudents, searchTerm, onSearchTermChange, onDelete }: ManageViewProps) {
  if (loading) return <ListSkeleton rows={6} leadingChip={false} />;

  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in">
      <div className="pt-8 mb-7 flex justify-between items-center">
        <div>
          <h1 className="text-[26px] font-semibold text-[var(--text-primary)] tracking-[-0.025em]">Manage Student Accounts</h1>
          <p className="text-[var(--text-tertiary)] text-[13.5px] mt-1.5">{filteredStudents.length} account{filteredStudents.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="relative w-56">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
          <input
            type="text"
            placeholder="Search students..."
            className="w-full pl-8 pr-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-faint)] text-[13px] focus:outline-none focus:border-[var(--type-event)] transition-all duration-150"
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
          />
        </div>
      </div>

      {loadingData ? (
        <div className="flex items-center justify-center py-12">
          <div className="loading-dots"><span /><span /><span /></div>
        </div>
      ) : (
        <div className="window overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[var(--border-subtle)]">
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--text-muted)]">Name</th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--text-muted)]">Email</th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--text-muted)]">Student ID</th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--text-muted)] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {filteredStudents.map((student) => (
                <tr key={student.id} className="hover:bg-[var(--bg-elevated)] transition-colors duration-150">
                  <td className="px-4 py-3 text-[13px] font-semibold text-[var(--text-primary)]">{student.name || 'Unnamed Student'}</td>
                  <td className="px-4 py-3 text-[13px] text-[var(--text-tertiary)]">{student.email || 'No email'}</td>
                  <td className="px-4 py-3 text-[13px] font-mono text-[var(--text-tertiary)] tabular-nums">{student.studentId || 'N/A'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button className="btn-secondary text-[11px] px-3 py-1">Edit</button>
                      <button
                        onClick={() => onDelete(student.id)}
                        className="p-1.5 rounded text-[var(--text-faint)] hover:text-[var(--status-danger)] hover:bg-[var(--status-danger)]/10 transition-colors duration-150"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
