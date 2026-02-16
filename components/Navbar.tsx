'use client';

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
          {/* Logo/Brand */}
          <div className="flex items-center">
            <Link href="/" className="text-2xl font-bold hover:text-gray-300 transition-colors">
              Uniship
            </Link>
          </div>

          {/* Navigation Links */}
          {user && (
            <div className="hidden md:flex space-x-8">
              <Link 
                href="/dashboard" 
                className="hover:text-gray-300 transition-colors font-medium"
              >
                Dashboard
              </Link>
              <Link 
                href="/settings" 
                className="hover:text-gray-300 transition-colors font-medium"
              >
                Settings
              </Link>
              <Link 
                href="/profile" 
                className="hover:text-gray-300 transition-colors font-medium"
              >
                Profile
              </Link>
            </div>
          )}

          {/* Right side - User info & Logout */}
          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <span className="text-sm text-gray-300 hidden sm:block">
                  {user.email}
                </span>
                <button
                  onClick={handleLogout}
                  className="bg-white text-black px-4 py-2 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link 
                href="/login"
                className="bg-white text-black px-4 py-2 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {user && (
        <div className="md:hidden border-t border-gray-700">
          <div className="px-2 pt-2 pb-3 space-y-1">
            <Link
              href="/dashboard"
              className="block px-3 py-2 rounded-md hover:bg-gray-800 transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/settings"
              className="block px-3 py-2 rounded-md hover:bg-gray-800 transition-colors"
            >
              Settings
            </Link>
            <Link
              href="/profile"
              className="block px-3 py-2 rounded-md hover:bg-gray-800 transition-colors"
            >
              Profile
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}