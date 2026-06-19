'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  collection, getDocs, query, where, doc, updateDoc, documentId,
  limit as queryLimit, orderBy, startAfter, type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Mail from '@/components/icons/Mail';
import Building2 from '@/components/icons/Building2';
import Hash from '@/components/icons/Hash';
import Phone from '@/components/icons/Phone';
import CheckCircle from '@/components/icons/CheckCircle';
import XCircle from '@/components/icons/XCircle';
import Save from '@/components/icons/Save';
import Search from '@/components/icons/Search';
import Users from '@/components/icons/Users';
import User from '@/components/icons/User';
import Pencil from '@/components/icons/Pencil';
import { StatBar } from '@/components/StatBar';
import { Modal, ModalHeader, ModalBody } from '@/components/Modal';

interface StudentData {
  id: string;
  name: string;
  email: string;
  studentId?: string;
  phone?: string;
  universityName?: string;
  universityId?: string;
  verified?: boolean;
  createdAt?: unknown;
}

interface University {
  id: string;
  name: string;
  code: string;
  verified: boolean;
}

const ghostBtn = 'px-2.5 py-1.5 rounded-[8px] text-[11px] font-semibold border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-active)] hover:text-[var(--text-primary)] transition-colors';
const fieldLabel = 'block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.07em] mb-1.5';
const PAGE_SIZE = 50;

export default function ManageStudentsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [students, setStudents] = useState<StudentData[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingStudent, setViewingStudent] = useState<StudentData | null>(null);
  const [editingStudent, setEditingStudent] = useState<StudentData | null>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [editForm, setEditForm] = useState({
    name: '',
    studentId: '',
    phone: '',
    universityId: '',
    verified: false,
  });
  const [lastStudentDoc, setLastStudentDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [studentsSnap, universitiesSnap] = await Promise.all([
          getDocs(query(collection(db, 'users'), where('role', '==', 'student'), orderBy(documentId()), queryLimit(PAGE_SIZE))),
          getDocs(collection(db, 'universities')),
        ]);

        const studentList: StudentData[] = studentsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as StudentData));
        const universityList: University[] = universitiesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as University));

        setStudents(studentList);
        setLastStudentDoc(studentsSnap.docs.at(-1) ?? null);
        setHasMore(studentsSnap.size === PAGE_SIZE);
        setUniversities(universityList);
      } catch (error) {
        console.error('Error fetching students:', error);
      } finally {
        setLoadingData(false);
      }
    }

    if (user) fetchData();
  }, [user]);

  const loadMore = async () => {
    if (!lastStudentDoc || loadingMore) return;
    setLoadingMore(true);
    try {
      const snapshot = await getDocs(query(
        collection(db, 'users'),
        where('role', '==', 'student'),
        orderBy(documentId()),
        startAfter(lastStudentDoc),
        queryLimit(PAGE_SIZE),
      ));
      setStudents((prev) => [
        ...prev,
        ...snapshot.docs.map((studentDoc) => ({ id: studentDoc.id, ...studentDoc.data() } as StudentData)),
      ]);
      setLastStudentDoc(snapshot.docs.at(-1) ?? lastStudentDoc);
      setHasMore(snapshot.size === PAGE_SIZE);
    } catch (error) {
      console.error('Error loading more students:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const formatDate = (value: unknown) => {
    try {
      if (!value) return 'N/A';
      if (typeof (value as { toDate?: unknown }).toDate === 'function') return (value as { toDate: () => Date }).toDate().toLocaleString();
      return new Date(value as string | number | Date).toLocaleString();
    } catch {
      return 'N/A';
    }
  };

  const openEdit = (student: StudentData) => {
    setEditError('');
    setEditingStudent(student);
    setEditForm({
      name: student.name || '',
      studentId: student.studentId || '',
      phone: student.phone || '',
      universityId: student.universityId || '',
      verified: !!student.verified,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingStudent) return;
    const selectedUniversity = universities.find((u) => u.code === editForm.universityId);
    if (!selectedUniversity) {
      setEditError('Please select a valid university.');
      return;
    }

    setSaving(true);
    setEditError('');
    try {
      const updates = {
        name: editForm.name.trim(),
        studentId: editForm.studentId.trim(),
        phone: editForm.phone.trim(),
        universityId: selectedUniversity.code,
        universityName: selectedUniversity.name,
        verified: editForm.verified,
        updatedAt: new Date(),
      };

      await updateDoc(doc(db, 'users', editingStudent.id), updates);
      setStudents((prev) => prev.map((s) => (s.id === editingStudent.id ? { ...s, ...updates } : s)));
      setEditingStudent(null);
    } catch (error) {
      console.error('Error updating student:', error);
      setEditError('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickVerifyToggle = async (student: StudentData) => {
    const nextVerified = !student.verified;
    try {
      await updateDoc(doc(db, 'users', student.id), { verified: nextVerified, updatedAt: new Date() });
      setStudents((prev) => prev.map((s) => (s.id === student.id ? { ...s, verified: nextVerified } : s)));
      setViewingStudent((prev) => (prev && prev.id === student.id ? { ...prev, verified: nextVerified } : prev));
    } catch (error) {
      console.error('Error toggling student verification:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-dots"><span /><span /><span /></div>
      </div>
    );
  }

  if (!user) return null;

  const filteredStudents = searchQuery
    ? students.filter((student) =>
        (student.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (student.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (student.studentId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (student.universityName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (student.universityId || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : students;

  const verifiedCount = students.filter((s) => s.verified).length;
  const unassignedCount = students.filter((s) => !s.universityId).length;

  const detailRows = (s: StudentData) => [
    { icon: Mail, label: 'Email', value: s.email },
    { icon: Hash, label: 'Student ID', value: s.studentId || 'N/A' },
    { icon: Building2, label: 'University', value: s.universityName ? `${s.universityName} (${s.universityId || '—'})` : 'Unassigned' },
    { icon: Phone, label: 'Phone', value: s.phone || 'N/A' },
  ];

  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in">
      {/* ── Header ── */}
      <div className="pt-8 mb-7">
        <h1 className="text-[26px] font-semibold text-[var(--text-primary)] tracking-[-0.025em]">Manage Students</h1>
        <p className="text-[var(--text-tertiary)] text-[13.5px] mt-1.5">View, verify and assign students across universities.</p>
      </div>

      {/* ── Overview ── */}
      <StatBar
        className="mb-6"
        items={[
          { label: 'students', value: students.length, icon: Users },
          { label: 'verified', value: verifiedCount, icon: CheckCircle, accent: verifiedCount > 0 ? 'text-[var(--status-success)]' : undefined },
          { label: 'unassigned', value: unassignedCount, icon: Building2, accent: unassignedCount > 0 ? 'text-[var(--status-warning)]' : undefined },
        ]}
      />

      {/* ── Search ── */}
      <div className="relative mb-5">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
        <input
          type="text"
          placeholder="Search by name, email, ID, university…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-9 pl-9 pr-3 text-[13px] placeholder:text-[var(--text-faint)]"
        />
      </div>

      {/* ── List ── */}
      {loadingData ? (
        <div className="flex items-center justify-center py-12"><div className="loading-dots"><span /><span /><span /></div></div>
      ) : filteredStudents.length === 0 ? (
        <div className="text-center py-16 border border-[var(--border-subtle)] rounded-[var(--radius)] bg-[var(--bg-surface)]">
          <Users size={26} className="mx-auto text-[var(--text-faint)] mb-3" />
          <p className="text-[var(--text-primary)] text-[13px] font-medium">{searchQuery ? 'No students match your search.' : 'No students found.'}</p>
          {searchQuery && <p className="text-[var(--text-faint)] text-[12px] mt-1">Try a different search.</p>}
        </div>
      ) : (
        <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
          {filteredStudents.map((student) => (
            <div key={student.id} className="group flex items-center gap-3.5 px-4 sm:px-5 py-3.5 border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-elevated)] transition-colors">
              <span className="w-10 h-10 rounded-full bg-[var(--type-event)]/15 text-[var(--type-event)] flex items-center justify-center text-[15px] font-bold shrink-0 uppercase">
                {student.name?.charAt(0)?.toUpperCase() || '?'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-[14px] font-semibold text-[var(--text-primary)] truncate">{student.name || 'Unnamed Student'}</h3>
                  {student.verified ? (
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
                  <span className="inline-flex items-center gap-1 min-w-0"><Mail size={11} className="shrink-0" /><span className="truncate">{student.email}</span></span>
                  <span className="inline-flex items-center gap-1"><Hash size={11} /> {student.studentId || 'N/A'}</span>
                  <span className="inline-flex items-center gap-1"><Building2 size={11} /> {student.universityName || 'Unassigned'}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-within:opacity-100 transition-opacity">
                <button onClick={() => setViewingStudent(student)} className={ghostBtn}>View</button>
                <button onClick={() => openEdit(student)} className={ghostBtn}>Edit</button>
              </div>
            </div>
          ))}
          {hasMore && !searchQuery && (
            <div className="flex justify-center p-3 border-t border-[var(--border-subtle)]">
              <button type="button" onClick={loadMore} disabled={loadingMore} className="btn-secondary !rounded-[10px] text-[12px] disabled:opacity-50">
                {loadingMore ? 'Loading…' : 'Load more students'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── View modal ── */}
      <Modal open={!!viewingStudent} onClose={() => setViewingStudent(null)} size="md">
        {viewingStudent && (
          <>
            <ModalHeader
              icon={User}
              iconClass={viewingStudent.verified ? 'text-[var(--status-success)]' : 'text-[var(--status-warning)]'}
              iconWrapClass={viewingStudent.verified ? 'bg-[var(--status-success)]/10' : 'bg-[var(--status-warning)]/10'}
              title={viewingStudent.name || 'Student details'}
              subtitle={viewingStudent.email}
              onClose={() => setViewingStudent(null)}
            />
            <ModalBody className="space-y-3">
              {detailRows(viewingStudent).map((row) => (
                <div key={row.label} className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-[8px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0 text-[var(--text-tertiary)]">
                    <row.icon size={15} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)]">{row.label}</p>
                    <p className="text-[13px] text-[var(--text-primary)] truncate">{row.value}</p>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between gap-2 pt-3 mt-1 border-t border-[var(--border-subtle)]">
                <span className="text-[11.5px] text-[var(--text-faint)]">Added {formatDate(viewingStudent.createdAt)}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleQuickVerifyToggle(viewingStudent)} className={ghostBtn}>
                    {viewingStudent.verified ? 'Mark pending' : 'Verify'}
                  </button>
                  <button
                    onClick={() => { openEdit(viewingStudent); setViewingStudent(null); }}
                    className="px-2.5 py-1.5 rounded-[8px] text-[11px] font-semibold bg-[var(--accent-orange)] text-[var(--accent-ink)] hover:opacity-90 transition-opacity inline-flex items-center gap-1.5"
                  >
                    <Pencil size={11} /> Edit
                  </button>
                </div>
              </div>
            </ModalBody>
          </>
        )}
      </Modal>

      {/* ── Edit modal ── */}
      <Modal open={!!editingStudent} onClose={() => setEditingStudent(null)} size="md">
        {editingStudent && (
          <>
            <ModalHeader
              icon={Pencil}
              title="Edit Student"
              subtitle={editingStudent.email}
              onClose={() => setEditingStudent(null)}
            />
            <ModalBody className="space-y-4">
              {editError && (
                <div className="p-3 rounded-[var(--radius)] bg-[var(--status-danger)]/10 text-[var(--status-danger)] border border-[var(--status-danger)]/20 text-[12.5px] font-medium">{editError}</div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={fieldLabel}>Full Name</label>
                  <input type="text" value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} className="w-full px-3.5 py-2.5 text-[13px]" />
                </div>
                <div>
                  <label className={fieldLabel}>Student ID</label>
                  <input type="text" value={editForm.studentId} onChange={(e) => setEditForm((p) => ({ ...p, studentId: e.target.value }))} className="w-full px-3.5 py-2.5 text-[13px]" />
                </div>
                <div>
                  <label className={fieldLabel}>Phone</label>
                  <input type="text" value={editForm.phone} onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))} className="w-full px-3.5 py-2.5 text-[13px]" />
                </div>
                <div>
                  <label className={fieldLabel}>University</label>
                  <select value={editForm.universityId} onChange={(e) => setEditForm((p) => ({ ...p, universityId: e.target.value }))} className="w-full px-3.5 py-2.5 text-[13px]">
                    <option value="">Select university</option>
                    {universities.map((uni) => (
                      <option key={uni.id} value={uni.code}>{uni.name} ({uni.code})</option>
                    ))}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2.5 text-[13px] text-[var(--text-primary)] cursor-pointer">
                <input type="checkbox" checked={editForm.verified} onChange={(e) => setEditForm((p) => ({ ...p, verified: e.target.checked }))} className="w-4 h-4 accent-[var(--accent-orange)]" />
                Mark student as verified
              </label>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setEditingStudent(null)} className="btn-secondary !rounded-[10px] flex-1">Cancel</button>
                <button onClick={handleSaveEdit} disabled={saving} className="btn-primary !rounded-[10px] flex-1 inline-flex items-center justify-center gap-2 disabled:opacity-50">
                  <Save size={13} /> {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </ModalBody>
          </>
        )}
      </Modal>
    </div>
  );
}
