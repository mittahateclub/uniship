// app/(protected)/user/dashboard/page.tsx
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
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

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
        <div className="loading-dots"><span /><span /><span /></div>
      </div>
    );
  }

  if (!user) return null;

  const menuItems = [
    { 
      title: 'Test Portal', 
      desc: 'Assessments & mock tests',
      href: '/user/test-portal', 
      icon: FileText, 
      accent: 'text-blue-400',
      accentBg: 'bg-blue-500/10',
    },
    { 
      title: 'Internships', 
      desc: 'Career opportunities',
      href: '/user/internships', 
      icon: Briefcase, 
      accent: 'text-violet-400',
      accentBg: 'bg-violet-500/10',
    },
    { 
      title: 'Applications', 
      desc: 'Track submissions',
      href: '/user/applications', 
      icon: ClipboardCheck, 
      accent: 'text-emerald-400',
      accentBg: 'bg-emerald-500/10',
    },
    { 
      title: 'Resume Builder', 
      desc: 'AI-powered resume',
      href: '/user/resume', 
      icon: PenTool, 
      accent: 'text-orange-400',
      accentBg: 'bg-orange-500/10',
    },
    { 
      title: 'Export Resume', 
      desc: 'Download A4 PDF',
      href: '/user/resume/download', 
      icon: Download, 
      accent: 'text-rose-400',
      accentBg: 'bg-rose-500/10',
    },
    { 
      title: 'Results', 
      desc: 'Performance analytics',
      href: '/user/results', 
      icon: BarChart3, 
      accent: 'text-pink-400',
      accentBg: 'bg-pink-500/10',
    },
    { 
      title: 'Profile', 
      desc: 'Academic details',
      href: '/user/profile', 
      icon: User, 
      accent: 'text-zinc-400',
      accentBg: 'bg-zinc-500/10',
    },
  ];

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-[1200px] mx-auto animate-fade-in">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-100">Dashboard</h1>
            <p className="text-zinc-500 text-sm mt-0.5">Welcome back, <span className="text-zinc-300">{user.email?.split('@')[0]}</span></p>
          </div>
          <Link 
            href="/user/calendar" 
            className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3.5 py-2 rounded-lg hover:border-zinc-700 transition-all text-sm font-medium text-zinc-400 hover:text-zinc-300"
          >
            <CalendarIcon size={15} className="text-violet-400" />
            View Schedule
          </Link>
        </div>

        {/* Stats bento row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6 stagger-children">
          {[
            { label: 'Applications', value: '0', icon: ClipboardCheck, accent: 'text-emerald-400' },
            { label: 'Pending Tests', value: '0', icon: FileText, accent: 'text-blue-400' },
            { label: 'Events', value: '0', icon: CalendarIcon, accent: 'text-violet-400' },
            { label: 'Avg Score', value: 'N/A', icon: GraduationCap, accent: 'text-orange-400' },
          ].map((stat, i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-medium text-zinc-600 uppercase tracking-wider">{stat.label}</span>
                <stat.icon size={14} className={stat.accent} />
              </div>
              <p className="text-xl font-semibold text-zinc-100">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Bento grid navigation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 stagger-children">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group bg-zinc-900 border border-zinc-800 rounded-xl p-5 card-hover"
            >
              <div className={`w-9 h-9 ${item.accentBg} rounded-lg flex items-center justify-center mb-4`}>
                <item.icon size={18} className={item.accent} />
              </div>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-[15px] font-medium text-zinc-200 mb-0.5">{item.title}</h3>
                  <p className="text-zinc-600 text-[13px]">{item.desc}</p>
                </div>
                <ArrowUpRight size={14} className="text-zinc-700 group-hover:text-zinc-400 transition-colors mt-1 shrink-0" />
              </div>
            </Link>
          ))}
        </div>

        {/* CTA banner */}
        <div className="mt-8 bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 animate-slide-up">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-violet-500/10 rounded-lg flex items-center justify-center shrink-0">
              <Sparkles size={18} className="text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-200">Complete your Resume Profile</p>
              <p className="text-zinc-600 text-[13px]">Boost shortlisting chances by 60%</p>
            </div>
          </div>
          <Link 
            href="/user/resume" 
            className="bg-zinc-100 text-zinc-900 px-4 py-2 rounded-lg text-sm font-medium hover:bg-white transition-colors shrink-0"
          >
            Update Now
          </Link>
        </div>
      </div>
    </div>
  );
}