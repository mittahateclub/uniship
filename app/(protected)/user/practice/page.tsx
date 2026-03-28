'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import {
  collection, doc, getDoc, getDocs, query, where,
  setDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { Code2, Search, CheckCircle2, ArrowRight, Pin, Clock, RotateCcw, Trophy, Target } from 'lucide-react';

interface PracticeProblem {
  id: string;
  title: string;
  difficulty: string;
  functionName: string;
  testCases: Array<{ isHidden: boolean }>;
  createdAt: { seconds: number } | null;
  visibleUntil: { seconds: number } | null;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: 'bg-teal-500/10 text-teal-400 border border-teal-500/20',
  Medium: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  Hard: 'bg-red-500/10 text-red-400 border border-red-500/20',
};

export default function PracticeListPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [problems, setProblems] = useState<PracticeProblem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('All');
  const [solvedIds, setSolvedIds] = useState<Set<string>>(new Set());
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    (async () => {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) return;
      const universityId = userDoc.data().universityId;

      const [problemsSnap, subsSnap, pinsSnap] = await Promise.all([
        getDocs(query(collection(db, 'practice_problems'), where('universityId', '==', universityId))),
        getDocs(query(collection(db, 'practice_submissions'), where('userId', '==', user.uid), where('verdict', '==', 'AC'))),
        getDocs(query(collection(db, 'practice_pins'), where('userId', '==', user.uid))),
      ]);

      const items = problemsSnap.docs.map(d => ({ id: d.id, ...d.data() } as PracticeProblem));
      items.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
      setProblems(items);
      setSolvedIds(new Set(subsSnap.docs.map(d => d.data().problemId as string)));
      setPinnedIds(new Set(pinsSnap.docs.map(d => d.data().problemId as string)));
      setLoading(false);
    })();
  }, [user]);

  const togglePin = async (e: React.MouseEvent, problemId: string) => {
    e.stopPropagation();
    if (!user) return;
    const pinRef = doc(db, 'practice_pins', `${user.uid}_${problemId}`);
    if (pinnedIds.has(problemId)) {
      await deleteDoc(pinRef);
      setPinnedIds(prev => { const n = new Set(prev); n.delete(problemId); return n; });
    } else {
      await setDoc(pinRef, { userId: user.uid, problemId, pinnedAt: serverTimestamp() });
      setPinnedIds(prev => new Set([...prev, problemId]));
    }
  };

  const filtered = problems.filter(p => {
    const isExpired = p.visibleUntil && p.visibleUntil.seconds * 1000 < Date.now();
    const isPinned = pinnedIds.has(p.id);
    if (isExpired && !isPinned) return false;
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
    <div className="px-6 py-6 animate-fade-in max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Practice Problems</h1>
          <p className="text-[var(--text-tertiary)] text-sm mt-1">Sharpen your skills with coding challenges</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#5E6AD2]/10 flex items-center justify-center shrink-0">
            <Target size={18} className="text-[#5E6AD2]" />
          </div>
          <div>
            <p className="text-xl font-bold text-[var(--text-primary)]">{problems.length}</p>
            <p className="text-[11px] text-[var(--text-faint)]">Total Problems</p>
          </div>
        </div>
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#4CAF50]/10 flex items-center justify-center shrink-0">
            <Trophy size={18} className="text-[#4CAF50]" />
          </div>
          <div>
            <p className="text-xl font-bold text-[var(--text-primary)]">{solvedIds.size}</p>
            <p className="text-[11px] text-[var(--text-faint)]">Solved</p>
          </div>
        </div>
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
            <Clock size={18} className="text-amber-400" />
          </div>
          <div>
            <p className="text-xl font-bold text-[var(--text-primary)]">{problems.length - solvedIds.size}</p>
            <p className="text-[11px] text-[var(--text-faint)]">Remaining</p>
          </div>
        </div>
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#5E6AD2]/10 flex items-center justify-center shrink-0">
            <Pin size={18} className="text-[#5E6AD2]" />
          </div>
          <div>
            <p className="text-xl font-bold text-[var(--text-primary)]">{pinnedIds.size}</p>
            <p className="text-[11px] text-[var(--text-faint)]">Pinned</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search problems..."
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[#5E6AD2] focus:ring-1 focus:ring-[#5E6AD2]/30 transition-all"
          />
        </div>
        <div className="inline-flex rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1">
          {['All', 'Easy', 'Medium', 'Hard'].map(d => (
            <button
              key={d}
              onClick={() => setDifficultyFilter(d)}
              className={`px-4 py-2 text-xs font-semibold rounded-md transition-all ${
                difficultyFilter === d
                  ? 'bg-[#5E6AD2] text-white shadow-sm'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Problem Table */}
      {filtered.length === 0 ? (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-16 text-center">
          <Code2 size={40} className="mx-auto mb-4 text-[var(--text-faint)]" />
          <p className="text-[var(--text-secondary)] text-sm font-medium">
            {problems.length === 0 ? 'No practice problems available yet.' : 'No problems match your filter.'}
          </p>
          <p className="text-[var(--text-faint)] text-xs mt-1">
            {problems.length === 0 ? 'Check back later for new challenges.' : 'Try adjusting your search or filters.'}
          </p>
        </div>
      ) : (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-3 text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wider bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)]">
            <div className="col-span-1">Status</div>
            <div className="col-span-6">Title</div>
            <div className="col-span-2">Difficulty</div>
            <div className="col-span-3 text-right">Actions</div>
          </div>
          {/* Rows */}
          {filtered.map((p, idx) => {
            const isSolved = solvedIds.has(p.id);
            const isPinned = pinnedIds.has(p.id);
            const isExpired = !!(p.visibleUntil && p.visibleUntil.seconds * 1000 < Date.now());
            const msLeft = p.visibleUntil ? p.visibleUntil.seconds * 1000 - Date.now() : null;
            const daysLeft = msLeft !== null && msLeft > 0 ? Math.ceil(msLeft / 86400000) : null;
            const showExpiry = daysLeft !== null && daysLeft <= 3;
            return (
              <div
                key={p.id}
                onClick={() => !isExpired && router.push(`/user/practice/${p.id}`)}
                className={`grid grid-cols-12 gap-4 px-6 py-4 items-center border-b border-[var(--border-subtle)] last:border-b-0 group transition-all duration-150 ${
                  isExpired ? 'opacity-40 cursor-default' : 'cursor-pointer hover:bg-[var(--bg-elevated)]'
                }`}
              >
                {/* Status */}
                <div className="col-span-1 flex items-center justify-center">
                  {isSolved
                    ? <CheckCircle2 size={18} className="text-[#4CAF50]" />
                    : <div className="w-4 h-4 rounded-full border-2 border-[var(--border-subtle)]" />
                  }
                </div>

                {/* Title + expiry warning */}
                <div className="col-span-6 min-w-0">
                  <p className={`text-sm font-medium truncate transition-colors ${
                    isExpired ? 'text-[var(--text-faint)] line-through' : 'text-[var(--text-primary)] group-hover:text-[#5E6AD2]'
                  }`}>
                    {p.title}
                  </p>
                  {showExpiry && (
                    <div className="flex items-center gap-1 mt-1">
                      <Clock size={10} className="text-amber-400" />
                      <span className="text-[11px] text-amber-400 font-medium">
                        Expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                  {isExpired && (
                    <span className="text-[10px] text-[var(--text-faint)] mt-0.5 block">Expired — pinned copy</span>
                  )}
                </div>

                {/* Difficulty */}
                <div className="col-span-2">
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${DIFFICULTY_COLORS[p.difficulty] || DIFFICULTY_COLORS['Medium']}`}>
                    {p.difficulty}
                  </span>
                </div>

                {/* Pin + action */}
                <div className="col-span-3 flex items-center justify-end gap-2">
                  {isExpired ? (
                    <span className="text-xs text-[var(--text-faint)] font-medium w-24 text-right">Expired</span>
                  ) : isSolved ? (
                    <span className="text-xs font-medium text-[#4CAF50] flex items-center gap-1.5 w-24 justify-end">
                      <RotateCcw size={12} /> Reattempt
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-[#5E6AD2] flex items-center gap-1.5 w-24 justify-end">
                      Solve <ArrowRight size={12} />
                    </span>
                  )}
                  <button
                    onClick={(e) => togglePin(e, p.id)}
                    title={isPinned ? 'Unpin' : 'Pin — keeps question after expiry'}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all shrink-0 ${
                      isPinned
                        ? 'text-[#5E6AD2] bg-[#5E6AD2]/10'
                        : 'text-[var(--text-faint)] hover:text-[#5E6AD2] hover:bg-[#5E6AD2]/5'
                    }`}
                  >
                    <Pin size={14} className={isPinned ? 'fill-current' : ''} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
