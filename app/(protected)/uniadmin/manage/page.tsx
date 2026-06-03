'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ManageView, type StudentAccount } from './manage.view';

export default function ManageAccountsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [students, setStudents] = useState<StudentAccount[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push('/');
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

  return (
    <ManageView
      loading={loading}
      loadingData={loadingData}
      filteredStudents={filteredStudents}
      searchTerm={searchTerm}
      onSearchTermChange={setSearchTerm}
      onDelete={handleDelete}
    />
  );
}
