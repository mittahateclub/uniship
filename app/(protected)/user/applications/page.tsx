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
      case 'selected': return 'bg-[#4CAF50]/10 text-[#4CAF50] border-[#4CAF50]/20';
      case 'rejected': return 'bg-[#F54E00]/10 text-[#F54E00] border-[#F54E00]/20';
      case 'shortlisted': return 'bg-[#5E6AD2]/10 text-[#5E6AD2] border-[#5E6AD2]/20';
      default: return 'bg-[#F1A82C]/10 text-[#F1A82C] border-[#F1A82C]/20';
    }
  };

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-dots"><span /><span /><span /></div>
      </div>
    );
  }

  return (
    <div className="max-w-[1000px] mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-[-0.02em]">My Applications</h1>
        <p className="text-[var(--text-tertiary)] text-[13px] mt-1">Track the status of your professional opportunities.</p>
      </div>

      {applications.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-[var(--border-active)] rounded">
          <ClipboardCheck size={28} className="mx-auto text-[var(--text-faint)] mb-3" />
          <p className="text-[var(--text-primary)] text-[13px] font-medium">No applications found.</p>
          <p className="text-[var(--text-faint)] text-[12px] mt-1">Apply to internships to see them here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {applications.map((app) => (
            <div key={app.id} className="window p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 hover:border-[var(--border-active)] transition-colors duration-150">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 size={12} className="text-[var(--text-faint)]" />
                  <span className="text-[12px] font-medium text-[#F54E00]">{app.companyName}</span>
                </div>
                <h2 className="text-[14px] font-bold text-[var(--text-primary)] mb-1">{app.internshipRole}</h2>
                <div className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
                  <CalendarDays size={11} />
                  <span>Applied {app.appliedAt?.toDate().toLocaleDateString()}</span>
                </div>
              </div>
              <div className={`px-2.5 py-1 rounded text-[11px] font-bold border uppercase tracking-wider ${getStatusStyle(app.status)}`}>
                {app.status}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}