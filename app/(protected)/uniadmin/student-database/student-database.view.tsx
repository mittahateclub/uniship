'use client';
import { Link, useTransitionRouter } from 'next-view-transitions';

import { useAuth } from '@/contexts/AuthContext';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { db } from '@/lib/firebase';
import {
  collection, query, where, getDocs, doc, getDoc, deleteDoc, documentId,
  limit as queryLimit, orderBy, startAfter, type DocumentData,
  type QueryConstraint, type QueryDocumentSnapshot,
} from 'firebase/firestore';
import Trash2 from '@/components/icons/Trash2';
import UserPlus from '@/components/icons/UserPlus';
import Search from '@/components/icons/Search';
import Users from '@/components/icons/Users';
import GraduationCap from '@/components/icons/GraduationCap';
import Briefcase from '@/components/icons/Briefcase';
import ArrowLeft from '@/components/icons/ArrowLeft';
import ChevronRight from '@/components/icons/ChevronRight';
import { ListSkeleton } from '@/components/Skeleton';
import { StatBar } from '@/components/StatBar';
import { getCache, setCache } from '@/lib/page-cache';
import StudentProfileView from '@/app/(protected)/uniadmin/students/view/[id]/student-view.view';

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
  projectEntries?: unknown[];
  achievementEntries?: unknown[];
  positionEntries?: unknown[];
  extracurricularEntries?: unknown[];
  photoURL?: string;
}

const PAGE_SIZE = 50;

type CachedDb = { students: StudentRecord[]; univId: string | null };

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
  const router = useTransitionRouter();
  const cacheKey = user ? `uniadmin-students:${user.uid}` : '';
  const [students, setStudents] = useState<StudentRecord[]>(() => (cacheKey ? getCache<CachedDb>(cacheKey)?.students : undefined) ?? []);
  const [fetching, setFetching] = useState(() => !(cacheKey && getCache<CachedDb>(cacheKey)));
  const [adminUnivId, setAdminUnivId] = useState<string | null>(() => (cacheKey ? getCache<CachedDb>(cacheKey)?.univId : undefined) ?? null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [minCgpa, setMinCgpa] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lastStudentDoc, setLastStudentDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  const fetchStudents = useCallback(async () => {
    if (!user) return;
    try {
      const adminDoc = await getDoc(doc(db, 'users', user.uid));
      const univId = adminDoc.data()?.universityId;
      setAdminUnivId(univId);
      if (univId) {
        const q = query(
          collection(db, 'users'),
          where('role', '==', 'student'),
          where('universityId', '==', univId),
          orderBy(documentId()),
          queryLimit(PAGE_SIZE),
        );
        const querySnapshot = await getDocs(q);
        const list = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as StudentRecord);
        setStudents(list);
        setLastStudentDoc(querySnapshot.docs.at(-1) ?? null);
        setHasMore(querySnapshot.size === PAGE_SIZE);
        if (cacheKey) setCache<CachedDb>(cacheKey, { students: list, univId });
      }
    } catch (error) {
      console.error("Error fetching students:", error);
    } finally {
      setFetching(false);
    }
  }, [user, cacheKey]);

  const loadMore = async () => {
    if (!adminUnivId || !lastStudentDoc || loadingMore) return;
    setLoadingMore(true);
    try {
      const constraints: QueryConstraint[] = [
        where('role', '==', 'student'),
        where('universityId', '==', adminUnivId),
        orderBy(documentId()),
        startAfter(lastStudentDoc),
        queryLimit(PAGE_SIZE),
      ];
      const snapshot = await getDocs(query(collection(db, 'users'), ...constraints));
      setStudents((prev) => [
        ...prev,
        ...snapshot.docs.map((studentDoc) => ({ id: studentDoc.id, ...studentDoc.data() }) as StudentRecord),
      ]);
      setLastStudentDoc(snapshot.docs.at(-1) ?? lastStudentDoc);
      setHasMore(snapshot.size === PAGE_SIZE);
    } catch (error) {
      console.error('Error loading more students:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    const start = window.setTimeout(() => void fetchStudents(), 0);
    return () => window.clearTimeout(start);
  }, [fetchStudents]);

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

  if (loading || fetching) return <ListSkeleton rows={6} />;

  // ── In-page detail (the practice-style list↔detail pattern) ──
  if (selectedId) {
    return (
      <div className="max-w-[1200px] mx-auto animate-fade-in">
        <div className="pt-8 mb-5">
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ArrowLeft size={14} /> Back to students
          </button>
        </div>
        <StudentProfileView key={selectedId} studentId={selectedId} />
      </div>
    );
  }

  const hasFilters = searchQuery || minCgpa;

  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in">
      {/* ── Header ── */}
      <div className="pt-8 mb-7 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-semibold text-[var(--text-primary)] tracking-[-0.025em]">Centralized Student Repository</h1>
          <p className="text-[var(--text-tertiary)] text-[13.5px] mt-1.5">
            {adminUnivId && <span className="font-mono text-[var(--accent-orange)]">{adminUnivId}</span>}
            {adminUnivId && ' · '}{students.length} student record{students.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/uniadmin/create-account" className="btn-primary !rounded-[10px] inline-flex items-center gap-2 text-[12.5px] !px-3.5 !py-2">
          <UserPlus size={14} /> Add Student
        </Link>
      </div>

      {/* ── Overview — slim inline summary ── */}
      <StatBar
        className="mb-6"
        items={[
          { label: 'students', value: stats.total, icon: Users },
          { label: 'avg CGPA', value: stats.avgCgpa > 0 ? stats.avgCgpa.toFixed(2) : 'N/A', icon: GraduationCap },
          { label: 'with internships', value: stats.withInternships, icon: Briefcase },
        ]}
      />

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-2.5 mb-5">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
          <input
            type="text"
            placeholder="Search name, email, ID, skills, education, projects…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 text-[13px] placeholder:text-[var(--text-faint)]"
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
          className="w-full sm:w-32 h-9 px-3 text-[13px] placeholder:text-[var(--text-faint)]"
        />
        {hasFilters && (
          <button
            type="button"
            onClick={() => { setSearchQuery(''); setMinCgpa(''); }}
            className="h-9 px-3.5 text-[12.5px] font-medium rounded-[10px] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--border-active)] hover:text-[var(--text-primary)] transition-colors whitespace-nowrap"
          >
            Reset
          </button>
        )}
      </div>

      {/* ── Listing ── */}
      {students.length === 0 ? (
        <div className="text-center py-16 border border-[var(--border-subtle)] rounded-[var(--radius)] bg-[var(--bg-surface)]">
          <Users size={26} className="mx-auto text-[var(--text-faint)] mb-3" />
          <p className="text-[var(--text-primary)] text-[13px] font-medium">No students found for your university.</p>
          <p className="text-[var(--text-faint)] text-[12px] mt-1">Add a student to populate the repository.</p>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="text-center py-16 border border-[var(--border-subtle)] rounded-[var(--radius)] bg-[var(--bg-surface)]">
          <Search size={24} className="mx-auto text-[var(--text-faint)] mb-3" />
          <p className="text-[var(--text-primary)] text-[13px] font-medium">No students match your filters.</p>
          <p className="text-[var(--text-faint)] text-[12px] mt-1">Try a different search or reset the filters.</p>
        </div>
      ) : (
        <div id="directory" className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden scroll-mt-20">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px]">
              <thead>
                <tr className="border-b border-[var(--border-subtle)]">
                  <th className="px-4 sm:px-5 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)]">Student</th>
                  <th className="px-4 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)]">Contact</th>
                  <th className="px-4 py-2.5 text-center text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)]">Academics</th>
                  <th className="px-4 py-2.5 text-center text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)]">Skills</th>
                  <th className="px-4 py-2.5 text-center text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)]">Internships</th>
                  <th className="px-4 sm:px-5 py-2.5 text-right text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => {
                  const skills = parseSkills(student.technicalSkills);
                  const cgpa = latestCgpa(student);
                  const internships = internshipCount(student);

                  return (
                    <tr key={student.id} onClick={() => setSelectedId(student.id)} className="group border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-elevated)] transition-colors duration-150 cursor-pointer">
                      <td className="px-4 sm:px-5 py-3.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {student.photoURL ? (
                            // eslint-disable-next-line @next/next/no-img-element -- student profile photos can use arbitrary user-provided hosts.
                            <img src={student.photoURL} alt={student.name || 'Student'} className="w-8 h-8 rounded-full object-cover border border-[var(--border-subtle)] shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-[var(--type-event)]/12 flex items-center justify-center text-[var(--type-event)] text-[12px] font-semibold shrink-0">
                              {student.name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{student.name || 'Unnamed Student'}</p>
                            <p className="text-[11px] text-[var(--text-faint)] font-mono truncate">{student.rollNumber || student.studentId || 'N/A'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-[12.5px] text-[var(--text-secondary)] truncate max-w-[180px]">{student.email || 'No email'}</p>
                        <p className="text-[11px] text-[var(--text-faint)]">{student.phone || 'No phone'}</p>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <p className="text-[13px] font-semibold text-[var(--text-primary)] tabular-nums">{cgpa !== null ? cgpa.toFixed(2) : 'N/A'}</p>
                        <p className="text-[10px] text-[var(--text-faint)] uppercase tracking-[0.06em] mt-0.5">CGPA</p>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <p className="text-[13px] font-semibold text-[var(--text-primary)] tabular-nums">{skills.length}</p>
                        <p className="text-[10px] text-[var(--text-faint)] truncate max-w-[140px] mx-auto mt-0.5">{skills.slice(0, 2).join(', ') || 'No skills'}</p>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <p className="text-[13px] font-semibold text-[var(--text-primary)] tabular-nums">{internships}</p>
                        <p className="text-[10px] text-[var(--text-faint)] uppercase tracking-[0.06em] mt-0.5">roles</p>
                      </td>
                      <td className="px-4 sm:px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteStudent(student.id, student.name || 'this student'); }}
                            disabled={deletingId === student.id}
                            className="p-2 rounded-full text-[var(--text-faint)] hover:text-[var(--status-danger)] hover:bg-[var(--status-danger)]/10 transition-colors duration-150 disabled:opacity-50 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-within:opacity-100"
                            title="Delete student"
                          >
                            <Trash2 size={14} />
                          </button>
                          <ChevronRight size={15} className="text-[var(--text-faint)] group-hover:text-[var(--text-tertiary)] transition-colors" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {hasMore && !hasFilters && (
            <div className="flex justify-center p-3 border-t border-[var(--border-subtle)]">
              <button type="button" onClick={loadMore} disabled={loadingMore} className="btn-secondary !rounded-[10px] text-[12px] disabled:opacity-50">
                {loadingMore ? 'Loading…' : 'Load more students'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
