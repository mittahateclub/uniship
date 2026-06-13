'use client';

import Link from 'next/link';
import { UserPlus, ShieldCheck, Users, GraduationCap, ArrowUpRight, Building2 } from '@/components/icons';

export interface SuperadminDashboardStats {
  totalUniadmins: number;
  totalStudents: number;
  totalUniversities: number;
}

export interface SuperadminDashboardViewProps {
  loading: boolean;
  userEmail: string | null | undefined;
  stats: SuperadminDashboardStats;
}

export function SuperadminDashboardView({ loading, userEmail, stats }: SuperadminDashboardViewProps) {
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="loading-dots"><span /><span /><span /></div>
    </div>
  );

  const menuItems = [
    { title: 'Create Uni Admin', desc: 'Add a new university admin.', href: '/superadmin/create-uniadmin', icon: UserPlus },
    { title: 'Manage Admins', desc: 'View & manage all admins.', href: '/superadmin/manage-uniadmins', icon: ShieldCheck },
    { title: 'Manage Students', desc: 'Edit and assign students to universities.', href: '/superadmin/manage-students', icon: Users },
    { title: 'Universities', desc: 'Register & verify universities.', href: '/superadmin/universities', icon: Building2 },
  ];

  return (
    <div className="max-w-[1100px] mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-[var(--text-primary)] tracking-[-0.02em]">Superadmin Dashboard</h1>
        <p className="text-[var(--text-tertiary)] text-[13px] mt-1">Welcome back, <span className="text-[var(--text-primary)]">{userEmail?.split('@')[0]}</span></p>
      </div>

      <div id="stats" className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Total Universities', value: stats.totalUniversities, icon: GraduationCap },
          { label: 'Uni Admins', value: stats.totalUniadmins, icon: ShieldCheck },
          { label: 'Total Students', value: stats.totalStudents, icon: Users },
        ].map((s, i) => (
          <div key={i} className="window p-5 hover:border-[var(--border-active)] transition-colors duration-150">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-semibold text-[var(--text-faint)] uppercase tracking-[0.07em]">{s.label}</span>
              <div className="w-7 h-7 rounded-lg bg-[#00A8E1]/10 flex items-center justify-center">
                <s.icon size={14} className="text-[#00A8E1]" />
              </div>
            </div>
            <p className="text-2xl font-semibold text-[var(--text-primary)] tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="divider-dashed my-6" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {menuItems.map((item) => (
          <Link key={item.href} href={item.href} className="group window p-4 hover:border-[var(--border-active)] transition-all duration-150">
            <div className="w-8 h-8 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded flex items-center justify-center mb-3">
              <item.icon size={15} className="text-[#00A8E1]" />
            </div>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-[13px] font-medium text-[var(--text-primary)] mb-0.5">{item.title}</h3>
                <p className="text-[var(--text-muted)] text-[11px]">{item.desc}</p>
              </div>
              <ArrowUpRight size={12} className="text-[var(--text-faint)] group-hover:text-[#00A8E1] transition-colors duration-150 mt-0.5 shrink-0" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
