'use client';
import { Link } from 'next-view-transitions';

import UserPlus from '@/components/icons/UserPlus';
import ShieldCheck from '@/components/icons/ShieldCheck';
import Users from '@/components/icons/Users';
import ArrowUpRight from '@/components/icons/ArrowUpRight';
import Building2 from '@/components/icons/Building2';

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

  const metrics = [
    { label: 'Universities', value: stats.totalUniversities, note: 'Registered', icon: Building2 },
    { label: 'Uni Admins', value: stats.totalUniadmins, note: 'Across campuses', icon: ShieldCheck },
    { label: 'Students', value: stats.totalStudents, note: 'Enrolled', icon: Users },
  ];

  const menuItems = [
    { title: 'Create Uni Admin', desc: 'Add a new university admin', href: '/superadmin/create-uniadmin', icon: UserPlus },
    { title: 'Manage Admins', desc: 'View & manage all admins', href: '/superadmin/manage-uniadmins', icon: ShieldCheck },
    { title: 'Manage Students', desc: 'Edit & assign students to universities', href: '/superadmin/manage-students', icon: Users },
    { title: 'Universities', desc: 'Register & verify universities', href: '/superadmin/universities', icon: Building2 },
  ];

  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in">
      <div className="pt-8 mb-7">
        <h1 className="text-[26px] font-semibold text-[var(--text-primary)] tracking-[-0.025em]">Superadmin Dashboard</h1>
        <p className="text-[var(--text-tertiary)] text-[13.5px] mt-1.5">Welcome back, <span className="text-[var(--text-primary)]">{userEmail?.split('@')[0]}</span></p>
      </div>

      {/* ── Overview ── */}
      <div id="stats" className="grid grid-cols-1 sm:grid-cols-3 rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden mb-7">
        {metrics.map((m, i) => (
          <div key={m.label} className={`p-5 ${i < 2 ? 'border-b sm:border-b-0 sm:border-r border-[var(--border-subtle)]' : ''}`}>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)]">{m.label}</span>
              <m.icon size={14} className="text-[var(--text-faint)]" />
            </div>
            <p className="text-[27px] font-semibold text-[var(--text-primary)] tabular-nums tracking-[-0.03em] leading-none">{m.value}</p>
            <p className="text-[11.5px] text-[var(--text-faint)] mt-1.5">{m.note}</p>
          </div>
        ))}
      </div>

      {/* ── Quick actions ── */}
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)] mb-3">Quick actions</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 hover:border-[var(--border-active)] transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <span className="w-9 h-9 rounded-[8px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-tertiary)] group-hover:text-[var(--accent-orange)] transition-colors">
                <item.icon size={16} />
              </span>
              <ArrowUpRight size={15} className="text-[var(--text-faint)] opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition duration-200" />
            </div>
            <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">{item.title}</h3>
            <p className="text-[12px] text-[var(--text-tertiary)] mt-0.5">{item.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
