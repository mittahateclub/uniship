'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { SuperadminDashboardView, type SuperadminDashboardStats } from './dashboard.view';

export default function SuperadminDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<SuperadminDashboardStats>({ totalUniadmins: 0, totalStudents: 0, totalUniversities: 0 });

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
        setStats({
          totalUniadmins: uniadminsSnapshot.data().count,
          totalStudents: studentsSnapshot.data().count,
          totalUniversities: universitiesSnapshot.data().count,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    }
    if (user) fetchStats();
  }, [user]);

  if (!loading && !user) return null;

  return <SuperadminDashboardView loading={loading} userEmail={user?.email} stats={stats} />;
}
