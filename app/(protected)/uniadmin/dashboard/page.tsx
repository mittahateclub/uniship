'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UniAdminDashboardView, type DashStats, type UpcomingTest } from './dashboard.view';

export default function UniAdminDashboard() {
  const { user, loading, universityId, userName } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashStats | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingTest[]>([]);
  const [liveSessions, setLiveSessions] = useState(0);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  // One-time overview counts (equality filters only → no extra indexes needed).
  useEffect(() => {
    if (!universityId) return;
    let cancelled = false;
    (async () => {
      setDataLoading(true);
      try {
        const byUniv = (c: string) =>
          getDocs(query(collection(db, c), where('universityId', '==', universityId))).catch(() => null);
        const [studentsSnap, testsSnap, eventsSnap, resultsSnap] = await Promise.all([
          getDocs(query(collection(db, 'users'), where('role', '==', 'student'), where('universityId', '==', universityId))).catch(() => null),
          byUniv('tests'),
          byUniv('events'),
          byUniv('test_results'),
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
        const pendingApproval = tests.filter((t) => !t.approved).length;
        const flagged = resultsSnap?.docs.filter((d) => (d.data() as { flagged?: boolean }).flagged).length ?? 0;

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

        setStats({
          students: studentsSnap?.size ?? 0,
          tests: testsSnap?.size ?? 0,
          events: eventsSnap?.size ?? 0,
          pendingApproval,
          flagged,
        });
        setUpcoming(up);
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [universityId]);

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
