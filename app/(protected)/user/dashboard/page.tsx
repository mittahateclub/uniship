'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';

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
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-black text-xl font-bold italic">Loading Dashboard...</div>
      </div>
    );
  }

  if (!user) return null;

  // Added 'Applications' to this list
  const menuItems = [
    { title: 'Test Portal', href: '/user/test-portal', icon: '📝' },
    { title: 'Internships', href: '/user/internships', icon: '💼' },
    { title: 'My Applications', href: '/user/applications', icon: '📁' }, // NEW LINK
    { title: 'Resume Builder', href: '/user/resume', icon: '📄' },
    { title: 'My Results', href: '/user/results', icon: '📊' },
    { title: 'Calendar', href: '/user/calendar', icon: '📅' },
    { title: 'Profile', href: '/user/profile', icon: '👤' },
  ];

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 border-b-4 border-black pb-4">
          <h1 className="text-4xl font-black text-black mb-2 uppercase tracking-tighter">Student Dashboard</h1>
          <p className="text-gray-600 font-bold">Welcome back, {user.email}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group border-4 border-black p-6 hover:bg-black hover:text-white transition-all shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-none"
            >
              <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">{item.icon}</div>
              <h3 className="text-xl font-black uppercase tracking-tight">{item.title}</h3>
            </Link>
          ))}
        </div>

        {/* Quick Info */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white">
            <p className="text-xs font-black uppercase text-gray-500">Active Applications</p>
            <p className="text-4xl font-black mt-2">0</p>
          </div>
          <div className="border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white">
            <p className="text-xs font-black uppercase text-gray-500">Upcoming Tests</p>
            <p className="text-4xl font-black mt-2">0</p>
          </div>
          <div className="border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white">
            <p className="text-xs font-black uppercase text-gray-500">Saved Internships</p>
            <p className="text-4xl font-black mt-2">0</p>
          </div>
        </div>
      </div>
    </div>
  );
}