'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ClipboardCheck, Building2, CalendarDays } from 'lucide-react';

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
      case 'selected': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'rejected': return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'shortlisted': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default: return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-dots"><span /><span /><span /></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-10">
      <div className="max-w-5xl mx-auto animate-fade-in">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
              <ClipboardCheck size={20} className="text-emerald-400" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-100">My Applications</h1>
          </div>
          <p className="text-zinc-500">Track the status of your professional opportunities.</p>
        </div>

        {applications.length === 0 ? (
          <div className="text-center py-16 bg-zinc-900 border border-zinc-800 border-dashed rounded-2xl">
            <ClipboardCheck size={40} className="mx-auto text-zinc-600 mb-3" />
            <p className="text-zinc-400 font-medium">No applications found.</p>
            <p className="text-zinc-600 text-sm mt-1">Apply to internships to see them here.</p>
          </div>
        ) : (
          <div className="space-y-3 stagger-children">
            {applications.map((app) => (
              <div key={app.id} className="bg-zinc-900 rounded-xl border border-zinc-800 card-hover p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Building2 size={14} className="text-zinc-500" />
                    <span className="text-sm font-semibold text-violet-400">{app.companyName}</span>
                  </div>
                  <h2 className="text-lg font-bold text-zinc-100 mb-1">{app.internshipRole}</h2>
                  <div className="flex items-center gap-1.5 text-sm text-zinc-500">
                    <CalendarDays size={13} />
                    <span>Applied {app.appliedAt?.toDate().toLocaleDateString()}</span>
                  </div>
                </div>

                <div className={`px-4 py-1.5 rounded-full text-xs font-semibold border capitalize ${getStatusStyle(app.status)}`}>
                  {app.status}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}