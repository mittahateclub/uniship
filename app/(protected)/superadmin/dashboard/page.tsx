'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';

export default function SuperadminDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({
    totalUniadmins: 0,
    totalStudents: 0,
    totalUniversities: 0,
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    async function fetchStats() {
      try {
        // Get uniadmins count
        const uniadminsQuery = query(collection(db, 'users'), where('role', '==', 'uniadmin'));
        const uniadminsSnapshot = await getDocs(uniadminsQuery);
        
        // Get students count
        const studentsQuery = query(collection(db, 'users'), where('role', '==', 'user'));
        const studentsSnapshot = await getDocs(studentsQuery);

        setStats({
          totalUniadmins: uniadminsSnapshot.size,
          totalStudents: studentsSnapshot.size,
          totalUniversities: uniadminsSnapshot.size, // For now, 1 uni per admin
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    }

    if (user) {
      fetchStats();
    }
  }, [user]);

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
    { title: 'Create Uniadmins', href: '/superadmin/create-uniadmin', icon: '➕' },
    { title: 'Manage Uniadmins', href: '/superadmin/manage-uniadmins', icon: '👥' },
    { title: 'System Analytics', href: '/superadmin/analytics', icon: '📊' },
    { title: 'Profile', href: '/superadmin/profile', icon: '⚙️' },
  ];

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-black mb-2">Superadmin Dashboard</h1>
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
            <p className="text-sm text-gray-300">Total Universities</p>
            <p className="text-3xl font-bold mt-2">{stats.totalUniversities}</p>
          </div>
          <div className="bg-black text-white p-6 rounded-lg">
            <p className="text-sm text-gray-300">Total Uni Admins</p>
            <p className="text-3xl font-bold mt-2">{stats.totalUniadmins}</p>
          </div>
          <div className="bg-black text-white p-6 rounded-lg">
            <p className="text-sm text-gray-300">Total Students</p>
            <p className="text-3xl font-bold mt-2">{stats.totalStudents}</p>
          </div>
        </div>
      </div>
    </div>
  );
}