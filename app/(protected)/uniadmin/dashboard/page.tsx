'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { UniAdminDashboardView } from './dashboard.view';

export default function UniAdminDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  return <UniAdminDashboardView loading={loading} userEmail={user?.email} />;
}
