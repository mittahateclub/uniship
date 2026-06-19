'use client';

import { useState } from 'react';
import Mail from '@/components/icons/Mail';
import Lock from '@/components/icons/Lock';
import ArrowRight from '@/components/icons/ArrowRight';
import Eye from '@/components/icons/Eye';
import EyeOff from '@/components/icons/EyeOff';
import Image from 'next/image';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';

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
  const [showPassword, setShowPassword] = useState(false);
  return (
    <div className="login-root" id="main-content">
      {/* Brand panel — fills the space with the product story (desktop) */}
      <aside className="login-brand">
        <Link href="/" className="login-wordmark">
          <Image src="/logo.png" alt="Uniship" width={40} height={40} priority className="login-wordmark-img" />
          <span>UNISHIP</span>
        </Link>

        <div className="login-brand-copy">
          <h2>Your Career <em>Launchpad</em> Starts Here</h2>
          <p>
            Uniship connects students with placement opportunities, internships, and full-time roles - matched to your skills, your college, your future.
          </p>
        </div>

        <div className="login-brand-foot">
          <span>© 2026 Uniship</span>
        </div>
      </aside>

      {/* Form panel */}
      <div className="login-main">
        <div className="login-chrome">
          <Link href="/" className="login-wordmark login-wordmark-mobile">
            <Image src="/logo.png" alt="Uniship" width={36} height={36} priority className="login-wordmark-img" />
            <span>UNISHIP</span>
          </Link>
          <ThemeToggle className="login-theme-btn" />
        </div>

        <div className="login-stage">
          <div className="login-box">
            <h1 className="login-title">Sign in to your Uniship account</h1>

            {error && <div className="login-error" role="alert">{error}</div>}

            <form onSubmit={onSubmit} className="login-form">
              <div className="login-field">
                <label htmlFor="login-email">Email</label>
                <div className="login-input-wrap">
                  <Mail size={14} aria-hidden="true" />
                  <input
                    id="login-email"
                    type="email"
                    placeholder="you@university.edu"
                    value={email}
                    onChange={(e) => onEmailChange(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="login-field">
                <label htmlFor="login-password">Password</label>
                <div className="login-input-wrap">
                  <Lock size={14} aria-hidden="true" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => onPasswordChange(e.target.value)}
                    required
                    style={{ paddingRight: 40 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="login-eye"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    title={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={isLoading} className="login-btn">
                {isLoading ? (
                  <div className="loading-dots"><span /><span /><span /></div>
                ) : (
                  <>
                    Sign In
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>

            <p className="login-foot">Powered by Uniship</p>
          </div>
        </div>
      </div>


    </div>
  );
}
