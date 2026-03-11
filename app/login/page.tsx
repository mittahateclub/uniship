'use client';

import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { GraduationCap, Mail, Lock, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const role = userData.role;

        if (role === 'super_admin') {
          router.push('/superadmin/dashboard');
        } else if (role === 'university_admin') {
          router.push('/uniadmin/dashboard');
        } else {
          router.push('/user/dashboard');
        }
      } else {
        setError("User profile not found.");
      }
    } catch (err: any) {
      setError("Invalid email or password.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] p-4">
      <div className="w-full max-w-sm animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded mb-4">
            <GraduationCap size={20} className="text-[#F54E00]" />
          </div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-[-0.02em]">Welcome back</h1>
          <p className="text-[var(--text-tertiary)] text-[13px] mt-1">Sign in to your Uniship account</p>
        </div>

        {/* Card */}
        <div className="bg-[var(--bg-surface)] rounded border border-[var(--border-subtle)] p-6">
          {error && (
            <div className="bg-[#F54E00]/10 text-[#F54E00] px-3 py-2 rounded text-[13px] font-medium mb-5 border border-[#F54E00]/20">
              {error}
            </div>
          )}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[12px] font-medium text-[var(--text-tertiary)] mb-1.5 uppercase tracking-wider">Email</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
                <input
                  type="email"
                  placeholder="you@university.edu"
                  className="w-full pl-9 pr-3 py-2 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[#5E6AD2] transition-all duration-150 text-[13px]"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                  className="w-full pl-9 pr-3 py-2 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[#5E6AD2] transition-all duration-150 text-[13px]"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#F54E00] text-black font-bold py-2 rounded hover:brightness-110 transition-all duration-150 text-[13px] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2 uppercase tracking-wider"
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