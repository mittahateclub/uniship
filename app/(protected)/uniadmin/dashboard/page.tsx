'use client';
import { useTransitionRouter } from 'next-view-transitions';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, getCountFromServer, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UniAdminDashboardView, type DashStats, type UpcomingTest } from './dashboard.view';
import { getCache, setCache } from '@/lib/page-cache';

type CachedUniDash = { stats: DashStats; upcoming: UpcomingTest[] };

export default function UniAdminDashboard() {
  const { user, loading, universityId, userName } = useAuth();
  const router = useTransitionRouter();
  const cacheKey = universityId ? `uniadmin-dash:${universityId}` : '';
  const [stats, setStats] = useState<DashStats | null>(() => (cacheKey ? getCache<CachedUniDash>(cacheKey)?.stats : undefined) ?? null);
  const [upcoming, setUpcoming] = useState<UpcomingTest[]>(() => (cacheKey ? getCache<CachedUniDash>(cacheKey)?.upcoming : undefined) ?? []);
  const [liveSessions, setLiveSessions] = useState(0);
  const [dataLoading, setDataLoading] = useState(() => !(cacheKey && getCache<CachedUniDash>(cacheKey)));

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  // One-time overview counts (equality filters only → no extra indexes needed).
  useEffect(() => {
    if (!universityId) return;
    let cancelled = false;
    (async () => {
      if (!(cacheKey && getCache<CachedUniDash>(cacheKey))) setDataLoading(true);
      try {
        const countByUniv = (c: string) =>
          getCountFromServer(query(collection(db, c), where('universityId', '==', universityId))).catch(() => null);
        const [studentsCount, testsCount, approvedCount, eventsCount, flaggedCount, testsSnap] = await Promise.all([
          getCountFromServer(query(collection(db, 'users'), where('role', '==', 'student'), where('universityId', '==', universityId))).catch(() => null),
          countByUniv('tests'),
          getCountFromServer(query(collection(db, 'tests'), where('universityId', '==', universityId), where('approved', '==', true))).catch(() => null),
          countByUniv('events'),
          getCountFromServer(query(collection(db, 'test_results'), where('universityId', '==', universityId), where('flagged', '==', true))).catch(() => null),
          getDocs(query(collection(db, 'tests'), where('universityId', '==', universityId), limit(100))).catch(() => null),
        ]);
        if (cancelled) return;

        const now = Date.now();
        type RawTest = {
          id: string;
          examStart?: string;
          examEnd?: string | null;
          title?: string;
          sourceFileName?: string;
          approved?: boolean;
        };
        const tests = (testsSnap?.docs.map((d) => ({ id: d.id, ...d.data() })) ?? []) as RawTest[];
        const totalTests = testsCount?.data().count ?? 0;
        const pendingApproval = Math.max(0, totalTests - (approvedCount?.data().count ?? 0));

        const up: UpcomingTest[] = tests
          .filter((t) => t.examStart && new Date(t.examEnd || t.examStart).getTime() >= now)
          .map((t) => ({
            id: t.id,
            title: t.title || t.sourceFileName || 'Untitled Test',
            examStart: t.examStart as string,
            examEnd: t.examEnd ?? null,
            approved: t.approved ?? false,
          }))
          .sort((a, b) => new Date(a.examStart).getTime() - new Date(b.examStart).getTime())
          .slice(0, 5);

        const statsObj: DashStats = {
          students: studentsCount?.data().count ?? 0,
          tests: totalTests,
          events: eventsCount?.data().count ?? 0,
          pendingApproval,
          flagged: flaggedCount?.data().count ?? 0,
        };
        setStats(statsObj);
        setUpcoming(up);
        if (cacheKey) setCache<CachedUniDash>(cacheKey, { stats: statsObj, upcoming: up });
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [universityId, cacheKey]);

  // Live exam sessions for this university.
  useEffect(() => {
    if (!universityId) return;
    const q = query(
      collection(db, 'exam_sessions'),
      where('universityId', '==', universityId),
      where('status', '==', 'active'),
    );
    const unsub = onSnapshot(q, (snap) => setLiveSessions(snap.size), () => {});
    return () => unsub();
  }, [universityId]);

  return (
    <UniAdminDashboardView
      loading={loading}
      dataLoading={dataLoading}
      userName={userName ?? user?.email?.split('@')[0] ?? null}
      stats={stats}
      liveSessions={liveSessions}
      upcoming={upcoming}
    />
  );
}
