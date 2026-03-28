'use client';

import React from "react";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Command, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, role, logout } = useAuth();

  const roleLabel = role === 'super_admin' ? 'Super Admin' : role === 'university_admin' ? 'Uni Admin' : 'Student';

  const handleLogout = async () => {
    try { await logout(); router.push('/'); } catch {}
  };

  return (
    <div className="flex h-screen bg-[var(--bg-primary)] overflow-hidden">
      <Navbar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <div className="h-14 bg-[var(--bg-primary)] border-b border-[var(--border-subtle)] flex items-center shrink-0 px-5 gap-4">
          {/* Search — centered */}
          <div className="flex-1 flex justify-center">
            <button
              onClick={() => document.dispatchEvent(new CustomEvent('open-cmdk'))}
              className="flex items-center gap-2.5 w-full max-w-md px-3 py-1.5 rounded-md text-[13px] text-[var(--text-muted)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-active)] transition-all duration-150 cursor-text"
              title="Search (⌘K)"
            >
              <Search size={14} className="shrink-0 text-[var(--text-faint)]" />
              <span className="flex-1 text-left text-[var(--text-faint)]">Search pages, actions...</span>
              <kbd className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[10px] font-mono text-[var(--text-faint)] shrink-0">
                <Command size={9} />K
              </kbd>
            </button>
          </div>
          {/* Profile */}
          {user && (
            <div className="flex items-center gap-2.5 shrink-0">
              <Link
                href={role === 'super_admin' ? '/superadmin/dashboard' : role === 'university_admin' ? '/uniadmin/profile' : '/user/profile'}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity duration-150"
              >
                <div className="w-7 h-7 bg-[#F54E00] rounded-full flex items-center justify-center shrink-0">
                  <span className="text-[11px] font-bold text-black">{user.email?.[0]?.toUpperCase()}</span>
                </div>
                <div className="min-w-0 hidden lg:block">
                  <p className="text-[12px] font-medium text-[var(--text-primary)] truncate leading-tight">{user.email?.split('@')[0]}</p>
                  <p className="text-[10px] text-[var(--text-faint)] uppercase tracking-wider leading-tight">{roleLabel}</p>
                </div>
              </Link>
              <button
                onClick={handleLogout}
                className="p-1 rounded text-[var(--text-faint)] hover:text-[#F54E00] transition-colors duration-150"
                title="Logout"
              >
                <LogOut size={14} />
              </button>
            </div>
          )}
        </div>
        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}