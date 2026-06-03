'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import {
  collection, doc, getDoc, getDocs, query, where,
  setDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { PracticeView, type PracticeProblem } from './practice.view';

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
    />
  );
}
