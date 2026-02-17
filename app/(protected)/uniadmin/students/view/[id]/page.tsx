'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';

export default function ViewStudentPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { id } = useParams(); 
  const [studentData, setStudentData] = useState<any>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    async function fetchStudent() {
      if (!id) return;
      try {
        const studentDoc = await getDoc(doc(db, 'users', id as string));
        if (studentDoc.exists()) {
          setStudentData(studentDoc.data());
        }
      } catch (error) {
        console.error("Error fetching student details:", error);
      } finally {
        setFetching(false);
      }
    }
    fetchStudent();
  }, [id]);

  if (loading || fetching) return <div className="p-10 text-black">Loading profile...</div>;
  if (!studentData) return <div className="p-10 text-red-500">Student not found.</div>;

  return (
    <div className="min-h-screen bg-white text-black p-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/uniadmin/student-database" className="text-gray-500 hover:text-black mb-6 inline-block font-bold">
          ← BACK TO DATABASE
        </Link>
        
        <div className="bg-black text-white rounded-3xl p-10 shadow-2xl">
          <div className="flex justify-between items-start mb-10 border-b border-gray-800 pb-6">
            <div>
              <h1 className="text-5xl font-bold tracking-tight">{studentData.name}</h1>
              <p className="text-blue-400 font-mono mt-2">ID: {studentData.studentId || 'N/A'}</p>
            </div>
            <span className="bg-green-500/10 text-green-500 border border-green-500 px-4 py-1 rounded-full text-xs font-black uppercase">
              Active Student
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-6">
              <div>
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Email Address</label>
                <p className="text-xl font-medium">{studentData.email}</p>
              </div>
              <div>
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Phone Number</label>
                <p className="text-xl font-medium">{studentData.phone || 'Not provided'}</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest">University ID</label>
                <p className="text-xl font-medium">{studentData.universityId}</p>
              </div>
              <div>
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Account Created</label>
                <p className="text-xl font-medium">
                  {studentData.createdAt?.toDate ? studentData.createdAt.toDate().toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}