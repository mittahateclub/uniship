'use client';

import RoleGuard from '@/components/RoleGuard';

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return <RoleGuard allowedRoles={['student', 'user']}>{children}</RoleGuard>;
}
