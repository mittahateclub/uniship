'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, getDocs, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { Briefcase, MapPin, DollarSign, Clock, CalendarDays, ArrowRight } from 'lucide-react';

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
            <div className="w-10 h-10 bg-violet-500/10 rounded-xl flex items-center justify-center">
              <Briefcase size={20} className="text-violet-400" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-100">Internship Portal</h1>
          </div>
          <p className="text-zinc-500">Exclusive opportunities for Uniship students.</p>
        </div>

        {internships.length === 0 ? (
          <div className="text-center py-16 bg-zinc-900 border border-zinc-800 border-dashed rounded-2xl">
            <Briefcase size={40} className="mx-auto text-zinc-600 mb-3" />
            <p className="text-zinc-400 font-medium">No active listings available.</p>
            <p className="text-zinc-600 text-sm mt-1">Check back for new opportunities.</p>
          </div>
        ) : (
          <div className="space-y-3 stagger-children">
            {internships.map((job) => (
              <div key={job.id} className="bg-zinc-900 rounded-xl border border-zinc-800 card-hover p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-sm font-semibold text-violet-400">{job.companyName}</span>
                      <span className="text-zinc-700">·</span>
                      <span className="flex items-center gap-1 text-xs text-zinc-500">
                        <MapPin size={11} />
                        {job.location}
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-zinc-100 mb-2">{job.role}</h2>
                    <div className="flex flex-wrap gap-3 text-sm text-zinc-400">
                      <span className="flex items-center gap-1.5">
                        <DollarSign size={13} className="text-emerald-400" />
                        {job.stipend}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock size={13} className="text-blue-400" />
                        {job.duration}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <CalendarDays size={13} className="text-amber-400" />
                        Deadline: {job.deadline?.toDate().toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  
                  <Link 
                    href={`/user/internships/${job.id}`}
                    className="inline-flex items-center gap-2 bg-zinc-100 text-zinc-900 px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-white transition-colors"
                  >
                    View Details
                    <ArrowRight size={15} />
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