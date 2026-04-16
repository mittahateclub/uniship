'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface RoleGuardProps {
  /** Allowed roles for this route group */
  allowedRoles: string[];
  children: React.ReactNode;
}

/**
 * Client-side role guard. Redirects unauthorized users.
 * Place this in role-specific layouts (superadmin, uniadmin, user).
 */
export default function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    if (role && !allowedRoles.includes(role)) {
      // Redirect to the correct dashboard for their role
      switch (role) {
        case 'super_admin':
          router.replace('/superadmin/dashboard');
          break;
        case 'university_admin':
          router.replace('/uniadmin/dashboard');
          break;
        default:
          router.replace('/user/dashboard');
          break;
      }
    }
  }, [user, role, loading, allowedRoles, router]);

  // Show nothing while checking auth
  if (loading || !user || !role || !allowedRoles.includes(role)) {
    return null;
  }

  return <>{children}</>;
}
