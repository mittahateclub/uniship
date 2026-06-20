'use client';
import { useTransitionRouter } from 'next-view-transitions';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import {
  collection, doc, getDoc, getDocs, query, where,
  setDoc, deleteDoc, limit, serverTimestamp,
} from 'firebase/firestore';
import { getCache, setCache } from '@/lib/page-cache';
import { PracticeView, type PracticeProblem } from './practice.view';

type CachedPractice = { problems: PracticeProblem[]; solved: string[]; pinned: string[] };

export default function PracticeListPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useTransitionRouter();
  const cacheKey = user ? `practice:${user.uid}` : '';
  const [problems, setProblems] = useState<PracticeProblem[]>(() => (cacheKey ? getCache<CachedPractice>(cacheKey)?.problems : undefined) ?? []);
  const [loading, setLoading] = useState(() => !(cacheKey && getCache<CachedPractice>(cacheKey)));
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('All');
  const [solvedIds, setSolvedIds] = useState<Set<string>>(() => new Set((cacheKey ? getCache<CachedPractice>(cacheKey)?.solved : undefined) ?? []));
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => new Set((cacheKey ? getCache<CachedPractice>(cacheKey)?.pinned : undefined) ?? []));
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(clock);
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) return;
      const universityId = userDoc.data().universityId;

      const [problemsSnap, subsSnap, pinsSnap] = await Promise.all([
        getDocs(query(collection(db, 'practice_problems'), where('universityId', '==', universityId), limit(200))),
        getDocs(query(collection(db, 'practice_submissions'), where('userId', '==', user.uid), where('verdict', '==', 'AC'), limit(500))),
        getDocs(query(collection(db, 'practice_pins'), where('userId', '==', user.uid), limit(500))),
      ]);

      const items = problemsSnap.docs.map(d => ({ id: d.id, ...d.data() } as PracticeProblem));
      items.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
      const solved = subsSnap.docs.map(d => d.data().problemId as string);
      const pinned = pinsSnap.docs.map(d => d.data().problemId as string);
      setProblems(items);
      setSolvedIds(new Set(solved));
      setPinnedIds(new Set(pinned));
      if (cacheKey) setCache<CachedPractice>(cacheKey, { problems: items, solved, pinned });
      setLoading(false);
    })();
  }, [user, cacheKey]);

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
    const isExpired = p.visibleUntil && p.visibleUntil.seconds * 1000 < now;
    const isPinned = pinnedIds.has(p.id);
    if (isExpired && !isPinned) return false;
    if (difficultyFilter !== 'All' && p.difficulty !== difficultyFilter) return false;
    if (searchQuery.trim() && !p.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <PracticeView
      loading={authLoading || loading}
      problems={problems}
      filtered={filtered}
      solvedIds={solvedIds}
      pinnedIds={pinnedIds}
      searchQuery={searchQuery}
      difficultyFilter={difficultyFilter}
      onSearchQueryChange={setSearchQuery}
      onDifficultyFilterChange={setDifficultyFilter}
      onTogglePin={togglePin}
      onOpenProblem={(id) => router.push(`/user/practice/${id}`)}
      now={now}
    />
  );
}
