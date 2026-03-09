'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  FileText,
  Briefcase,
  ClipboardCheck,
  BarChart3,
  Calendar,
  User,
  LogOut,
  Menu,
  X,
  Search,
  Command,
  PenTool,
  Download,
  GraduationCap,
} from 'lucide-react';

const navLinks = [
  { href: '/user/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/user/test-portal', label: 'Tests', icon: FileText },
  { href: '/user/internships', label: 'Internships', icon: Briefcase },
  { href: '/user/applications', label: 'Applications', icon: ClipboardCheck },
  { href: '/user/results', label: 'Results', icon: BarChart3 },
  { href: '/user/calendar', label: 'Calendar', icon: Calendar },
];

const searchablePages = [
  { href: '/user/dashboard', label: 'Dashboard', desc: 'Overview & quick stats', icon: LayoutDashboard },
  { href: '/user/test-portal', label: 'Test Portal', desc: 'Take assessments', icon: FileText },
  { href: '/user/internships', label: 'Internships', desc: 'Browse opportunities', icon: Briefcase },
  { href: '/user/applications', label: 'Applications', desc: 'Track submissions', icon: ClipboardCheck },
  { href: '/user/results', label: 'Results', desc: 'View performance', icon: BarChart3 },
  { href: '/user/calendar', label: 'Calendar', desc: 'Upcoming events', icon: Calendar },
  { href: '/user/profile', label: 'Profile', desc: 'Account settings', icon: User },
  { href: '/user/resume', label: 'Resume Builder', desc: 'AI-powered resume', icon: PenTool },
  { href: '/user/resume/download', label: 'Export Resume', desc: 'Download PDF', icon: Download },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredPages = searchQuery.trim()
    ? searchablePages.filter(p =>
        p.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.desc.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : searchablePages;

  // Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdkOpen(prev => !prev);
        setSearchQuery('');
        setSelectedIndex(0);
      }
      if (e.key === 'Escape') {
        setCmdkOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (cmdkOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [cmdkOpen]);

  // Reset selected index on filter change
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  const handleCmdkNavigate = useCallback((href: string) => {
    router.push(href);
    setCmdkOpen(false);
    setSearchQuery('');
  }, [router]);

  const handleCmdkKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % filteredPages.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredPages.length) % filteredPages.length);
    } else if (e.key === 'Enter' && filteredPages[selectedIndex]) {
      handleCmdkNavigate(filteredPages[selectedIndex].href);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + '/');

  return (
    <>
      {/* ── Main Navbar ── */}
      <nav className="sticky top-0 z-40 h-14 bg-[#09090b]/80 backdrop-blur-xl border-b border-zinc-800/60">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-full flex items-center justify-between">
          {/* Left: Logo + Nav */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <GraduationCap size={20} className="text-violet-400" />
              <span className="text-[15px] font-semibold text-zinc-100">Uniship</span>
            </Link>

            {/* Desktop segmented nav */}
            <div className="hidden md:flex items-center bg-zinc-900/60 rounded-lg p-0.5 border border-zinc-800/50">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-all duration-150 ${
                    isActive(link.href)
                      ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Right: Search trigger + Profile */}
          <div className="flex items-center gap-2">
            {/* Cmd+K search trigger */}
            <button
              onClick={() => { setCmdkOpen(true); setSearchQuery(''); setSelectedIndex(0); }}
              className="hidden sm:flex items-center gap-2 h-8 pl-3 pr-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-400 transition-all text-[13px]"
            >
              <Search size={14} />
              <span>Search...</span>
              <kbd className="ml-3 flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[11px] text-zinc-500 font-mono">
                <Command size={10} />K
              </kbd>
            </button>

            {user && (
              <>
                <Link
                  href="/user/profile"
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                    isActive('/user/profile')
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                  }`}
                >
                  <div className="w-5 h-5 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-full flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white">{user.email?.[0]?.toUpperCase()}</span>
                  </div>
                  <span className="hidden lg:inline max-w-[100px] truncate">{user.email?.split('@')[0]}</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="hidden sm:flex items-center p-2 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-zinc-800/50 transition-all"
                  title="Logout"
                >
                  <LogOut size={15} />
                </button>
              </>
            )}

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-lg text-zinc-500 hover:bg-zinc-800 transition-colors"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileOpen && (
          <div className="md:hidden border-t border-zinc-800 bg-[#0c0c0e] animate-fade-in">
            <div className="px-3 py-2 space-y-0.5">
              {/* Mobile search */}
              <button
                onClick={() => { setCmdkOpen(true); setMobileOpen(false); setSearchQuery(''); }}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm text-zinc-500 hover:bg-zinc-800/60"
              >
                <Search size={16} />
                Search...
              </button>
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive(link.href)
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60'
                  }`}
                >
                  <link.icon size={16} />
                  {link.label}
                </Link>
              ))}
              <Link
                href="/user/profile"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive('/user/profile')
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60'
                }`}
              >
                <User size={16} />
                Profile
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-zinc-800/60 w-full"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* ── Command-K Modal ── */}
      {cmdkOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
          {/* Backdrop */}
          <div
            className="absolute inset-0 cmdk-overlay"
            onClick={() => setCmdkOpen(false)}
          />
          {/* Dialog */}
          <div className="relative w-full max-w-lg mx-4 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl shadow-black/50 overflow-hidden animate-fade-in">
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 h-12 border-b border-zinc-800">
              <Search size={16} className="text-zinc-500 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Type a command or search..."
                className="flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleCmdkKeyDown}
              />
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px] text-zinc-500 font-mono shrink-0">
                ESC
              </kbd>
            </div>
            {/* Results */}
            <div className="max-h-[300px] overflow-y-auto py-2">
              {filteredPages.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-zinc-600">No results found.</p>
              ) : (
                <div className="px-2">
                  <p className="px-2 py-1.5 text-[11px] font-medium text-zinc-600 uppercase tracking-wider">Pages</p>
                  {filteredPages.map((page, i) => (
                    <button
                      key={page.href}
                      onClick={() => handleCmdkNavigate(page.href)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                        i === selectedIndex
                          ? 'bg-zinc-800 text-zinc-100'
                          : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
                      }`}
                    >
                      <page.icon size={16} className={i === selectedIndex ? 'text-violet-400' : 'text-zinc-600'} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{page.label}</p>
                        <p className="text-[12px] text-zinc-600 truncate">{page.desc}</p>
                      </div>
                      {i === selectedIndex && (
                        <span className="text-[11px] text-zinc-600">↵</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}