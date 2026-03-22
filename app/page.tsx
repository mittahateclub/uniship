'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firestore';
import Link from 'next/link';
import { DM_Sans } from 'next/font/google';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-dm-sans',
});

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    async function checkUserRole() {
      if (!loading) {
        if (!user) {
          setChecking(false);
          return;
        }

        setChecking(true);
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const role = userDoc.data().role;
          switch (role) {
            case 'super_admin':
              router.push('/superadmin/dashboard');
              break;
            case 'university_admin':
              router.push('/uniadmin/dashboard');
              break;
            case 'student':
              router.push('/user/dashboard');
              break;
            default:
              router.push('/user/dashboard');
          }
        } else {
          router.push('/user/dashboard');
        }
      }
    }

    checkUserRole();
  }, [user, loading, router]);

  const scrollToId = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="loading-dots"><span /><span /><span /></div>
      </div>
    );
  }

  return (
    <div className={`${dmSans.variable} landing-root`}>
      <nav>
        <div className="nav-logo">
          <div className="icon">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3L2 8l10 5 10-5-10-5z" />
              <path d="M2 8v6" />
              <path d="M6 10.5v5c0 1.657 2.686 3 6 3s6-1.343 6-3v-5" />
            </svg>
          </div>
          Uniship
        </div>
        <div className="nav-right">
          <div className="nav-links">
            <a href="#" onClick={(e) => { e.preventDefault(); scrollToId('features'); }}>For Students</a>
            <a href="#" onClick={(e) => { e.preventDefault(); scrollToId('features'); }}>Universities</a>
          </div>
          <Link href="/login" className="nav-cta nav-cta-top">Sign In -&gt;</Link>
        </div>
      </nav>

      <section className="hero" id="hero">
        <div className="hero-grid" />

        <div className="hero-content">
          <div className="hero-badge">
            <span />
            With AI-based resume builder
          </div>

          <h1>
            Your Career
            <br />
            <em>Launchpad</em>
            <br />
            Starts Here
          </h1>

          <p className="hero-sub">
            Uniship connects students with placement opportunities, internships, and full-time roles - matched to your skills, your college, your future.
          </p>

          <div className="hero-actions">
            <Link href="/login" className="btn-primary">Get Started Free -&gt;</Link>
            <button className="btn-secondary" onClick={() => scrollToId('process')}>See How It Works</button>
          </div>
        </div>

        <div className="scroll-hint">
          Scroll to explore
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        </div>
      </section>

      <div className="process-shell">
        <div className="section" id="process">
          <div className="section-label">Process</div>
          <h2 className="section-title">Three steps to your first offer</h2>

          <div className="steps">
            <div className="step">
              <div className="step-num">01</div>
              <div className="step-icon">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4 3.582-7 8-7s8 3 8 7" />
                </svg>
              </div>
              <h3>Build Your Profile</h3>
              <p>Import your transcript, skills, and projects. Uniship builds a smart profile that speaks the language of recruiters.</p>
              <div className="step-line" />
            </div>
            <div className="step">
              <div className="step-num">02</div>
              <div className="step-icon">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.636 5.636l1.414 1.414M16.95 16.95l1.414 1.414M5.636 18.364l1.414-1.414M16.95 7.05l1.414-1.414" />
                  <circle cx="12" cy="12" r="4" />
                </svg>
              </div>
              <h3>Get Matched</h3>
              <p>Our AI cross-references your profile with live job openings from 1,800+ hiring partners to surface your best-fit roles.</p>
              <div className="step-line" />
            </div>
            <div className="step">
              <div className="step-num">03</div>
              <div className="step-icon">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </div>
              <h3>Apply &amp; Track</h3>
              <p>One-click applications, interview scheduling, and a real-time placement dashboard - all in one place.</p>
              <div className="step-line" />
            </div>
          </div>
        </div>
      </div>

      <div className="features-wrap" id="features">
        <div className="features-head">
          <div className="section-label">Features</div>
          <h2 className="section-title">Everything you need.<br />Nothing you don&apos;t.</h2>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feat-icon">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="12" width="4" height="9" rx="1" />
                <rect x="10" y="7" width="4" height="14" rx="1" />
                <rect x="17" y="3" width="4" height="18" rx="1" />
              </svg>
            </div>
            <h3>Placement Analytics</h3>
            <p>TPO dashboards give your placement cell live visibility into offer rates, hiring trends, and student pipeline.</p>
            <div className="tag-row">
              <span className="tag">For Colleges</span>
              <span className="tag">Exportable</span>
            </div>
          </div>

          <div className="feature-card">
            <div className="feat-icon">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <line x1="10" y1="9" x2="8" y2="9" />
              </svg>
            </div>
            <h3>Resume Builder</h3>
            <p>Students generate ATS-friendly, role-specific resumes with one click - tailored automatically per application.</p>
            <div className="tag-row">
              <span className="tag">Auto-Tailored</span>
              <span className="tag">ATS-Friendly</span>
            </div>
          </div>

          <div className="feature-card">
            <div className="feat-icon">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="7" r="3" />
                <path d="M2 20c0-3.314 3.134-6 7-6s7 2.686 7 6" />
                <circle cx="18" cy="7" r="2" />
                <path d="M22 20c0-2.21-1.79-4-4-4" />
              </svg>
            </div>
            <h3>Interview Prep</h3>
            <p>Company-specific mock interviews, question banks, and peer practice sessions curated by domain.</p>
          </div>

          <div className="feature-card">
            <div className="feat-icon">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>
            <h3>Deadline Alerts</h3>
            <p>Never miss an application window. Smart reminders are synced to your calendar and sent via SMS or email.</p>
          </div>
        </div>
      </div>

      <div className="cta-banner">
        <h2>
          Ready to land your
          <br />
          <em>dream placement?</em>
        </h2>
        <p>Join Uniship.</p>
      </div>

      <footer>
        <div className="nav-logo">
          <div className="icon">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3L2 8l10 5 10-5-10-5z" />
              <path d="M2 8v6" />
              <path d="M6 10.5v5c0 1.657 2.686 3 6 3s6-1.343 6-3v-5" />
            </svg>
          </div>
          Uniship
        </div>
        <div className="footer-links">
          <a href="#" onClick={(e) => e.preventDefault()}>Privacy</a>
          <a href="#" onClick={(e) => e.preventDefault()}>Terms</a>
          <a href="#" onClick={(e) => e.preventDefault()}>Contact</a>
          <a href="#" onClick={(e) => e.preventDefault()}>Blog</a>
        </div>
        <div className="footer-copy">© 2026 Uniship. All rights reserved.</div>
      </footer>

      <style jsx global>{`
        :root {
          --orange: #E8510A;
          --orange-light: #FF6B2B;
          --orange-glow: rgba(232,81,10,0.18);
          --bg: #0A0A0A;
          --bg-card: #121212;
          --bg-card2: #181818;
          --border: rgba(255,255,255,0.07);
          --text: #F0EDE8;
          --muted: #7A7570;
          --muted2: #4A4540;
        }

        [data-theme='light'] {
          --bg: #F7F4EF;
          --bg-card: #FFFFFF;
          --bg-card2: #F3ECE3;
          --border: rgba(45,35,24,0.12);
          --text: #1F1A14;
          --muted: #655C51;
          --muted2: #8A7E6F;
        }

        .landing-root, .landing-root * {
          box-sizing: border-box;
        }

        html { scroll-behavior: smooth; }

        .landing-root {
          background: var(--bg);
          color: var(--text);
          font-family: var(--font-dm-sans), sans-serif;
          font-weight: 400;
          letter-spacing: normal;
          font-stretch: normal;
          overflow-x: hidden;
          cursor: default;
          min-height: 100vh;
        }

        .landing-root::before {
          content: '';
          position: fixed;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
          pointer-events: none;
          z-index: 9999;
          opacity: 0.08;
        }

        nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 48px;
          background: linear-gradient(to bottom, rgba(10,10,10,0.95), rgba(10,10,10,0.7), transparent);
          backdrop-filter: blur(8px);
        }

        [data-theme='light'] nav {
          background: linear-gradient(to bottom, rgba(247,244,239,0.95), rgba(247,244,239,0.7), transparent);
        }

        .nav-right {
          display: flex;
          align-items: center;
          gap: 18px;
        }

        .nav-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          font-family: var(--font-dm-sans), sans-serif;
          font-weight: 800;
          font-size: 1.2rem;
          letter-spacing: -0.02em;
        }

        .nav-logo .icon {
          width: 34px;
          height: 34px;
          background: var(--bg-card2);
          border-radius: 8px;
          border: 1px solid var(--border);
          display: grid;
          place-items: center;
          font-size: 16px;
        }

        .nav-logo .icon svg {
          width: 17px;
          height: 17px;
          stroke: var(--orange);
        }

        .nav-links {
          display: flex;
          gap: 36px;
          align-items: center;
        }

        .nav-links a {
          text-decoration: none;
          color: var(--muted);
          font-size: 0.85rem;
          letter-spacing: 0.01em;
          font-weight: 400;
          transition: color 0.2s;
        }

        .nav-links a:hover { color: var(--text); }

        .nav-cta {
          background: var(--orange);
          color: #fff;
          border: none;
          padding: 9px 22px;
          border-radius: 6px;
          font-family: var(--font-dm-sans), sans-serif;
          font-weight: 700;
          font-size: 0.8rem;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          transition: background 0.2s, transform 0.15s;
          text-decoration: none;
        }

        .nav-cta:hover {
          background: var(--orange-light);
          transform: translateY(-1px);
        }

        .hero {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          justify-content: center;
          padding: 140px 48px 80px;
          position: relative;
          overflow: hidden;
          text-align: left;
        }

        .hero-content {
          position: relative;
          z-index: 1;
          width: min(100%, 1200px);
          margin: 0 auto;
          padding-right: 48%;
        }

        .hero::after {
          content: '';
          position: absolute;
          top: 20%;
          left: 50%;
          transform: translateX(-50%);
          width: 600px;
          height: 400px;
          background: radial-gradient(ellipse, rgba(232,81,10,0.10) 0%, transparent 70%);
          pointer-events: none;
        }

        .hero-grid {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image: linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px);
          background-size: 60px 60px;
          mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 80%);
          opacity: 0.5;
        }

        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid rgba(232,81,10,0.3);
          background: rgba(232,81,10,0.07);
          padding: 6px 14px;
          border-radius: 100px;
          margin-bottom: 32px;
          font-size: 0.75rem;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          color: var(--orange-light);
          animation: fadeUp 0.6s ease both;
          position: relative;
          z-index: 1;
        }

        .hero-badge span {
          width: 6px;
          height: 6px;
          background: var(--orange);
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        .hero h1 {
          font-family: var(--font-dm-sans), sans-serif;
          font-weight: 800;
          font-size: clamp(3rem, 7vw, 6rem);
          line-height: 1;
          letter-spacing: -0.03em;
          max-width: 760px;
          position: relative;
          z-index: 1;
          animation: fadeUp 0.7s 0.1s ease both;
        }

        .hero h1 em {
          font-style: normal;
          background: linear-gradient(135deg, var(--orange) 0%, var(--orange-light) 60%, #FFAD5E 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .hero-sub {
          margin-top: 24px;
          max-width: 520px;
          color: var(--muted);
          font-size: 1.05rem;
          line-height: 1.65;
          animation: fadeUp 0.7s 0.2s ease both;
          position: relative;
          z-index: 1;
        }

        .hero-actions {
          display: flex;
          gap: 14px;
          margin-top: 44px;
          flex-wrap: wrap;
          justify-content: flex-start;
          animation: fadeUp 0.7s 0.3s ease both;
          position: relative;
          z-index: 1;
        }

        .btn-primary {
          background: var(--orange);
          color: #fff;
          border: none;
          padding: 14px 32px;
          border-radius: 8px;
          font-family: var(--font-dm-sans), sans-serif;
          font-weight: 700;
          font-size: 0.9rem;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
          box-shadow: 0 0 32px rgba(232,81,10,0.3);
          text-decoration: none;
        }

        .btn-primary:hover {
          background: var(--orange-light);
          transform: translateY(-2px);
          box-shadow: 0 0 48px rgba(232,81,10,0.45);
        }

        .btn-secondary {
          background: transparent;
          color: var(--text);
          border: 1px solid var(--border);
          padding: 14px 32px;
          border-radius: 8px;
          font-family: var(--font-dm-sans), sans-serif;
          font-weight: 600;
          font-size: 0.9rem;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-secondary:hover {
          border-color: rgba(232,81,10,0.3);
          background: rgba(232,81,10,0.08);
        }

        .scroll-hint {
          position: absolute;
          bottom: 36px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          color: var(--muted2);
          font-size: 0.7rem;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          animation: bounce 2s 1.5s ease infinite;
        }

        .scroll-hint svg { width: 18px; }

        .process-shell {
          background: var(--bg-card);
          padding: 2px 0;
        }

        .section {
          padding: 100px 48px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .section-label {
          font-size: 0.72rem;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--orange);
          margin-bottom: 16px;
          font-weight: 500;
        }

        .section-title {
          font-family: var(--font-dm-sans), sans-serif;
          font-weight: 800;
          font-size: clamp(2rem, 4vw, 3rem);
          letter-spacing: -0.03em;
          line-height: 1.1;
          max-width: 560px;
        }

        .steps {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2px;
          margin-top: 64px;
          background: var(--border);
          border-radius: 16px;
          overflow: hidden;
        }

        .step {
          background: var(--bg-card);
          padding: 40px 36px;
          position: relative;
          overflow: hidden;
          transition: background 0.3s;
        }

        .step:hover { background: var(--bg-card2); }

        .step-num {
          font-family: var(--font-dm-sans), sans-serif;
          font-weight: 800;
          font-size: 4rem;
          color: var(--muted2);
          line-height: 1;
          letter-spacing: -0.04em;
          margin-bottom: 20px;
        }

        .step-icon {
          width: 44px;
          height: 44px;
          background: var(--orange-glow);
          border-radius: 10px;
          display: grid;
          place-items: center;
          margin-bottom: 20px;
          border: 1px solid rgba(232,81,10,0.2);
        }

        .step-icon svg {
          width: 20px;
          height: 20px;
          stroke: var(--orange-light);
        }

        .step h3 {
          font-family: var(--font-dm-sans), sans-serif;
          font-weight: 700;
          font-size: 1.1rem;
          margin-bottom: 10px;
          letter-spacing: -0.01em;
        }

        .step p {
          color: var(--muted);
          font-size: 0.9rem;
          line-height: 1.6;
        }

        .step-line {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: var(--orange);
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.4s ease;
        }

        .step:hover .step-line { transform: scaleX(1); }

        .features-wrap {
          padding: 100px 48px;
          background: var(--bg);
        }

        .features-head {
          max-width: 1200px;
          margin: 0 auto;
        }

        .features-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2px;
          margin-top: 64px;
          max-width: 1200px;
          margin-left: auto;
          margin-right: auto;
          background: var(--border);
          border-radius: 16px;
          overflow: hidden;
        }

        .feature-card {
          background: var(--bg-card);
          padding: 44px;
          transition: background 0.3s;
          position: relative;
          overflow: hidden;
        }

        .feature-card:hover { background: var(--bg-card2); }

        .feature-card .feat-icon {
          margin-bottom: 20px;
          width: 52px;
          height: 52px;
          background: var(--orange-glow);
          border-radius: 12px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(232,81,10,0.15);
        }

        .feat-icon svg {
          width: 24px;
          height: 24px;
          stroke: var(--orange-light);
        }

        .feature-card h3 {
          font-family: var(--font-dm-sans), sans-serif;
          font-weight: 700;
          font-size: 1.15rem;
          margin-bottom: 10px;
          letter-spacing: -0.01em;
        }

        .feature-card p {
          color: var(--muted);
          line-height: 1.65;
          font-size: 0.9rem;
          max-width: 420px;
        }

        .tag-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 20px;
        }

        .tag {
          padding: 5px 12px;
          background: rgba(232,81,10,0.08);
          border: 1px solid rgba(232,81,10,0.2);
          border-radius: 100px;
          font-size: 0.75rem;
          color: var(--orange-light);
          letter-spacing: 0.01em;
        }

        .cta-banner {
          margin: 0 48px 100px;
          border-radius: 20px;
          background: linear-gradient(135deg, #1A0D08 0%, #0D0D0D 60%);
          border: 1px solid rgba(232,81,10,0.2);
          padding: 80px 60px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }

        [data-theme='light'] .cta-banner {
          background: linear-gradient(135deg, #FFF7EE 0%, #F4E8D8 60%);
          border: 1px solid rgba(232,81,10,0.28);
        }

        .cta-banner::before {
          content: '';
          position: absolute;
          top: -80px;
          left: 50%;
          transform: translateX(-50%);
          width: 500px;
          height: 300px;
          background: radial-gradient(ellipse, rgba(232,81,10,0.15), transparent 70%);
          pointer-events: none;
        }

        .cta-banner h2 {
          font-family: var(--font-dm-sans), sans-serif;
          font-weight: 800;
          font-size: clamp(2rem, 4vw, 3.2rem);
          letter-spacing: -0.03em;
          position: relative;
          z-index: 1;
        }

        .cta-banner em {
          color: var(--orange-light);
          font-style: normal;
        }

        .cta-banner p {
          color: var(--muted);
          margin-top: 16px;
          font-size: 1rem;
          position: relative;
          z-index: 1;
        }

        footer {
          border-top: 1px solid var(--border);
          padding: 36px 48px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
        }

        footer .nav-logo { font-size: 1rem; }

        .footer-links {
          display: flex;
          gap: 28px;
        }

        .footer-links a {
          text-decoration: none;
          color: var(--muted);
          font-size: 0.8rem;
          transition: color 0.2s;
        }

        .footer-links a:hover { color: var(--text); }

        .footer-copy {
          color: var(--muted2);
          font-size: 0.75rem;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        @keyframes bounce {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(6px); }
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 768px) {
          nav { padding: 18px 24px; }
          .nav-links { display: none; }
          .nav-right { margin-left: auto; }
          .nav-cta-top { padding: 8px 16px; font-size: 0.75rem; }
          .hero { padding: 120px 24px 60px; }
          .hero-content { padding-right: 0; }
          .section { padding: 60px 24px; }
          .steps { grid-template-columns: 1fr; }
          .features-grid { grid-template-columns: 1fr; }
          .cta-banner { margin: 0 24px 60px; padding: 50px 28px; }
          footer { padding: 28px 24px; flex-direction: column; align-items: flex-start; }
        }
      `}</style>
    </div>
  );
}
