'use client';
import { Link } from 'next-view-transitions';

import React from "react";
import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";
import ThemeToggle from "@/components/ThemeToggle";
import Image from "next/image";
import Search from '@/components/icons/Search';
import Menu from '@/components/icons/Menu';
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

const SupportChat = dynamic(() => import("@/components/SupportChat"), { ssr: false });
const AdminSupportChat = dynamic(() => import("@/components/AdminSupportChat"), { ssr: false });
const NotificationCenter = dynamic(() => import("@/components/NotificationCenter"), { ssr: false });

export default function ProtectedLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <ProtectedShell>{children}</ProtectedShell>
    </AuthProvider>
  );
}

function ProtectedShell({ children }: { children: React.ReactNode }) {
  const { user, role, userName, userPhotoURL } = useAuth();
  const isStudent = !!user && role !== "university_admin" && role !== "super_admin";
  const isUniversityAdmin = !!user && role === "university_admin";

  return (
    <div className="flex h-screen bg-[var(--bg-canvas)] overflow-hidden transition-colors duration-300">
      <Navbar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top strip — floats on the canvas, no chrome box */}
        <div className="h-14 flex items-center shrink-0 px-3 md:px-5 gap-2 md:gap-4">
          {/* Mobile logo — left side */}
          <Link href="/" className="md:hidden flex items-center gap-1 shrink-0">
            <Image src="/logo.png" alt="Uniship" width={56} height={56} priority className="shrink-0 object-contain" />
            <span className="text-[14px] font-bold tracking-[0.14em] text-[var(--text-primary)] leading-none pt-[0.2em]">UNISHIP</span>
          </Link>
          {/* Search — centered pill */}
          <div className="flex-1 flex justify-center">
            <button
              onClick={() => document.dispatchEvent(new CustomEvent('open-cmdk'))}
              className="flex items-center gap-3 w-full max-w-md h-9 md:pl-6 md:pr-3.5 pl-5 pr-3 rounded-full text-[13px] text-[var(--text-muted)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-active)] transition-colors duration-150 cursor-text"
              title="Search (⌘K)"
            >
              <Search size={14} className="shrink-0 text-[var(--text-faint)]" />
              <span className="flex-1 text-left text-[var(--text-faint)] hidden sm:inline">Search pages, actions...</span>
              <span className="flex-1 text-left text-[var(--text-faint)] sm:hidden text-[12px]">Search...</span>
              <kbd className="hidden sm:flex items-center px-1.5 py-0.5 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[10px] font-mono text-[var(--text-faint)] shrink-0">
                ⌘K
              </kbd>
            </button>
          </div>
          {isStudent && <NotificationCenter />}
          <ThemeToggle />
          {/* Profile — hidden on mobile to save space */}
          {user && (
            <div className="hidden md:flex items-center gap-2.5 shrink-0">
              <Link
                href={role === 'super_admin' ? '/superadmin/dashboard' : role === 'university_admin' ? '/uniadmin/profile' : '/user/profile'}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity duration-150"
                >
                  {userPhotoURL ? (
                    // eslint-disable-next-line @next/next/no-img-element -- authenticated profile photos can come from arbitrary user-configured hosts.
                    <img src={userPhotoURL} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-7 h-7 bg-[var(--accent-orange)] rounded-full flex items-center justify-center shrink-0">
                    <span className="text-[11px] font-semibold text-[var(--accent-ink)]">{(userName || user.email)?.[0]?.toUpperCase()}</span>
                  </div>
                )}
                <div className="min-w-0 hidden lg:block">
                  <p className="text-[12px] font-medium text-[var(--text-primary)] truncate leading-tight">{userName || user.email?.split('@')[0]}</p>
                </div>
              </Link>
            </div>
          )}
          {/* Mobile hamburger — right side */}
          <button
            onClick={() => document.dispatchEvent(new CustomEvent('toggle-mobile-nav'))}
            className="md:hidden p-1.5 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors shrink-0"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
        </div>
        {/* Content panel — workspace surface inset on the canvas */}
        <div className="flex-1 min-h-0 px-2 md:px-3 pb-2 md:pb-3">
          <main id="main-content" className="app-panel h-full overflow-y-auto overflow-x-hidden px-3 md:px-6 pb-10">
            {children}
          </main>
        </div>
      </div>
      {isStudent && <SupportChat />}
      {isUniversityAdmin && <AdminSupportChat />}
    </div>
  );
}
