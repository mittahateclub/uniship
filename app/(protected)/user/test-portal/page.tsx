'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { FileText, Clock, HelpCircle, Tag, ArrowRight } from 'lucide-react';

interface Test {
  id: string;
  title: string;
  description: string;
  duration: number;
  totalQuestions: number;
  category: string;
}

export default function TestPortal() {
  const { user, loading: authLoading } = useAuth();
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTests() {
      if (!user) return;
      try {
        const q = query(collection(db, 'tests'));
        const querySnapshot = await getDocs(q);
        const fetchedTests = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Test[];
        setTests(fetchedTests);
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
            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
              <FileText size={20} className="text-blue-400" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-100">Available Tests</h1>
          </div>
          <p className="text-zinc-500">Select a test to begin your assessment.</p>
        </div>

        {tests.length === 0 ? (
          <div className="text-center py-16 bg-zinc-900 border border-zinc-800 border-dashed rounded-2xl">
            <FileText size={40} className="mx-auto text-zinc-600 mb-3" />
            <p className="text-zinc-400 font-medium">No tests available at the moment.</p>
            <p className="text-zinc-600 text-sm mt-1">New tests will appear here when published.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
            {tests.map((test) => (
              <div key={test.id} className="bg-zinc-900 rounded-xl border border-zinc-800 card-hover flex flex-col overflow-hidden group">
                <div className="p-6 flex-1">
                  <h3 className="text-lg font-bold text-zinc-100 mb-2">{test.title}</h3>
                  <p className="text-sm text-zinc-500 mb-4 line-clamp-2">{test.description}</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="flex items-center gap-1.5 bg-zinc-800 text-zinc-300 px-2.5 py-1 rounded-lg text-xs font-medium">
                      <Clock size={12} className="text-zinc-500" />
                      {test.duration} min
                    </span>
                    <span className="flex items-center gap-1.5 bg-zinc-800 text-zinc-300 px-2.5 py-1 rounded-lg text-xs font-medium">
                      <HelpCircle size={12} className="text-zinc-500" />
                      {test.totalQuestions} Qs
                    </span>
                    <span className="flex items-center gap-1.5 bg-violet-500/10 text-violet-400 px-2.5 py-1 rounded-lg text-xs font-medium">
                      <Tag size={12} />
                      {test.category}
                    </span>
                  </div>
                </div>
                <Link
                  href={`/user/test-portal/${test.id}`}
                  className="flex items-center justify-center gap-2 bg-zinc-800 text-zinc-100 py-3 font-semibold text-sm hover:bg-zinc-700 transition-colors border-t border-zinc-800"
                >
                  Start Test
                  <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}