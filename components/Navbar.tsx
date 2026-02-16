'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <nav className="bg-black text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="text-2xl font-bold">
            Uniship
          </Link>
          <div className="flex items-center space-x-4">
            {user && <span className="text-sm">{user.email}</span>}
            {user && (
              <button onClick={handleLogout} className="bg-white text-black px-4 py-2 rounded-lg font-semibold">
                x-4">
            {user && <span className="text-sm">{user.email}</span>}
            {user && (
              <button onClick={handleLogout} className="bg-white text-black px-4 py-2 rounded-lg font-semibold">
                Logout
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}