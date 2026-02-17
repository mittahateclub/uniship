'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, deleteDoc } from 'firebase/firestore';
import Link from 'next/link';

export default function StudentDatabasePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [students, setStudents] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);
  const [adminUnivId, setAdminUnivId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
        const q = query(
          collection(db, 'users'),
          where('role', '==', 'student'),
          where('universityId', '==', univId)
        );
        
        const querySnapshot = await getDocs(q);
        const studentList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setStudents(studentList);
      }
    } catch (error) {
      console.error("Error fetching students:", error);
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => {
    fetchStudents();
  }, [user]);

  const handleDeleteStudent = async (studentId: string, studentName: string) => {
    if (!window.confirm(`Are you sure you want to delete ${studentName}? This will remove their profile from the database.`)) {
      return;
    }

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

  if (loading || fetching) return <div className="p-10 text-black">Loading student records...</div>;

  return (
    <div className="min-h-screen bg-white text-black p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        <header className="mb-10 flex justify-between items-end">
          <div>
            <Link href="/uniadmin/dashboard" className="text-sm font-bold text-gray-400 hover:text-black transition-colors">
              ← DASHBOARD
            </Link>
            <h1 className="text-5xl font-bold mt-2 tracking-tight">Student Database</h1>
            <p className="text-gray-500 mt-2 font-medium italic">
              University ID: {adminUnivId || 'Not Set'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">{students.length}</p>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Students</p>
          </div>
        </header>

        {students.length === 0 ? (
          <div className="border-2 border-gray-100 rounded-3xl p-20 text-center">
            <p className="text-gray-500 mb-4">No students found for your university.</p>
            <Link href="/uniadmin/create-account" className="bg-black text-white px-6 py-3 rounded-xl font-bold">
              Add Student
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden border-2 border-gray-100 rounded-3xl shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-100">
                  <th className="p-5 text-xs font-black uppercase tracking-widest text-gray-400">Name</th>
                  <th className="p-5 text-xs font-black uppercase tracking-widest text-gray-400">Student ID</th>
                  <th className="p-5 text-xs font-black uppercase tracking-widest text-gray-400">Email</th>
                  <th className="p-5 text-xs font-black uppercase tracking-widest text-gray-400">Status</th>
                  <th className="p-5 text-xs font-black uppercase tracking-widest text-gray-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {students.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-5 font-bold">{student.name}</td>
                    <td className="p-5 font-mono text-sm text-gray-500">{student.studentId || 'N/A'}</td>
                    <td className="p-5 text-gray-600">{student.email}</td>
                    <td className="p-5">
                      <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[10px] font-black uppercase">Active</span>
                    </td>
                    <td className="p-5 text-right space-x-3">
                      <Link 
                        href={`/uniadmin/students/view/${student.id}`}
                        className="text-xs font-bold text-black hover:underline"
                      >
                        VIEW DATA
                      </Link>
                      <button 
                        onClick={() => handleDeleteStudent(student.id, student.name)}
                        disabled={deletingId === student.id}
                        className="text-xs font-bold text-red-600 hover:text-red-800 disabled:opacity-50"
                      >
                        {deletingId === student.id ? 'DELETING...' : 'DELETE'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}