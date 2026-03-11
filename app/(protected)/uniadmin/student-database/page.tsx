'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, deleteDoc } from 'firebase/firestore';
import Link from 'next/link';
import { Trash2, ExternalLink, UserPlus, Search } from 'lucide-react';

export default function StudentDatabasePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [students, setStudents] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);
  const [adminUnivId, setAdminUnivId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  async function fetchStudents() {
    if (!user) return;
    try {
      const adminDoc = await getDoc(doc(db, 'users', user.uid));
      const univId = adminDoc.data()?.universityId;
      setAdminUnivId(univId);
      if (univId) {
        const q = query(collection(db, 'users'), where('role', '==', 'student'), where('universityId', '==', univId));
        const querySnapshot = await getDocs(q);
        setStudents(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    } catch (error) {
      console.error("Error fetching students:", error);
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => { fetchStudents(); }, [user]);

  const handleDeleteStudent = async (studentId: string, studentName: string) => {
    if (!window.confirm(`Are you sure you want to delete ${studentName}?`)) return;
    setDeletingId(studentId);
    try {
      await deleteDoc(doc(db, 'users', studentId));
      setStudents(prev => prev.filter(s => s.id !== studentId));
    } catch (error) {
      console.error("Error deleting student:", error);
      alert("Failed to delete student. Check your permissions.");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading || fetching) return (
    <div className="flex items-center justify-center h-64">
      <div className="loading-dots"><span /><span /><span /></div>
    </div>
  );

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-[-0.02em]">Student Database</h1>
          <p className="text-[var(--text-tertiary)] text-[13px] mt-1">
            {adminUnivId && <span className="font-mono text-[#F54E00]">{adminUnivId}</span>}
            {' · '}{students.length} student{students.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/uniadmin/create-account" className="btn-primary inline-flex items-center gap-2">
          <UserPlus size={14} /> Add Student
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
        <input
          type="text"
          placeholder="Search by name, email, skills..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[#5E6AD2] transition-all duration-150"
        />
      </div>

      {students.length === 0 ? (
        <div className="window p-12 text-center">
          <div className="divider-dashed mb-4" />
          <p className="text-[var(--text-muted)] text-[13px]">No students found for your university.</p>
          <div className="divider-dashed mt-4" />
        </div>
      ) : (
        (() => {
          const q = searchQuery.toLowerCase();
          const filtered = q
            ? students.filter(s =>
                s.name?.toLowerCase().includes(q) ||
                s.email?.toLowerCase().includes(q) ||
                s.studentId?.toLowerCase().includes(q) ||
                s.rollNumber?.toLowerCase().includes(q) ||
                s.technicalSkills?.toLowerCase().includes(q) ||
                s.title?.toLowerCase().includes(q)
              )
            : students;
          return filtered.length === 0 ? (
            <div className="window p-8 text-center">
              <p className="text-[var(--text-faint)] text-[13px]">No students match your search.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((student) => {
                const eduCount = student.educationEntries?.length || 0;
                const expCount = student.experienceEntries?.length || 0;
                const projCount = student.projectEntries?.length || 0;
                const skills = student.technicalSkills
                  ? student.technicalSkills.split(/[,\n]+/).map((s: string) => s.trim()).filter(Boolean).slice(0, 5)
                  : [];

                return (
                  <div key={student.id} className="window p-4 hover:border-[var(--border-active)] transition-colors duration-150">
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      {student.photoURL ? (
                        <img src={student.photoURL} alt={student.name} className="w-10 h-10 rounded-full object-cover border border-[var(--border-subtle)] shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-[#5E6AD2]/10 flex items-center justify-center text-[#5E6AD2] text-sm font-bold shrink-0">
                          {student.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <h3 className="text-[13px] font-bold text-[var(--text-primary)] truncate">{student.name}</h3>
                          {(student.rollNumber || student.studentId) && (
                            <span className="text-[11px] font-mono text-[#F54E00] shrink-0">{student.rollNumber || student.studentId}</span>
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--text-muted)] truncate">{student.email}</p>
                        {student.title && <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{student.title}</p>}

                        {/* Stats */}
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-[10px] font-semibold text-[var(--text-faint)]">
                          {eduCount > 0 && <span>{eduCount} education</span>}
                          {expCount > 0 && <span>{expCount} experience</span>}
                          {projCount > 0 && <span>{projCount} project{projCount > 1 ? 's' : ''}</span>}
                        </div>

                        {/* Skills preview */}
                        {skills.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {skills.map((skill: string, i: number) => (
                              <span key={i} className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-[#5E6AD2]/8 text-[#5E6AD2] border border-[#5E6AD2]/15">
                                {skill}
                              </span>
                            ))}
                            {student.technicalSkills.split(/[,\n]+/).filter(Boolean).length > 5 && (
                              <span className="text-[9px] text-[var(--text-faint)] self-center">+{student.technicalSkills.split(/[,\n]+/).filter(Boolean).length - 5} more</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <Link href={`/uniadmin/students/view/${student.id}`}
                          className="p-1.5 rounded text-[var(--text-muted)] hover:text-[#5E6AD2] hover:bg-[#5E6AD2]/10 transition-colors duration-150"
                          title="View full profile"
                        >
                          <ExternalLink size={14} />
                        </Link>
                        <button
                          onClick={() => handleDeleteStudent(student.id, student.name)}
                          disabled={deletingId === student.id}
                          className="p-1.5 rounded text-[var(--text-faint)] hover:text-[#F54E00] hover:bg-[#F54E00]/10 transition-colors duration-150 disabled:opacity-50"
                          title="Delete student"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()
      )}
    </div>
  );
}