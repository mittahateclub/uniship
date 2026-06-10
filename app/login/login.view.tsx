'use client';

import { Mail, Lock, ArrowRight } from 'lucide-react';
import Image from 'next/image';

export interface LoginViewProps {
  email: string;
  password: string;
  error: string;
  isLoading: boolean;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function LoginView({ email, password, error, isLoading, onEmailChange, onPasswordChange, onSubmit }: LoginViewProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[var(--bg-primary)]">
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(var(--border-subtle) 1px, transparent 1px), linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
        opacity: 0.4,
      }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 70% 60% at 50% 50%, transparent 0%, var(--bg-primary) 100%)',
      }} />


      <div className="w-full max-w-sm animate-fade-in relative z-10">
        <div className="absolute inset-0 -z-10 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 90% 80% at 50% 60%, rgba(0,168,225,0.18) 0%, transparent 70%)',
          filter: 'blur(24px)',
        }} />
        <div className="text-center mb-4">
          <div className="flex justify-center -mb-10">
            <Image src="/logo.png" alt="Uniship" width={1775} height={490} priority className="object-contain w-auto" style={{ maxHeight: 490 }} />
          </div>
          <p className="text-[var(--text-tertiary)] text-[13px] mt-0">Sign in to your Uniship account</p>
        </div>

        <div className="bg-[var(--bg-surface)] rounded border border-[var(--border-subtle)] p-6">
          {error && (
            <div className="bg-red-500/10 text-red-500 px-3 py-2 rounded text-[13px] font-medium mb-5 border border-red-500/20">
              {error}
            </div>
          )}
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-[12px] font-medium text-[var(--text-tertiary)] mb-1.5 uppercase tracking-wider">Email</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
                <input
                  type="email"
                  placeholder="you@university.edu"
                  className="w-full pl-9 pr-3 py-2 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[#4B8BBE] transition-all duration-150 text-[13px]"
                  value={email}
                  onChange={(e) => onEmailChange(e.target.value)}
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[var(--text-tertiary)] mb-1.5 uppercase tracking-wider">Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[#4B8BBE] transition-all duration-150 text-[13px]"
                  value={password}
                  onChange={(e) => onPasswordChange(e.target.value)}
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#00A8E1] text-white font-bold py-2 rounded hover:brightness-110 transition-all duration-150 text-[13px] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2 uppercase tracking-wider"
            >
              {isLoading ? (
                <div className="loading-dots"><span /><span /><span /></div>
              ) : (
                <>
                  Sign In
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-[var(--text-faint)] mt-6 uppercase tracking-widest">
          Powered by Uniship
        </p>
      </div>
    </div>
  );
}
