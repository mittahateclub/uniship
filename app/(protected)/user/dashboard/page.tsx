// app/(protected)/user/dashboard/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  FileText, 
  Briefcase, 
  ClipboardCheck, 
  PenTool, 
  BarChart3, 
  Calendar as CalendarIcon, 
  User,
  ArrowUpRight,
  GraduationCap,
  Download,
  Sparkles,
} from 'lucide-react';

export default function UserDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({ applications: 0, pendingTests: 0, events: 0, avgScore: null as number | null });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    async function fetchStats() {
      if (!user) return;
      try {
        const [appsSnap, testsSnap, resultsSnap, eventsSnap] = await Promise.all([
          getDocs(query(collection(db, 'applications'), where('userId', '==', user.uid))),
          getDocs(collection(db, 'tests')),
          getDocs(query(collection(db, 'test_results'), where('userId', '==', user.uid))),
          getDocs(collection(db, 'events')),
        ]);

        const completedTestIds = new Set(resultsSnap.docs.map(d => d.data().testId));
        const pendingTests = testsSnap.docs.filter(d => !completedTestIds.has(d.id)).length;

        let avgScore: number | null = null;
        if (resultsSnap.size > 0) {
          const total = resultsSnap.docs.reduce((sum, d) => {
            const data = d.data();
            return sum + (data.score / data.totalQuestions) * 100;
          }, 0);
          avgScore = Math.round(total / resultsSnap.size);
        }

        setStats({
          applications: appsSnap.size,
          pendingTests,
          events: eventsSnap.size,
          avgScore,
        });
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      }
    }
    if (!loading && user) fetchStats();
  }, [user, loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-dots"><span /><span /><span /></div>
      </div>
    );
  }

  if (!user) return null;

  const menuItems = [
    { title: 'Test Portal', desc: 'Assessments & mock tests', href: '/user/test-portal', icon: FileText },
    { title: 'College Space', desc: 'Events & opportunities', href: '/user/internships', icon: Briefcase },
    { title: 'Applications', desc: 'Track submissions', href: '/user/applications', icon: ClipboardCheck },
    { title: 'AI Resume Builder', desc: 'AI-powered resume', href: '/user/resume', icon: Sparkles },
    { title: 'Export Resume', desc: 'Download A4 PDF', href: '/user/resume/download', icon: Download },
    { title: 'Results', desc: 'Performance analytics', href: '/user/results', icon: BarChart3 },
    { title: 'My Analysis', desc: 'Progress, speed and reliability', href: '/user/analysis', icon: BarChart3 },
    { title: 'Profile', desc: 'Academic details', href: '/user/profile', icon: User },
  ];

  return (
    <div className="max-w-[1100px] mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-[-0.02em]">Dashboard</h1>
          <p className="text-[var(--text-tertiary)] text-[13px] mt-1">Welcome back, <span className="text-[var(--text-primary)]">{user.email?.split('@')[0]}</span></p>
        </div>
        <Link 
          href="/user/calendar" 
          className="btn-secondary flex items-center gap-2 text-[13px]"
        >
          <CalendarIcon size={14} />
          View Schedule
        </Link>
      </div>

      {/* Stats row */}
      <div id="stats" className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Applications', value: String(stats.applications), icon: ClipboardCheck },
          { label: 'Pending Tests', value: String(stats.pendingTests), icon: FileText },
          { label: 'Events', value: String(stats.events), icon: CalendarIcon },
          { label: 'Avg Score', value: stats.avgScore !== null ? `${stats.avgScore}%` : 'N/A', icon: GraduationCap },
        ].map((stat, i) => (
          <div key={i} className="window p-5 hover:border-[var(--border-active)] transition-colors duration-150">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-widest">{stat.label}</span>
              <div className="w-7 h-7 rounded-lg bg-[#F54E00]/10 flex items-center justify-center">
                <stat.icon size={14} className="text-[#F54E00]" />
              </div>
            </div>
            <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="divider-dashed my-6" />

      {/* Navigation grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group window p-4 hover:border-[var(--border-active)] transition-all duration-150"
          >
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

      {/* CTA banner */}
      <div className="mt-8 window p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#F54E00]/10 rounded flex items-center justify-center shrink-0">
            <Sparkles size={15} className="text-[#F54E00]" />
          </div>
          <div>
            <p className="text-[13px] font-medium text-[var(--text-primary)]">Complete your Resume Profile</p>
            <p className="text-[var(--text-muted)] text-[11px]">Boost shortlisting chances by 60%</p>
          </div>
        </div>
        <Link href="/user/resume" className="btn-primary text-[13px] shrink-0">
          Update Now
        </Link>
      </div>
    </div>
  );
}