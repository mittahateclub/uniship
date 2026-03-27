'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, query, where, orderBy } from 'firebase/firestore';
import { Code2, Search, CheckCircle2, Clock, ArrowRight } from 'lucide-react';

interface PracticeProblem {
  id: string;
  title: string;
  difficulty: string;
  functionName: string;
  testCases: Array<{ isHidden: boolean }>;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: 'bg-teal-500/10 text-teal-400',
  Medium: 'bg-amber-500/10 text-amber-400',
  Hard: 'bg-red-500/10 text-red-400',
};

export default function PracticeListPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [problems, setProblems] = useState<PracticeProblem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('All');

  useEffect(() => {
    if (!user) return;
    (async () => {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) return;
      const universityId = userDoc.data().universityId;

      const q = query(
        collection(db, 'practice_problems'),
        where('universityId', '==', universityId),
        orderBy('createdAt', 'desc'),
      );
      const qs = await getDocs(q);
      setProblems(qs.docs.map(d => ({ id: d.id, ...d.data() } as PracticeProblem)));
      setLoading(false);
    })();
  }, [user]);

  const filtered = problems.filter(p => {
    if (difficultyFilter !== 'All' && p.difficulty !== difficultyFilter) return false;
    if (searchQuery.trim() && !p.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-dots"><span /><span /><span /></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-[-0.02em]">Practice</h1>
        <p className="text-[var(--text-tertiary)] text-[13px] mt-1">Sharpen your skills with LeetCode-style problems</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search problems..."
            className="w-full pl-9 pr-3 py-2 text-[13px] rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--border-active)] transition-colors"
          />
        </div>
        <div className="inline-flex rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-0.5">
          {['All', 'Easy', 'Medium', 'Hard'].map(d => (
            <button
              key={d}
              onClick={() => setDifficultyFilter(d)}
              className={`px-3 py-1.5 text-[11px] font-semibold rounded-md transition-colors ${
                difficultyFilter === d
                  ? 'bg-[#5E6AD2] text-white'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Problem Table */}
      {filtered.length === 0 ? (
        <div className="window p-12 text-center">
          <Code2 size={32} className="mx-auto mb-3 text-[var(--text-faint)]" />
          <p className="text-[var(--text-tertiary)] text-[13px]">
            {problems.length === 0 ? 'No practice problems available yet.' : 'No problems match your filter.'}
          </p>
        </div>
      ) : (
        <div className="window overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-12 gap-3 px-4 py-2 text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
            <div className="col-span-1">#</div>
            <div className="col-span-6">Title</div>
            <div className="col-span-2">Difficulty</div>
            <div className="col-span-3 text-right">Action</div>
          </div>
          {/* Rows */}
          {filtered.map((p, idx) => (
            <button
              key={p.id}
              onClick={() => router.push(`/user/practice/${p.id}`)}
              className="grid grid-cols-12 gap-3 px-4 py-3 items-center w-full text-left hover:bg-[var(--bg-surface)] transition-colors border-b border-[var(--border-subtle)] last:border-b-0 group"
            >
              <div className="col-span-1 text-[12px] font-mono text-[var(--text-faint)]">{idx + 1}</div>
              <div className="col-span-6">
                <p className="text-[13px] font-medium text-[var(--text-primary)] group-hover:text-[#5E6AD2] transition-colors truncate">
                  {p.title}
                </p>
              </div>
              <div className="col-span-2">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${DIFFICULTY_COLORS[p.difficulty] || DIFFICULTY_COLORS['Medium']}`}>
                  {p.difficulty}
                </span>
              </div>
              <div className="col-span-3 flex justify-end">
                <span className="text-[11px] font-medium text-[#5E6AD2] flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  Solve <ArrowRight size={11} />
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
