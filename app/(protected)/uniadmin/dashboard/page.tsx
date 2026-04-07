'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import Link from 'next/link';
import {
  FileText, ClipboardCheck, UserPlus, CalendarPlus,
  Database, Settings, PlusCircle, ArrowUpRight,
  Users, Calendar as CalendarIcon,
} from 'lucide-react';

export default function UniAdminDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [adminData, setAdminData] = useState<any>(null);
  const [stats, setStats] = useState({ activeTests: 0, totalStudents: 0, upcomingEvents: 0 });

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  useEffect(() => {
    async function fetchDashboardData() {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setAdminData(data);
          const univId = data.universityId;
          if (univId) {
            const [studentSnap, testSnap, eventSnap] = await Promise.all([
              getDocs(query(collection(db, 'users'), where('universityId', '==', univId), where('role', '==', 'student'))),
              getDocs(query(collection(db, 'pdf_uploads'), where('universityId', '==', univId))),
              getDocs(query(collection(db, 'events'), where('universityId', '==', univId))),
            ]);
            setStats({ totalStudents: studentSnap.size, activeTests: testSnap.size, upcomingEvents: eventSnap.size });
          }
        }
      }
    }
    fetchDashboardData();
  }, [user]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="loading-dots"><span /><span /><span /></div>
    </div>
  );

  const tools = [
    { title: 'Create AI Test', desc: 'Upload PDFs to generate questions.', href: '/uniadmin/create-test', icon: PlusCircle },
    { title: 'Manage Tests', desc: 'View & approve AI-generated tests.', href: '/uniadmin/tests', icon: ClipboardCheck },
    { title: 'Create Account', desc: 'Register new student profiles.', href: '/uniadmin/create-account', icon: UserPlus },
    { title: 'Create Event', desc: 'Post workshops & seminars.', href: '/uniadmin/create-event', icon: CalendarPlus },
    { title: 'Student Database', desc: 'View all registered students.', href: '/uniadmin/student-database', icon: Database },
    { title: 'Admin Profile', desc: 'Settings & credentials.', href: '/uniadmin/profile', icon: Settings },
  ];

  return (
    <div className="max-w-[1100px] mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-[-0.02em]">University Admin Dashboard</h1>
        <p className="text-[var(--text-tertiary)] text-[13px] mt-1">Welcome back, <span className="text-[var(--text-primary)]">{user?.email?.split('@')[0]}</span></p>
      </div>

      {/* Stats */}
      <div id="stats" className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Active Tests', value: stats.activeTests, icon: FileText },
          { label: 'Total Students', value: stats.totalStudents, icon: Users },
          { label: 'Upcoming Events', value: stats.upcomingEvents, icon: CalendarIcon },
        ].map((s, i) => (
          <div key={i} className="window p-5 hover:border-[var(--border-active)] transition-colors duration-150">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-widest">{s.label}</span>
              <div className="w-7 h-7 rounded-lg bg-[#00A8E1]/10 flex items-center justify-center">
                <s.icon size={14} className="text-[#00A8E1]" />
              </div>
            </div>
            <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="divider-dashed my-6" />

      {/* Tools Grid */}
      <h2 className="text-[13px] font-bold text-[var(--text-faint)] uppercase tracking-widest mb-4">Management Tools</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {tools.map((item) => (
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