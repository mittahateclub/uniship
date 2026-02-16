'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';

export default function UniadminDashboard() {
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
    { title: 'Create Test', href: '/uniadmin/create-test', icon: '📝' },
    { title: 'Create Account', href: '/uniadmin/create-account', icon: '➕' },
    { title: 'Manage Accounts', href: '/uniadmin/manage', icon: '👥' },
    { title: 'Student Analysis', href: '/uniadmin/analysis', icon: '📊' },
    { title: 'Create Event', href: '/uniadmin/create-event', icon: '📅' },
    { title: 'Student Database', href: '/uniadmin/students', icon: '🗄️' },
    { title: 'Profile', href: '/uniadmin/profile', icon: '⚙️' },
  ];

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-black mb-2">University Admin Dashboard</h1>
          <p className="text-gray-600">Welcome back, {user.email}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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

        {/* Quick Stats */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-black text-white p-6 rounded-lg">
            <p className="text-sm text-gray-300">Active Tests</p>
            <p className="text-3xl font-bold mt-2">0</p>
          </div>
          <div className="bg-black text-white p-6 rounded-lg">
            <p className="text-sm text-gray-300">Total Students</p>
            <p className="text-3xl font-bold mt-2">0</p>
          </div>
          <div className="bg-black text-white p-6 rounded-lg">
            <p className="text-sm text-gray-300">Upcoming Events</p>
            <p className="text-3xl font-bold mt-2">0</p>
          </div>
        </div>
      </div>
    </div>
  );
}