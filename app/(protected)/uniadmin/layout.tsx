'use client';

import RoleGuard from '@/components/RoleGuard';

export default function UniAdminLayout({ children }: { children: React.ReactNode }) {
  return <RoleGuard allowedRoles={['university_admin', 'super_admin']}>{children}</RoleGuard>;
}
