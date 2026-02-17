'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';

interface StudentData {
  id: string;
  name: string;
  email: string;
  studentId?: string;
  phone?: string;
  createdAt: any;
}

export default function StudentDatabasePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [students, setStudents] = useState<StudentData[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    async function fetchStudents() {
      try {
        // In a real scenario, you'd fetch the admin's universityId from their profile first.
        // For now, we use a placeholder or assume it's in the user metadata if custom claims are set.
        const q = query(
          collection(db, 'users'), 
          where('role', '==', 'student'),
          where('universityId', '==', 'HARV-001') // Replace with dynamic ID from admin profile
        );
        
        const querySnapshot = await getDocs(q);
        const studentList: StudentData[] = [];
        
        querySnapshot.forEach((doc) => {
          studentList.push({
            id: doc.id,
            ...doc.data(),
          } as StudentData);
        });

        setStudents(studentList);
      } catch (error) {
        console.error('Error fetching students:', error);
      } finally {
        setLoadingData(false);
      }
    }

    if (user) {
      fetchStudents();
    }
  }, [user]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-white">Loading...</div>;

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Link href="/uniadmin/dashboard" className="text-black hover:text-gray-600 mb-4 inline-block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-4xl font-bold text-black mb-2">Student Database</h1>
          <p className="text-gray-600">View all students registered at your university.</p>
        </div>

        {loadingData ? (
          <p>Loading students...</p>
        ) : students.length === 0 ? (
          <div className="bg-black text-white p-12 rounded-lg text-center">
            <p className="text-xl">No students found for your university.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-md">
            <table className="w-full text-left border-collapse bg-white">
              <thead className="bg-black text-white">
                <tr>
                  <th className="px-6 py-4 font-medium">Name</th>
                  <th className="px-6 py-4 font-medium">Email</th>
                  <th className="px-6 py-4 font-medium">Student ID</th>
                  <th className="px-6 py-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 border-t border-gray-100">
                {students.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{student.name}</td>
                    <td className="px-6 py-4 text-gray-600">{student.email}</td>
                    <td className="px-6 py-4 text-gray-600">{student.studentId || 'N/A'}</td>
                    <td className="px-6 py-4">
                      <button className="text-blue-600 hover:underline">View Analytics</button>
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