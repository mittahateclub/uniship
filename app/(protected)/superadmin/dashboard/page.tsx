'use client';
import { useTransitionRouter } from 'next-view-transitions';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { SuperadminDashboardView, type SuperadminDashboardStats } from './dashboard.view';
import { getCache, setCache } from '@/lib/page-cache';

export default function SuperadminDashboard() {
  const { user, loading } = useAuth();
  const router = useTransitionRouter();
  const cacheKey = user ? `superadmin-dash:${user.uid}` : '';
  const [stats, setStats] = useState<SuperadminDashboardStats>(() => (cacheKey ? getCache<SuperadminDashboardStats>(cacheKey) : undefined) ?? { totalUniadmins: 0, totalStudents: 0, totalUniversities: 0 });

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [uniadminsSnapshot, studentsSnapshot, universitiesSnapshot] = await Promise.all([
          getCountFromServer(query(collection(db, 'users'), where('role', '==', 'university_admin'))),
          getCountFromServer(query(collection(db, 'users'), where('role', '==', 'student'))),
          getCountFromServer(collection(db, 'universities')),
        ]);
        const statsObj: SuperadminDashboardStats = {
          totalUniadmins: uniadminsSnapshot.data().count,
          totalStudents: studentsSnapshot.data().count,
          totalUniversities: universitiesSnapshot.data().count,
        };
        setStats(statsObj);
        if (cacheKey) setCache<SuperadminDashboardStats>(cacheKey, statsObj);
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    }
    if (user) fetchStats();
  }, [user, cacheKey]);

  if (!loading && !user) return null;

  return <SuperadminDashboardView loading={loading} userEmail={user?.email} stats={stats} />;
}
