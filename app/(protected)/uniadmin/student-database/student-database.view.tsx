'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, deleteDoc } from 'firebase/firestore';
import Link from 'next/link';
import { Trash2, ExternalLink, UserPlus, Search, Filter, Briefcase, GraduationCap, Users } from 'lucide-react';

interface EducationEntry {
  cgpa?: string;
}

interface ExperienceEntry {
  role?: string;
  company?: string;
}

interface StudentRecord {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  title?: string;
  studentId?: string;
  rollNumber?: string;
  technicalSkills?: string;
  educationEntries?: EducationEntry[];
  experienceEntries?: ExperienceEntry[];
  projectEntries?: any[];
  achievementEntries?: any[];
  positionEntries?: any[];
  extracurricularEntries?: any[];
  photoURL?: string;
}

function parseSkills(raw?: string): string[] {
  if (!raw) return [];
  return raw
  .split(/[,\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseCgpa(value?: string): number | null {
  if (!value) return null;
  const num = Number(String(value).replace(/[^0-9.]/g, ''));
  if (Number.isNaN(num)) return null;
  return num;
}

function latestCgpa(student: StudentRecord): number | null {
  const entries = student.educationEntries || [];
  for (const entry of entries) {
    const cgpa = parseCgpa(entry.cgpa);
    if (cgpa !== null) return cgpa;
  }
  return null;
}

function internshipCount(student: StudentRecord): number {
  const entries = student.experienceEntries || [];
  return entries.filter((e) => {
    const role = (e.role || '').toLowerCase();
    return role.includes('intern');
  }).length;
}

export default function StudentDatabasePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [fetching, setFetching] = useState(true);
  const [adminUnivId, setAdminUnivId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [minCgpa, setMinCgpa] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push('/');
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
        setStudents(querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as StudentRecord));
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

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const cgpaThreshold = minCgpa ? Number(minCgpa) : null;

    return students.filter((s) => {
      const cgpa = latestCgpa(s);
      const searchable = [
        s.name || '',
        s.email || '',
        s.phone || '',
        s.studentId || '',
        s.rollNumber || '',
        s.technicalSkills || '',
        s.title || '',
        JSON.stringify(s.educationEntries || []),
        JSON.stringify(s.experienceEntries || []),
        JSON.stringify(s.projectEntries || []),
        JSON.stringify(s.achievementEntries || []),
        JSON.stringify(s.positionEntries || []),
        JSON.stringify(s.extracurricularEntries || []),
      ].join(' ').toLowerCase();

      const searchOk = !q || searchable.includes(q);

      const cgpaOk = cgpaThreshold === null || (cgpa !== null && cgpa >= cgpaThreshold);
      return !!(searchOk && cgpaOk);
    });
  }, [students, searchQuery, minCgpa]);

  const stats = useMemo(() => {
    const total = students.length;
    const cgpas = students.map((s) => latestCgpa(s)).filter((v): v is number => v !== null);
    const avgCgpa = cgpas.length > 0 ? cgpas.reduce((a, b) => a + b, 0) / cgpas.length : 0;
    const withInternships = students.filter((s) => internshipCount(s) > 0).length;

    return { total, avgCgpa, withInternships };
  }, [students]);

  if (loading || fetching) return (
    <div className="flex items-center justify-center h-64">
      <div className="loading-dots"><span /><span /><span /></div>
    </div>
  );

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-[-0.02em]">Centralized Student Repository</h1>
          <p className="text-[var(--text-tertiary)] text-[13px] mt-1">
            {adminUnivId && <span className="font-mono text-[#00A8E1]">{adminUnivId}</span>}
            {' · '}{students.length} student{students.length !== 1 ? 's' : ''} records
          </p>
        </div>
        <Link href="/uniadmin/create-account" className="btn-primary inline-flex items-center gap-2">
          <UserPlus size={14} /> Add Student
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <div className="window p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">Total Students</p>
          <p className="text-2xl font-bold text-[var(--text-primary)] mt-1 tabular-nums flex items-center gap-1.5"><Users size={16} className="text-[#00A8E1]" />{stats.total}</p>
        </div>
        <div className="window p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">Avg CGPA</p>
          <p className="text-2xl font-bold text-[var(--text-primary)] mt-1 tabular-nums flex items-center gap-1.5"><GraduationCap size={16} className="text-[#4B8BBE]" />{stats.avgCgpa > 0 ? stats.avgCgpa.toFixed(2) : 'N/A'}</p>
        </div>
        <div className="window p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">With Internships</p>
          <p className="text-2xl font-bold text-[var(--text-primary)] mt-1 tabular-nums flex items-center gap-1.5"><Briefcase size={16} className="text-[#F1A82C]" />{stats.withInternships}</p>
        </div>
      </div>

      <div className="window p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={14} className="text-[var(--text-faint)]" />
          <p className="text-[12px] font-semibold text-[var(--text-primary)]">Repository Filters</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
            <input
              type="text"
              placeholder="Search full profile: name, email, ID, skills, education, experience, projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[#4B8BBE] transition-all duration-150"
            />
          </div>

          <input
            type="number"
            step="0.01"
            min="0"
            max="10"
            value={minCgpa}
            onChange={(e) => setMinCgpa(e.target.value)}
            placeholder="Min CGPA"
            className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[#4B8BBE] transition-all duration-150"
          />

          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setMinCgpa('');
            }}
            className="btn-secondary text-[12px]"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {students.length === 0 ? (
        <div className="window p-12 text-center">
          <div className="divider-dashed mb-4" />
          <p className="text-[var(--text-muted)] text-[13px]">No students found for your university.</p>
          <div className="divider-dashed mt-4" />
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="window p-8 text-center">
          <p className="text-[var(--text-faint)] text-[13px]">No students match your filters.</p>
        </div>
      ) : (
        <div className="window overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px]">
              <thead>
                <tr className="border-b border-[var(--border-subtle)]">
                  <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">Student</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">Contact</th>
                  <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">Academics</th>
                  <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">Skills</th>
                  <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">Internships</th>
                  <th className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => {
                  const skills = parseSkills(student.technicalSkills);
                  const cgpa = latestCgpa(student);
                  const internships = internshipCount(student);

                  return (
                    <tr key={student.id} className="border-b border-[var(--border-subtle)]/50 hover:bg-[var(--bg-elevated)] transition-colors">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {student.photoURL ? (
                            <img src={student.photoURL} alt={student.name || 'Student'} className="w-8 h-8 rounded-full object-cover border border-[var(--border-subtle)] shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-[#4B8BBE]/10 flex items-center justify-center text-[#4B8BBE] text-xs font-bold shrink-0">
                              {student.name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-[12px] font-semibold text-[var(--text-primary)] truncate">{student.name || 'Unnamed Student'}</p>
                            <p className="text-[11px] text-[var(--text-faint)] font-mono truncate">{student.rollNumber || student.studentId || 'N/A'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-[12px] text-[var(--text-secondary)] truncate max-w-[180px]">{student.email || 'No email'}</p>
                        <p className="text-[11px] text-[var(--text-faint)]">{student.phone || 'No phone'}</p>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <p className="text-[12px] font-semibold text-[var(--text-primary)] tabular-nums">{cgpa !== null ? cgpa.toFixed(2) : 'N/A'}</p>
                        <p className="text-[10px] text-[var(--text-faint)]">CGPA</p>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <p className="text-[12px] font-semibold text-[var(--text-primary)] tabular-nums">{skills.length}</p>
                        <p className="text-[10px] text-[var(--text-faint)]">{skills.slice(0, 2).join(', ') || 'No skills'}</p>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <p className="text-[12px] font-semibold text-[var(--text-primary)] tabular-nums">{internships}</p>
                        <p className="text-[10px] text-[var(--text-faint)]">internship roles</p>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Link
                            href={`/uniadmin/students/view/${student.id}`}
                            className="p-1.5 rounded text-[var(--text-muted)] hover:text-[#4B8BBE] hover:bg-[#4B8BBE]/10 transition-colors duration-150"
                            title="View full profile"
                          >
                            <ExternalLink size={14} />
                          </Link>
                          <button
                            onClick={() => handleDeleteStudent(student.id, student.name || 'this student')}
                            disabled={deletingId === student.id}
                            className="p-1.5 rounded text-[var(--text-faint)] hover:text-[#00A8E1] hover:bg-[#00A8E1]/10 transition-colors duration-150 disabled:opacity-50"
                            title="Delete student"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}