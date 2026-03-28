'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { UserPlus, ShieldCheck, BarChart3, Users, GraduationCap, ArrowUpRight, Building2 } from 'lucide-react';

export default function SuperadminDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({ totalUniadmins: 0, totalStudents: 0, totalUniversities: 0 });

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [uniadminsSnapshot, studentsSnapshot, universitiesSnapshot] = await Promise.all([
          getDocs(query(collection(db, 'users'), where('role', '==', 'university_admin'))),
          getDocs(query(collection(db, 'users'), where('role', '==', 'student'))),
          getDocs(collection(db, 'universities')),
        ]);
        setStats({
          totalUniadmins: uniadminsSnapshot.size,
          totalStudents: studentsSnapshot.size,
          totalUniversities: universitiesSnapshot.size,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    }
    if (user) fetchStats();
  }, [user]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="loading-dots"><span /><span /><span /></div>
    </div>
  );

  if (!user) return null;

  const menuItems = [
    { title: 'Create Uni Admin', desc: 'Add a new university admin.', href: '/superadmin/create-uniadmin', icon: UserPlus },
    { title: 'Manage Admins', desc: 'View & manage all admins.', href: '/superadmin/manage-uniadmins', icon: ShieldCheck },
    { title: 'Manage Students', desc: 'Edit and assign students to universities.', href: '/superadmin/manage-students', icon: Users },
    { title: 'Universities', desc: 'Register & verify universities.', href: '/superadmin/universities', icon: Building2 },
  ];

  return (
    <div className="max-w-[1100px] mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-[-0.02em]">Superadmin Dashboard</h1>
        <p className="text-[var(--text-tertiary)] text-[13px] mt-1">Welcome back, <span className="text-[var(--text-primary)]">{user.email?.split('@')[0]}</span></p>
      </div>

      {/* Stats */}
      <div id="stats" className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Total Universities', value: stats.totalUniversities, icon: GraduationCap },
          { label: 'Uni Admins', value: stats.totalUniadmins, icon: ShieldCheck },
          { label: 'Total Students', value: stats.totalStudents, icon: Users },
        ].map((s, i) => (
          <div key={i} className="window p-5 hover:border-[var(--border-active)] transition-colors duration-150">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-widest">{s.label}</span>
              <div className="w-7 h-7 rounded-lg bg-[#F54E00]/10 flex items-center justify-center">
                <s.icon size={14} className="text-[#F54E00]" />
              </div>
            </div>
            <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="divider-dashed my-6" />

      {/* Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {menuItems.map((item) => (
          <Link key={item.href} href={item.href} className="group window p-4 hover:border-[var(--border-active)] transition-all duration-150">
            <div className="w-8 h-8 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded flex items-center justify-center mb-3">
              <item.icon size={15} className="text-[#F54E00]" />
            </div>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-[13px] font-medium text-[var(--text-primary)] mb-0.5">{item.title}</h3>
                <p className="text-[var(--text-muted)] text-[11px]">{item.desc}</p>
              </div>
              <ArrowUpRight size={12} className="text-[var(--text-faint)] group-hover:text-[#F54E00] transition-colors duration-150 mt-0.5 shrink-0" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}