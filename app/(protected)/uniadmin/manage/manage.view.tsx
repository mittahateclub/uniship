'use client';

import { Search, Trash2 } from 'lucide-react';

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
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="loading-dots"><span /><span /><span /></div>
    </div>
  );

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-[-0.02em]">Manage Student Accounts</h1>
          <p className="text-[var(--text-tertiary)] text-[13px] mt-1">{filteredStudents.length} account{filteredStudents.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="relative w-56">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
          <input
            type="text"
            placeholder="Search students..."
            className="w-full pl-8 pr-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-faint)] text-[13px] focus:outline-none focus:border-[#4B8BBE] transition-all duration-150"
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
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Name</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Email</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Student ID</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] text-right">Actions</th>
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
                        className="p-1.5 rounded text-[var(--text-faint)] hover:text-[#00A8E1] hover:bg-[#00A8E1]/10 transition-colors duration-150"
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
