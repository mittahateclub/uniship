'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';

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
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const fetchStudents = async () => {
    try {
      setLoadingData(true);
      // Logic assumes 'universityId' is part of the admin's user document
      const q = query(
        collection(db, 'users'),
        where('role', '==', 'student'),
        where('universityId', '==', 'HARV-001') // Placeholder: replace with actual admin's universityId
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

  useEffect(() => {
    if (user) fetchStudents();
  }, [user]);

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

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-white p-8 text-black">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex justify-between items-end">
          <div>
            <Link href="/uniadmin/dashboard" className="hover:text-gray-600 mb-4 inline-block">
              ← Back to Dashboard
            </Link>
            <h1 className="text-4xl font-bold">Manage Student Accounts</h1>
          </div>
          <div className="w-64">
            <input 
              type="text" 
              placeholder="Search students..." 
              className="w-full p-2 border border-black rounded"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {loadingData ? (
          <p>Loading...</p>
        ) : (
          <div className="bg-black rounded-lg overflow-hidden">
            <table className="w-full text-left text-white">
              <thead className="bg-gray-900 border-b border-gray-800">
                <tr>
                  <th className="p-4">Name</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Student ID</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="border-b border-gray-800 hover:bg-gray-900 transition">
                    <td className="p-4">{student.name}</td>
                    <td className="p-4">{student.email}</td>
                    <td className="p-4">{student.studentId || 'N/A'}</td>
                    <td className="p-4 text-right space-x-2">
                      <button className="text-sm bg-white text-black px-3 py-1 rounded hover:bg-gray-200">Edit</button>
                      <button 
                        onClick={() => handleDelete(student.id)}
                        className="text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                      >
                        Delete
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