'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, getDocs, where, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { FileText, Clock, HelpCircle, Tag, ArrowRight, Calendar } from 'lucide-react';

interface Test {
  id: string;
  title: string;
  description: string;
  duration: number;
  totalQuestions: number;
  category: string;
  examStart?: string;
  examEnd?: string;
  approved?: boolean;
  published?: boolean;
  sourceType?: string;
}

export default function TestPortal() {
  const { user, loading: authLoading } = useAuth();
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTests() {
      if (!user) return;
      try {
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        const universityId = userSnap.data()?.universityId;
        if (!universityId) {
          setTests([]);
          return;
        }

        const [approvedSnapshot, publishedSnapshot] = await Promise.all([
          getDocs(query(
            collection(db, 'tests'),
            where('universityId', '==', universityId),
            where('approved', '==', true),
          )).catch(() => ({ docs: [] } as any)),
          getDocs(query(
            collection(db, 'tests'),
            where('universityId', '==', universityId),
            where('published', '==', true),
          )).catch(() => ({ docs: [] } as any)),
        ]);

        const merged = new Map<string, Test>();

        approvedSnapshot.docs.forEach((docSnap: any) => {
          merged.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as Test);
        });

        publishedSnapshot.docs.forEach((docSnap: any) => {
          merged.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as Test);
        });

        setTests(Array.from(merged.values()));
      } catch (error) {
        console.error("Error fetching tests:", error);
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading) {
      fetchTests();
    }
  }, [user, authLoading]);

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
        <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-[-0.02em]">Tests</h1>
        <p className="text-[var(--text-tertiary)] text-[13px] mt-1">Select a test to begin.</p>
      </div>

      {tests.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-[var(--border-active)] rounded">
          <FileText size={28} className="mx-auto text-[var(--text-faint)] mb-3" />
          <p className="text-[var(--text-primary)] text-[13px] font-medium">No tests available at the moment.</p>
          <p className="text-[var(--text-faint)] text-[12px] mt-1">New tests will appear here when published.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {tests.map((test) => {
            const now = new Date();
            const start = test.examStart ? new Date(test.examStart) : null;
            const end = test.examEnd ? new Date(test.examEnd) : null;
            const isActive = (!start || now >= start) && (!end || now <= end);
            const isUpcoming = start && now < start;
            const isExpired = end && now > end;

            return (
            <div key={test.id} className={`window group transition-colors duration-150 ${isActive ? 'hover:border-[var(--border-active)]' : 'opacity-70'}`}>
              <div className="p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-flex items-center gap-1 bg-[#00A8E1]/10 text-[#00A8E1] px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                        <Tag size={9} />
                        {test.category}
                      </span>
                      {isUpcoming && (
                        <span className="inline-flex items-center gap-1 bg-[#4B8BBE]/10 text-[#4B8BBE] px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                          Upcoming
                        </span>
                      )}
                      {isExpired && (
                        <span className="inline-flex items-center gap-1 bg-[var(--border-subtle)] text-[var(--text-faint)] px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                          Ended
                        </span>
                      )}
                      {isActive && start && (
                        <span className="inline-flex items-center gap-1 bg-[#4CAF50]/10 text-[#4CAF50] px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                          Live
                        </span>
                      )}
                    </div>
                    <h3 className="text-[15px] font-bold text-[var(--text-primary)] leading-snug">{test.title}</h3>
                  </div>
                  <div className="w-9 h-9 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
                    <FileText size={16} className="text-[var(--text-faint)]" />
                  </div>
                </div>
                <p className="text-[12px] text-[var(--text-muted)] leading-relaxed mb-3 line-clamp-2">{test.description}</p>
                {(start || end) && (
                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-faint)] mb-3">
                    <Calendar size={11} />
                    {start && <span>{start.toLocaleDateString([], { month: 'short', day: 'numeric' })} {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                    {start && end && <span>—</span>}
                    {end && <span>{end.toLocaleDateString([], { month: 'short', day: 'numeric' })} {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 text-[var(--text-tertiary)] text-[12px]">
                      <Clock size={12} className="text-[var(--text-faint)]" />
                      {test.duration} min
                    </span>
                    <span className="w-px h-3 bg-[var(--border-subtle)]" />
                    <span className="flex items-center gap-1.5 text-[var(--text-tertiary)] text-[12px]">
                      <HelpCircle size={12} className="text-[var(--text-faint)]" />
                      {test.totalQuestions} questions
                    </span>
                  </div>
                  {isActive ? (
                    <Link
                      href={`/user/test-portal/${test.id}`}
                      className="btn-primary flex items-center gap-1.5 text-[12px] !py-1.5 !px-3"
                    >
                      Start
                      <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform duration-150" />
                    </Link>
                  ) : (
                    <span className="text-[11px] text-[var(--text-faint)] font-medium">
                      {isUpcoming ? `Opens ${start!.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : 'Closed'}
                    </span>
                  )}
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}