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
  ArrowRight,
  GraduationCap
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
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-black"></div>
      </div>
    );
  }

  if (!user) return null;

  const menuItems = [
    { 
      title: 'Test Portal', 
      desc: 'Take your assessments and mock tests',
      href: '/user/test-portal', 
      icon: FileText, 
      color: 'text-blue-600', 
      bg: 'bg-blue-50' 
    },
    { 
      title: 'Internships', 
      desc: 'Explore new career opportunities',
      href: '/user/internships', 
      icon: Briefcase, 
      color: 'text-purple-600', 
      bg: 'bg-purple-50' 
    },
    { 
      title: 'My Applications', 
      desc: 'Track your submission status',
      href: '/user/applications', 
      icon: ClipboardCheck, 
      color: 'text-green-600', 
      bg: 'bg-green-50' 
    },
    { 
      title: 'Resume Builder', 
      desc: 'Create your AI-powered resume',
      href: '/user/resume', 
      icon: PenTool, 
      color: 'text-orange-600', 
      bg: 'bg-orange-50' 
    },
    { 
      title: 'My Results', 
      desc: 'View performance and analytics',
      href: '/user/results', 
      icon: BarChart3, 
      color: 'text-pink-600', 
      bg: 'bg-pink-50' 
    },
    { 
      title: 'Profile Settings', 
      desc: 'Update your academic details',
      href: '/user/profile', 
      icon: User, 
      color: 'text-gray-600', 
      bg: 'bg-gray-100' 
    },
  ];

  return (
    <div className="min-h-screen bg-[#F9FAFB] p-6 md:p-10 text-black">
      <div className="max-w-7xl mx-auto">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Student Dashboard</h1>
            <p className="text-gray-500 font-medium">Welcome back, <span className="text-black">{user.email}</span></p>
          </div>
          <Link 
            href="/user/calendar" 
            className="flex items-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-xl shadow-sm hover:bg-gray-50 transition-colors font-semibold text-sm"
          >
            <CalendarIcon size={18} />
            View Schedule
          </Link>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {[
            { label: 'Active Applications', value: '0', icon: ClipboardCheck },
            { label: 'Pending Tests', value: '0', icon: FileText },
            { label: 'Upcoming Events', value: '0', icon: CalendarIcon },
            { label: 'Average Score', value: 'N/A', icon: GraduationCap },
          ].map((stat, i) => (
            <div key={i} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{stat.label}</span>
                <stat.icon size={16} className="text-gray-300" />
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Main Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              <div className={`w-14 h-14 ${item.bg} ${item.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                <item.icon size={28} />
              </div>
              
              <div className="mb-4">
                <h3 className="text-xl font-bold mb-1">{item.title}</h3>
                <p className="text-gray-500 text-sm">{item.desc}</p>
              </div>

              <div className="flex items-center text-sm font-bold gap-1 group-hover:gap-2 transition-all">
                <span>Enter Portal</span>
                <ArrowRight size={16} />
              </div>
            </Link>
          ))}
        </div>

        {/* Footer Info / Tip */}
        <div className="mt-12 p-6 bg-black rounded-3xl text-white flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-gray-800 p-3 rounded-xl">
              <PenTool className="text-orange-400" />
            </div>
            <div>
              <p className="font-bold">Complete your Resume Profile</p>
              <p className="text-gray-400 text-sm">Improve your chances of getting shortlisted by 60%.</p>
            </div>
          </div>
          <Link 
            href="/user/resume" 
            className="bg-white text-black px-6 py-2 rounded-xl font-bold text-sm hover:bg-gray-200 transition-colors"
          >
            Update Now
          </Link>
        </div>
      </div>
    </div>
  );
}