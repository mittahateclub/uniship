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
        <div className="text-black text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const menuItems = [
    { title: 'Test Portal', href: '/user/test-portal', icon: '📝' },
    { title: 'Calendar', href: '/user/calendar', icon: '📅' },
    { title: 'Internships', href: '/user/internships', icon: '💼' },
    { title: 'Resume Builder', href: '/user/resume', icon: '📄' },
    { title: 'My Results', href: '/user/results', icon: '📊' },
    { title: 'Profile', href: '/user/profile', icon: '⚙️' },
  ];

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-black mb-2">Student Dashboard</h1>
          <p className="text-gray-600">Welcome back, {user.email}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="bg-black text-white p-6 rounded-lg shadow-lg hover:bg-gray-800 transition-colors"
            >
              <div className="text-4xl mb-4">{item.icon}</div>
              <h3 className="text-xl font-semibold">{item.title}</h3>
            </Link>
          ))}
        </div>

        {/* Quick Info */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-black text-white p-6 rounded-lg">
            <p className="text-sm text-gray-300">Pending Tests</p>
            <p className="text-3xl font-bold mt-2">0</p>
          </div>
          <div className="bg-black text-white p-6 rounded-lg">
            <p className="text-sm text-gray-300">Upcoming Events</p>
            <p className="text-3xl font-bold mt-2">0</p>
          </div>
          <div className="bg-black text-white p-6 rounded-lg">
            <p className="text-sm text-gray-300">Applications</p>
            <p className="text-3xl font-bold mt-2">0</p>
          </div>
        </div>
      </div>
    </div>
  );
}