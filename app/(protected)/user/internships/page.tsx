'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, getDocs, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';

interface Internship {
  id: string;
  companyName: string;
  role: string;
  location: string;
  stipend: string;
  duration: string;
  deadline: any;
  description: string;
}

export default function InternshipsPage() {
  const { user, loading: authLoading } = useAuth();
  const [internships, setInternships] = useState<Internship[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInternships() {
      if (!user) return;
      try {
        const q = query(
          collection(db, 'internships'),
          orderBy('deadline', 'asc')
        );
        const querySnapshot = await getDocs(q);
        const fetched = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Internship[];
        setInternships(fetched);
      } catch (error) {
        console.error("Error fetching internships:", error);
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading) {
      fetchInternships();
    }
  }, [user, authLoading]);

  if (loading || authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-white text-black">Loading opportunities...</div>;
  }

  return (
    <div className="min-h-screen bg-white p-8 text-black">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12 border-b-4 border-black pb-6">
          <h1 className="text-4xl font-black uppercase tracking-tighter">Internship Portal</h1>
          <p className="text-gray-600 font-bold">Exclusive opportunities for Uniship students.</p>
        </div>

        {internships.length === 0 ? (
          <div className="text-center py-20 border-4 border-black border-dashed">
            <p className="text-xl font-bold uppercase">No active listings available.</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {internships.map((job) => (
              <div key={job.id} className="border-4 border-black p-6 flex flex-col md:flex-row justify-between items-center hover:bg-gray-50 transition-all shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="bg-black text-white px-2 py-0.5 text-xs font-bold uppercase">{job.companyName}</span>
                    <span className="text-gray-400 text-xs font-bold uppercase">{job.location}</span>
                  </div>
                  <h2 className="text-2xl font-black uppercase mb-2">{job.role}</h2>
                  <div className="flex gap-6 text-sm font-bold text-gray-600">
                    <span>💰 {job.stipend}</span>
                    <span>⏳ {job.duration}</span>
                    <span>📅 Deadline: {job.deadline?.toDate().toLocaleDateString()}</span>
                  </div>
                </div>
                
                <div className="mt-6 md:mt-0">
                  <Link 
                    href={`/user/internships/${job.id}`}
                    className="inline-block bg-black text-white px-8 py-3 font-black uppercase tracking-widest hover:bg-gray-800 transition-colors"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}