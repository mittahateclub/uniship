'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Application {
  id: string;
  internshipRole: string;
  companyName: string;
  status: 'pending' | 'shortlisted' | 'selected' | 'rejected';
  appliedAt: any;
}

export default function ApplicationsPage() {
  const { user, loading: authLoading } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchApplications() {
      if (!user) return;
      try {
        const q = query(
          collection(db, 'applications'),
          where('userId', '==', user.uid),
          orderBy('appliedAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        const fetched = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Application[];
        setApplications(fetched);
      } catch (error) {
        console.error("Error fetching applications:", error);
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading) {
      fetchApplications();
    }
  }, [user, authLoading]);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'selected': return 'bg-green-500 text-white border-green-700';
      case 'rejected': return 'bg-red-500 text-white border-red-700';
      case 'shortlisted': return 'bg-blue-500 text-white border-blue-700';
      default: return 'bg-yellow-400 text-black border-yellow-600';
    }
  };

  if (loading || authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-white text-black font-black uppercase">Loading Applications...</div>;
  }

  return (
    <div className="min-h-screen bg-white p-8 text-black">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12 border-b-8 border-black pb-6">
          <h1 className="text-5xl font-black uppercase tracking-tighter">My Applications</h1>
          <p className="text-gray-600 font-bold mt-2 italic">Track the status of your professional opportunities.</p>
        </div>

        {applications.length === 0 ? (
          <div className="text-center py-20 border-4 border-black border-dashed">
            <p className="text-xl font-bold uppercase text-gray-400">No applications found.</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {applications.map((app) => (
              <div key={app.id} className="border-4 border-black p-6 flex flex-col md:flex-row justify-between items-center shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white">
                <div className="flex-1">
                  <span className="bg-black text-white px-2 py-0.5 text-xs font-bold uppercase mb-2 inline-block">
                    {app.companyName}
                  </span>
                  <h2 className="text-2xl font-black uppercase mb-1">{app.internshipRole}</h2>
                  <p className="text-sm font-bold text-gray-400 uppercase">
                    Applied on: {app.appliedAt?.toDate().toLocaleDateString()}
                  </p>
                </div>

                <div className="mt-4 md:mt-0">
                  <div className={`border-2 px-6 py-2 font-black uppercase tracking-widest text-sm ${getStatusStyle(app.status)}`}>
                    {app.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}