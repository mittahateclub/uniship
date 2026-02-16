'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function DashboardPage() {
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

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-black text-white p-8 rounded-lg shadow-2xl">
          <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

          <div className="space-y-4">
            <div className="border-t border-white pt-4">
              <p className="text-sm text-gray-300">Logged in as:</p>
              <p className="text-lg font-semibold">{user.email}</p>
            </div>

            <div className="border-t border-white pt-4">
              <p className="text-sm text-gray-300">User ID:</p>
              <p className="text-sm font-mono">{user.uid}</p>
            </div>

            <div className="border-t border-white pt-4">
              <p className="text-sm text-gray-300">Welcome to your dashboard!</p>
              <p className="text-sm mt-2">Use the navigation bar above to explore different sections.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}