'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

function RedirectWhenAuthenticated() {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || !user || !role) return;
    if (role === 'super_admin') router.replace('/superadmin/dashboard');
    else if (role === 'university_admin') router.replace('/uniadmin/dashboard');
    else router.replace('/user/dashboard');
  }, [user, role, loading, router]);

  return null;
}

export default function LandingAuthRedirect() {
  return (
    <AuthProvider>
      <RedirectWhenAuthenticated />
    </AuthProvider>
  );
}
