'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User, Mail, Building2, Hash, Phone, CheckCircle, XCircle, X, Save, Search } from 'lucide-react';

interface StudentData {
  id: string;
  name: string;
  email: string;
  studentId?: string;
  phone?: string;
  universityName?: string;
  universityId?: string;
  verified?: boolean;
  createdAt?: any;
}

interface University {
  id: string;
  name: string;
  code: string;
  verified: boolean;
}

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

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [studentsSnap, universitiesSnap] = await Promise.all([
          getDocs(query(collection(db, 'users'), where('role', '==', 'student'))),
          getDocs(collection(db, 'universities')),
        ]);

        const studentList: StudentData[] = studentsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as StudentData));
        const universityList: University[] = universitiesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as University));

        setStudents(studentList);
        setUniversities(universityList);
      } catch (error) {
        console.error('Error fetching students:', error);
      } finally {
        setLoadingData(false);
      }
    }

    if (user) fetchData();
  }, [user]);

  const formatDate = (value: any) => {
    try {
      if (!value) return 'N/A';
      if (typeof value?.toDate === 'function') return value.toDate().toLocaleString();
      return new Date(value).toLocaleString();
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

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-[-0.02em]">Manage Students</h1>
        <p className="text-[var(--text-tertiary)] text-[13px] mt-1">View, verify, edit, and assign students to universities</p>
      </div>

      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
        <input
          type="text"
          placeholder="Search by name, email, student ID, university..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[#4B8BBE] transition-all duration-150"
        />
      </div>

      {loadingData ? (
        <div className="flex items-center justify-center py-12">
          <div className="loading-dots"><span /><span /><span /></div>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="window p-12 text-center">
          <p className="text-[var(--text-tertiary)]">No students found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredStudents.map((student) => (
            <div key={student.id} className="window p-5 group hover:border-[var(--border-active)] transition-colors duration-150">
              <div className="flex items-center justify-between mb-3">
                <div className="w-8 h-8 rounded bg-[#4B8BBE]/10 flex items-center justify-center text-[#4B8BBE] text-sm font-bold">
                  {student.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                {student.verified ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#4CAF50] bg-[#4CAF50]/10 border border-[#4CAF50]/20 px-1.5 py-0.5 rounded">
                    <CheckCircle size={9} /> Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#F1A82C] bg-[#F1A82C]/10 border border-[#F1A82C]/20 px-1.5 py-0.5 rounded">
                    <XCircle size={9} /> Pending
                  </span>
                )}
              </div>

              <h3 className="text-[15px] font-bold text-[var(--text-primary)] mb-3 truncate">{student.name || 'Unnamed Student'}</h3>

              <div className="space-y-2 text-[13px]">
                <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
                  <Mail size={12} className="text-[var(--text-faint)] shrink-0" />
                  <span className="truncate">{student.email}</span>
                </div>
                <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
                  <Hash size={12} className="text-[var(--text-faint)] shrink-0" />
                  <span>{student.studentId || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
                  <Building2 size={12} className="text-[var(--text-faint)] shrink-0" />
                  <span className="truncate">{student.universityName || 'Unassigned'}</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] flex gap-2">
                <button onClick={() => setViewingStudent(student)} className="btn-primary flex-1 text-[12px] py-1.5">View Details</button>
                <button onClick={() => openEdit(student)} className="btn-secondary flex-1 text-[12px] py-1.5">Edit</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewingStudent && (
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4" onClick={() => setViewingStudent(null)}>
          <div className="window w-full max-w-md p-6 animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-bold text-[var(--text-primary)]">Student Details</h2>
              <button onClick={() => setViewingStudent(null)} className="text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-[13px]">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[var(--text-faint)]">Name</p>
                <p className="text-[var(--text-primary)]">{viewingStudent.name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[var(--text-faint)]">Email</p>
                <p className="text-[var(--text-primary)]">{viewingStudent.email}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[var(--text-faint)]">Student ID</p>
                <p className="text-[var(--text-primary)]">{viewingStudent.studentId || 'N/A'}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[var(--text-faint)]">University</p>
                <p className="text-[var(--text-primary)]">{viewingStudent.universityName || 'N/A'} ({viewingStudent.universityId || 'N/A'})</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[var(--text-faint)]">Phone</p>
                <p className="text-[var(--text-primary)]">{viewingStudent.phone || 'N/A'}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[var(--text-faint)]">Status</p>
                <p className={viewingStudent.verified ? 'text-[#4CAF50] font-semibold' : 'text-[#F1A82C] font-semibold'}>
                  {viewingStudent.verified ? 'Verified' : 'Pending Verification'}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[var(--text-faint)]">Created At</p>
                <p className="text-[var(--text-primary)]">{formatDate(viewingStudent.createdAt)}</p>
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => handleQuickVerifyToggle(viewingStudent)}
                className={`flex-1 py-2 text-[12px] rounded border transition-colors ${
                  viewingStudent.verified
                    ? 'text-[#F1A82C] border-[#F1A82C]/30 hover:bg-[#F1A82C]/10'
                    : 'text-[#4CAF50] border-[#4CAF50]/30 hover:bg-[#4CAF50]/10'
                }`}
              >
                {viewingStudent.verified ? 'Mark as Pending' : 'Verify Student'}
              </button>
              <button
                onClick={() => {
                  openEdit(viewingStudent);
                  setViewingStudent(null);
                }}
                className="btn-primary flex-1 py-2 text-[12px]"
              >
                Edit Details
              </button>
            </div>
          </div>
        </div>
      )}

      {editingStudent && (
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4" onClick={() => setEditingStudent(null)}>
          <div className="window w-full max-w-md p-6 animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-bold text-[var(--text-primary)]">Edit Student</h2>
              <button onClick={() => setEditingStudent(null)} className="text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors">
                <X size={16} />
              </button>
            </div>

            {editError && (
              <div className="mb-3 p-2 rounded bg-[#00A8E1]/10 text-[#00A8E1] border border-[#00A8E1]/20 text-[12px]">
                {editError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[#4B8BBE]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1.5">Student ID</label>
                <input
                  type="text"
                  value={editForm.studentId}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, studentId: e.target.value }))}
                  className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[#4B8BBE]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1.5">Phone</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[#4B8BBE]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1.5">University</label>
                <select
                  value={editForm.universityId}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, universityId: e.target.value }))}
                  className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[#4B8BBE]"
                >
                  <option value="">Select university</option>
                  {universities.map((uni) => (
                    <option key={uni.id} value={uni.code}>{uni.name} ({uni.code})</option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 text-[13px] text-[var(--text-primary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.verified}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, verified: e.target.checked }))}
                />
                Mark student as verified
              </label>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setEditingStudent(null)} className="btn-secondary flex-1 py-2 text-[12px]">Cancel</button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="btn-primary flex-1 py-2 text-[12px] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save size={12} />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
