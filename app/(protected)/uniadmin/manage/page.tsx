'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Search, Trash2 } from 'lucide-react';

interface StudentAccount {
  id: string;
  name: string;
  email: string;
  studentId?: string;
  createdAt: any;
}

export default function ManageAccountsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [students, setStudents] = useState<StudentAccount[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  const fetchStudents = async () => {
    if (!user) return;
    try {
      setLoadingData(true);
      const adminDoc = await getDoc(doc(db, 'users', user.uid));
      const univId = adminDoc.data()?.universityId;
      if (!univId) return;
      const q = query(
        collection(db, 'users'),
        where('role', '==', 'student'),
        where('universityId', '==', univId)
      );
      const querySnapshot = await getDocs(q);
      const list: StudentAccount[] = [];
      querySnapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as StudentAccount);
      });
      setStudents(list);
    } catch (error) {
      console.error("Error fetching students:", error);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => { if (user) fetchStudents(); }, [user]);

  const handleDelete = async (studentId: string) => {
    if (window.confirm("Are you sure you want to delete this student account?")) {
      try {
        await deleteDoc(doc(db, 'users', studentId));
        setStudents(students.filter(s => s.id !== studentId));
      } catch (error) {
        console.error("Error deleting student:", error);
      }
    }
  };

  const q = searchTerm.toLowerCase();
  const filteredStudents = students.filter((s) =>
    s.name?.toLowerCase().includes(q) ||
    s.email?.toLowerCase().includes(q)
  );

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
            className="w-full pl-8 pr-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-faint)] text-[13px] focus:outline-none focus:border-[#5E6AD2] transition-all duration-150"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
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
                        onClick={() => handleDelete(student.id)}
                        className="p-1.5 rounded text-[var(--text-faint)] hover:text-[#F54E00] hover:bg-[#F54E00]/10 transition-colors duration-150"
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