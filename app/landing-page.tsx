'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { DM_Sans } from 'next/font/google';


const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-dm-sans',
});

export default function Home() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(false);

  // Redirect authenticated users to their dashboard using role from AuthContext
  // (eliminates a redundant Firestore read on every landing page visit)
  useEffect(() => {
    if (loading) return;
    if (!user || !role) {
      setChecking(false);
      return;
    }

    setChecking(true);
    switch (role) {
      case 'super_admin':
        router.push('/superadmin/dashboard');
        break;
      case 'university_admin':
        router.push('/uniadmin/dashboard');
        break;
      default:
        router.push('/user/dashboard');
    }
  }, [user, role, loading, router]);

  useEffect(() => {
    if (loading || checking) return;

    const widget = document.getElementById('apWidget') as HTMLElement | null;
    const card = document.getElementById('apCard') as HTMLElement | null;
    const statBadge = document.getElementById('apStatBadge') as HTMLElement | null;

    if (!widget || !card || !statBadge) return;

    const timeouts: number[] = [];

    const applyTilt = (rx: number, ry: number) => {
      card.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
      card.style.boxShadow = `${-ry * 2}px ${rx * 2 + 16}px 0 rgba(0,0,0,0.32), 0 22px 48px rgba(0,0,0,0.45)`;
    };

    const onMouseMove = (e: MouseEvent) => {
      const r = card.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = (e.clientX - cx) / (r.width / 2);
      const dy = (e.clientY - cy) / (r.height / 2);
      applyTilt(-dy * 10, dx * 10);
    };

    const onMouseLeave = () => {
      card.style.transition = 'transform 0.7s cubic-bezier(.4,0,.2,1), box-shadow 0.3s';
      applyTilt(0, 0);
      const t = window.setTimeout(() => {
        card.style.transition = 'transform 0.08s linear, box-shadow 0.3s';
      }, 700);
      timeouts.push(t);
    };

    let touchStartX = 0;
    let touchStartY = 0;
    let isTouchDragging = false;

    const onTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      isTouchDragging = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isTouchDragging) return;
      const dx = (e.touches[0].clientX - touchStartX) / 15;
      const dy = (e.touches[0].clientY - touchStartY) / 15;
      applyTilt(-dy, dx);
    };

    const onTouchEnd = () => {
      isTouchDragging = false;
      card.style.transition = 'transform 0.7s cubic-bezier(.4,0,.2,1), box-shadow 0.3s';
      applyTilt(0, 0);
      const t = window.setTimeout(() => {
        card.style.transition = 'transform 0.08s linear, box-shadow 0.3s';
      }, 700);
      timeouts.push(t);
    };

    const onDocMouseMove = (e: MouseEvent) => {
      const wx = window.innerWidth / 2;
      const wy = window.innerHeight / 2;
      const dx = (e.clientX - wx) / wx;
      const dy = (e.clientY - wy) / wy;
      statBadge.style.transform = `rotate(-2deg) translate(${-dx * 6}px, ${-dy * 6}px)`;
    };

    widget.addEventListener('mousemove', onMouseMove);
    widget.addEventListener('mouseleave', onMouseLeave);
    card.addEventListener('touchstart', onTouchStart, { passive: true });
    card.addEventListener('touchmove', onTouchMove, { passive: true });
    card.addEventListener('touchend', onTouchEnd);
    document.addEventListener('mousemove', onDocMouseMove);

    return () => {
      timeouts.forEach((id) => window.clearTimeout(id));
      widget.removeEventListener('mousemove', onMouseMove);
      widget.removeEventListener('mouseleave', onMouseLeave);
      card.removeEventListener('touchstart', onTouchStart);
      card.removeEventListener('touchmove', onTouchMove);
      card.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('mousemove', onDocMouseMove);
    };
  }, [loading, checking]);

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
          <Image src="/logo.png" alt="Uniship" width={94} height={94} className="nav-logo-img" />
          <span className="nav-logo-text">UNISHIP</span>
        </div>
        <div className="nav-right">
          <Link href="/login" className="nav-cta nav-cta-top">Sign In -&gt;</Link>
        </div>
      </nav>

      <section className="hero" id="hero">
        <div className="hero-layout">
          <div className="hero-content">
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
              <Link href="/login" className="btn-primary">SIGN IN -&gt;</Link>
            </div>
          </div>

          <div className="hero-right">
            <div className="ap-widget sketch-widget" id="apWidget">

              <div className="ap-stat-badge" id="apStatBadge">
                <div className="ap-stat-num">3</div>
                <div className="ap-stat-label">Shortlisted</div>
              </div>

              <div className="ap-card" id="apCard">
                <div className="ap-card-inner">
                  <div className="ap-accent-bar" />

                  <div className="ap-topbar">
                    <span className="ap-topbar-title">My Applications</span>
                    <span className="ap-live">
                      <span className="ap-live-dot" />
                      Live
                    </span>
                  </div>

                  <div className="ap-submitting-row">
                    <div className="ap-job-logo" style={{ background: 'linear-gradient(135deg,#1a56db,#0e3fa8)' }}>GS</div>
                    <div className="ap-submitting-body">
                      <div className="ap-submitting-title">Goldman Sachs — Analyst</div>
                      <div className="ap-submitting-label">Submitting application…</div>
                      <div className="ap-bar-track"><div className="ap-bar-fill" /></div>
                    </div>
                  </div>

                  <div className="ap-job-list">
                    <div className="ap-job-row">
                      <div className="ap-job-logo-sm" style={{ background: 'linear-gradient(135deg,#0052cc,#003d99)' }}>MS</div>
                      <div className="ap-job-info">
                        <div className="ap-job-title">Microsoft — SDE Intern</div>
                        <div className="ap-job-meta">₹85,000/mo · Hyderabad</div>
                      </div>
                      <span className="ap-status ap-s-short">Shortlisted ✓</span>
                    </div>
                    <div className="ap-job-row">
                      <div className="ap-job-logo-sm" style={{ background: 'linear-gradient(135deg,#e8710a,#c75300)' }}>AM</div>
                      <div className="ap-job-info">
                        <div className="ap-job-title">Amazon — SDE Intern</div>
                        <div className="ap-job-meta">₹90,000/mo · Bangalore</div>
                      </div>
                      <span className="ap-status ap-s-review">Under Review</span>
                    </div>
                    <div className="ap-job-row">
                      <div className="ap-job-logo-sm" style={{ background: 'linear-gradient(135deg,#1a73e8,#0d5bcc)' }}>GO</div>
                      <div className="ap-job-info">
                        <div className="ap-job-title">Google — STEP Intern</div>
                        <div className="ap-job-meta">₹1,20,000/mo · Remote</div>
                      </div>
                      <span className="ap-status ap-s-applied">Applied</span>
                    </div>
                    <div className="ap-job-row">
                      <div className="ap-job-logo-sm" style={{ background: 'linear-gradient(135deg,#2d2d2d,#111)' }}>UB</div>
                      <div className="ap-job-info">
                        <div className="ap-job-title">Uber — Backend Engineer</div>
                        <div className="ap-job-meta">₹70,000/mo · Pune</div>
                      </div>
                      <span className="ap-status ap-s-new">New</span>
                    </div>
                  </div>

                  <div className="ap-footer">
                    <div className="ap-footer-stat">
                      <div className="ap-footer-num">8<em>+</em></div>
                      <div className="ap-footer-label">Applied</div>
                    </div>
                    <div className="ap-footer-divider" />
                    <div className="ap-footer-stat">
                      <div className="ap-footer-num">3</div>
                      <div className="ap-footer-label">Shortlisted</div>
                    </div>
                    <div className="ap-footer-divider" />
                    <div className="ap-footer-stat">
                      <div className="ap-footer-num">1</div>
                      <div className="ap-footer-label">Interview</div>
                    </div>
                  </div>
                </div>

                <div className="ap-corner tl" />
                <div className="ap-corner tr" />
                <div className="ap-corner bl" />
                <div className="ap-corner br" />
              </div>

            </div>
          </div>
        </div>

        <div className="scroll-hint">
          Scroll to explore
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        </div>
      </section>

      <div className="about-shell" id="about">
        <div className="about-inner">
          <div className="about-label">About us</div>
          <h2 className="about-title">Built to simplify <em>placements</em>.</h2>
          <p className="about-body">
            Uniship is a unified placement platform that bridges the gap between students and placement cells.
            We bring company listings, mock assessments, AI-powered resume building, and application tracking
            into one seamless experience — simplifying the process of placements.
          </p>
        </div>
      </div>

      <div className="feat-section" id="features">
        <div className="feat-head">
          <h2 className="feat-title">Everything you need to get placed</h2>
          <p className="feat-sub">A complete toolkit built for students, powered by AI, loved by placement cells.</p>
        </div>
        <div className="feat-cards">
          <div className="feat-card">
            <div className="feat-icon">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect x="2" y="7" width="20" height="14" rx="2"/>
              </svg>
            </div>
            <h3>Smart Job Applications</h3>
            <p>Apply to top companies and track your applications effortlessly.</p>
          </div>
          <div className="feat-card">
            <div className="feat-icon">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="9 13 11 15 15 11"/>
              </svg>
            </div>
            <h3>Mock Tests &amp; Assessments</h3>
            <p>Practice real placement tests and improve with instant feedback.</p>
          </div>
          <div className="feat-card">
            <div className="feat-icon">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
              </svg>
            </div>
            <h3>AI Resume Builder</h3>
            <p>Create ATS-ready resumes tailored for your target roles.</p>
          </div>
          <div className="feat-card">
            <div className="feat-icon">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <h3>College Space</h3>
            <p>Stay updated with drives, events, and placement announcements.</p>
          </div>
          <div className="feat-card">
            <div className="feat-icon">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
              </svg>
            </div>
            <h3>Practice Arena</h3>
            <p>Solve curated problems and climb the leaderboard.</p>
          </div>
        </div>
      </div>

      <div className="how-section" id="how">
        <h2 className="how-title">From profile to placement in four steps</h2>
        <p className="how-sub">A clear path from your first login to your first offer.</p>
        <div className="how-steps">
          <div className="how-step">
            <div className="how-num">01</div>
            <h4>Sign up with your college</h4>
            <p>Verify with your university email and join your placement cell automatically.</p>
          </div>
          <div className="how-step">
            <div className="how-num">02</div>
            <h4>Build your AI resume</h4>
            <p>Answer a few questions — get a recruiter-ready resume in minutes.</p>
          </div>
          <div className="how-step">
            <div className="how-num">03</div>
            <h4>Practice &amp; prepare</h4>
            <p>Take mock tests targeted at the companies visiting your campus.</p>
          </div>
          <div className="how-step">
            <div className="how-num">04</div>
            <h4>Apply &amp; get hired</h4>
            <p>Apply in one click and track every application until you land the offer.</p>
          </div>
        </div>
      </div>



      <footer>
        <div className="nav-logo">
          <Image src="/logo.png" alt="Uniship" width={96} height={96} className="nav-logo-img" />
          <span className="nav-logo-text">UNISHIP</span>
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
          --orange: #00A8E1;
          --orange-light: #33BBEE;
          --orange-glow: rgba(0,168,225,0.18);
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
          padding: 6px 48px;
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
          gap: 5px;
          font-family: var(--font-dm-sans), sans-serif;
          font-weight: 800;
          font-size: 1.2rem;
          letter-spacing: -0.02em;
          line-height: 1;
        }

        .nav-logo-img {
          object-fit: contain;
          flex-shrink: 0;
        }

        .nav-logo-text {
          font-size: 1.5rem;
          font-weight: 800;
          letter-spacing: 0.14em;
          color: var(--text);
          align-self: center;
          padding-top: 0.35em;
          line-height: 1;
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

        .hero-layout {
          position: relative;
          z-index: 1;
          width: min(100%, 1200px);
          margin: 0 auto;
          display: grid;
          grid-template-columns: minmax(420px, 1fr) minmax(360px, 420px);
          gap: 42px;
          align-items: center;
        }

        .hero-content {
          min-width: 0;
        }

        .hero::after {
          content: '';
          position: absolute;
          top: 20%;
          left: 34%;
          transform: translateX(-34%);
          width: 600px;
          height: 400px;
          background: radial-gradient(ellipse, rgba(0,168,225,0.10) 0%, transparent 70%);
          pointer-events: none;
        }

        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid rgba(0,168,225,0.3);
          background: rgba(0,168,225,0.07);
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
          background: linear-gradient(135deg, var(--orange) 0%, var(--orange-light) 60%, #99E0F5 100%);
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

        .hero-right {
          position: relative;
          display: flex;
          justify-content: flex-end;
          align-items: center;
          min-height: 560px;
        }

        .ap-widget {
          position: relative;
          width: 380px;
          perspective: 1000px;
          user-select: none;
          animation: fadeUp 0.8s 0.2s ease both;
        }

        .ap-widget.sketch-widget {
          filter: sepia(0.1) saturate(0.7) contrast(1.12) brightness(0.98);
        }
        [data-theme='light'] .ap-widget.sketch-widget {
          filter: sepia(0.05) saturate(0.9) contrast(1.04) brightness(1.08);
        }
        [data-theme='dark'] .ap-widget.sketch-widget {
          filter: sepia(0.12) saturate(0.7) contrast(1.18) brightness(0.98);
        }

        .ap-stat-badge {
          position: absolute;
          top: -28px;
          left: -40px;
          z-index: 10;
          width: 80px;
          height: 80px;
          background: #0A1520;
          border: 1.5px dashed rgba(0,168,225,0.42);
          border-radius: 14px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          box-shadow: 5px 6px 0 rgba(0,0,0,0.24), 0 10px 26px rgba(0,0,0,0.3);
          transform: rotate(-2deg);
          transition: transform 0.3s, box-shadow 0.3s;
        }

        .ap-stat-badge:hover {
          transform: rotate(-2deg) scale(1.04) translateY(-2px);
          box-shadow: 7px 9px 0 rgba(0,0,0,0.28), 0 14px 32px rgba(0,0,0,0.34);
        }

        .ap-stat-num {
          font-weight: 800;
          font-size: 1.7rem;
          color: #00A8E1;
          line-height: 1;
        }

        .ap-stat-label {
          font-size: 0.47rem;
          letter-spacing: 0.07em;
          color: rgba(255,255,255,0.3);
          text-transform: uppercase;
          white-space: nowrap;
          font-weight: 700;
        }

        .ap-card {
          width: 100%;
          background:
            repeating-linear-gradient(0deg, rgba(255,255,255,0.02) 0 1px, transparent 1px 19px),
            repeating-linear-gradient(90deg, rgba(255,255,255,0.015) 0 1px, transparent 1px 19px),
            radial-gradient(circle at 30% 20%, rgba(255,255,255,0.06), transparent 60%),
            #0C1825;
          border: 1.5px dashed rgba(255,255,255,0.24);
          border-radius: 16px;
          position: relative;
          overflow: hidden;
          transform-style: preserve-3d;
          transition: transform 0.08s linear, box-shadow 0.3s;
          box-shadow: 14px 16px 0 rgba(0,0,0,0.32), 0 22px 48px rgba(0,0,0,0.45), 0 0 0 1px rgba(0,168,225,0.06);
          cursor: grab;
        }

        .ap-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(-18deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 9px);
          opacity: 0.22;
          pointer-events: none;
        }

        .ap-card::after {
          content: '';
          position: absolute;
          inset: 6px;
          border: 1.25px dashed rgba(255,255,255,0.2);
          border-radius: 12px;
          opacity: 0.5;
          pointer-events: none;
        }

        .ap-card:active { cursor: grabbing; }

        .ap-card-inner {
          padding: 20px 22px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .ap-accent-bar {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 2px;
          background: linear-gradient(90deg, transparent, #00A8E1 40%, transparent);
          opacity: 0.6;
        }

        .ap-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .ap-topbar-title {
          font-size: 11px;
          font-weight: 700;
          color: rgba(255,255,255,0.4);
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .ap-live {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          color: #22c55e;
          font-weight: 600;
        }

        .ap-live-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 7px #22c55e;
          animation: apLivePulse 1.5s ease-in-out infinite;
        }

        @keyframes apLivePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        .ap-submitting-row {
          background: rgba(0,168,225,0.05);
          border: 1px dashed rgba(0,168,225,0.3);
          border-radius: 10px;
          padding: 12px 14px;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .ap-job-logo {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          flex-shrink: 0;
          display: grid;
          place-items: center;
          font-weight: 800;
          font-size: 11px;
          color: #fff;
        }

        .ap-submitting-body { flex: 1; min-width: 0; }

        .ap-submitting-title {
          font-size: 12px;
          font-weight: 700;
          color: rgba(240,237,232,0.9);
          margin-bottom: 5px;
        }

        .ap-submitting-label {
          font-size: 10px;
          color: #00A8E1;
          margin-bottom: 5px;
          font-weight: 500;
        }

        .ap-bar-track {
          height: 2px;
          background: rgba(0,168,225,0.15);
          border-radius: 99px;
          overflow: hidden;
        }

        .ap-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #00A8E1, #66D0F0);
          border-radius: 99px;
          animation: apBarProgress 3.2s cubic-bezier(.4,0,.2,1) infinite;
        }

        @keyframes apBarProgress {
          0%   { width: 0%;   opacity: 1; }
          65%  { width: 100%; opacity: 1; }
          85%  { width: 100%; opacity: 0.4; }
          100% { width: 0%;   opacity: 0; }
        }

        .ap-job-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .ap-job-row {
          background: rgba(255,255,255,0.02);
          border: 1px dashed rgba(255,255,255,0.12);
          border-radius: 10px;
          padding: 10px 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          transition: border-color 0.2s, background 0.2s;
        }

        .ap-job-row:hover {
          border-color: rgba(0,168,225,0.35);
          background: rgba(0,168,225,0.04);
        }

        .ap-job-logo-sm {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          flex-shrink: 0;
          display: grid;
          place-items: center;
          font-weight: 800;
          font-size: 10px;
          color: #fff;
        }

        .ap-job-info { flex: 1; min-width: 0; }

        .ap-job-title {
          font-size: 12px;
          font-weight: 600;
          color: rgba(240,237,232,0.88);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ap-job-meta {
          font-size: 10px;
          color: rgba(122,117,112,0.8);
          margin-top: 2px;
        }

        .ap-status {
          font-size: 10px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 999px;
          white-space: nowrap;
          flex-shrink: 0;
          letter-spacing: 0.02em;
        }

        .ap-s-new     { background: rgba(255,255,255,0.04); color: rgba(122,117,112,0.9); border: 1px dashed rgba(255,255,255,0.15); }
        .ap-s-applied { background: rgba(0,168,225,0.1); color: #33BBEE; border: 1px dashed rgba(0,168,225,0.3); }
        .ap-s-short   { background: rgba(34,197,94,0.1); color: #22c55e; border: 1px dashed rgba(34,197,94,0.3); }
        .ap-s-review  { background: rgba(251,191,36,0.1); color: #fbbf24; border: 1px dashed rgba(251,191,36,0.3); }

        .ap-footer {
          border-top: 1px dashed rgba(255,255,255,0.1);
          padding-top: 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .ap-footer-stat { text-align: center; flex: 1; }

        .ap-footer-num {
          font-weight: 800;
          font-size: 18px;
          color: rgba(240,237,232,0.9);
          line-height: 1;
        }

        .ap-footer-num em { color: #00A8E1; font-style: normal; }

        .ap-footer-label {
          font-size: 9px;
          color: rgba(122,117,112,0.8);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-top: 3px;
        }

        .ap-footer-divider { width: 1px; height: 28px; background: rgba(255,255,255,0.07); }

        .ap-corner {
          position: absolute;
          width: 14px;
          height: 14px;
          pointer-events: none;
        }

        .ap-corner.tl { top: 10px; left: 10px; border-top: 1.5px dashed rgba(0,168,225,0.6); border-left: 1.5px dashed rgba(0,168,225,0.6); }
        .ap-corner.tr { top: 10px; right: 10px; border-top: 1.5px dashed rgba(0,168,225,0.6); border-right: 1.5px dashed rgba(0,168,225,0.6); }
        .ap-corner.bl { bottom: 10px; left: 10px; border-bottom: 1.5px dashed rgba(0,168,225,0.6); border-left: 1.5px dashed rgba(0,168,225,0.6); }
        .ap-corner.br { bottom: 10px; right: 10px; border-bottom: 1.5px dashed rgba(0,168,225,0.6); border-right: 1.5px dashed rgba(0,168,225,0.6); }
          position: absolute;
          top: -24px;
          left: -36px;
          z-index: 10;
          width: 92px;
          height: 92px;
          background: #0A1520;
          border: 1.5px dashed rgba(0,168,225,0.42);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 5px 6px 0 rgba(0,0,0,0.24), 0 10px 26px rgba(0,0,0,0.3);
          transform: rotate(-2deg);
          transition: transform 0.3s, box-shadow 0.3s;
        }

        .rw-score:hover {
          transform: rotate(-2deg) scale(1.04) translateY(-2px);
          box-shadow: 7px 9px 0 rgba(0,0,0,0.28), 0 14px 32px rgba(0,0,0,0.34);
        }

        .rw-score svg {
          position: absolute;
        }

        .rw-score-inner {
          position: relative;
          text-align: center;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .rw-score-num {
          display: block;
          font-weight: 800;
          font-size: 1.45rem;
          color: #00A8E1;
          line-height: 1;
        }

        .rw-score-label {
          position: absolute;
          top: 8px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 0.47rem;
          letter-spacing: 0.07em;
          color: rgba(255,255,255,0.3);
          text-transform: uppercase;
          white-space: nowrap;
          font-weight: 700;
        }

        .rw-ai-card {
          position: absolute;
          top: -16px;
          right: -20px;
          z-index: 10;
          background: #0A1520;
          border: 1.5px dashed rgba(0,168,225,0.46);
          border-radius: 10px;
          padding: 10px 14px;
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 185px;
          box-shadow: 4px 6px 0 rgba(0,0,0,0.22), 0 8px 24px rgba(0,0,0,0.28);
          transform: rotate(1.5deg);
          animation: floatCard 4s ease-in-out infinite;
        }

        .rw-ai-icon {
          font-size: 1rem;
          color: #00A8E1;
          animation: pulse 2.1s ease-in-out infinite;
        }

        .rw-ai-title {
          font-weight: 700;
          font-size: 0.68rem;
          color: #F0EDE8;
          letter-spacing: 0.03em;
        }

        .rw-ai-body {
          font-size: 0.65rem;
          color: #7A7570;
          margin-top: 2px;
        }

        .rw-ai-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #00A8E1;
          margin-left: auto;
          flex-shrink: 0;
          animation: pulse 1.8s ease infinite;
        }

        .rw-card {
          width: 100%;
          height: 100%;
          background:
            repeating-linear-gradient(0deg, rgba(255,255,255,0.02) 0 1px, transparent 1px 19px),
            repeating-linear-gradient(90deg, rgba(255,255,255,0.015) 0 1px, transparent 1px 19px),
            radial-gradient(circle at 30% 20%, rgba(255,255,255,0.06), transparent 60%),
            #0C1825;
          border: 1.5px dashed rgba(255,255,255,0.24);
          border-radius: 16px;
          position: relative;
          overflow: hidden;
          transform-style: preserve-3d;
          transition: transform 0.08s linear, box-shadow 0.3s;
          box-shadow: 14px 16px 0 rgba(0,0,0,0.32), 0 22px 48px rgba(0,0,0,0.45), 0 0 0 1px rgba(0,168,225,0.06);
          cursor: grab;
        }

        .rw-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(-18deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 9px);
          opacity: 0.22;
          pointer-events: none;
        }

        .rw-card::after {
          content: '';
          position: absolute;
          inset: 6px;
          border: 1.25px dashed rgba(255,255,255,0.2);
          border-radius: 12px;
          opacity: 0.5;
          pointer-events: none;
        }

        .rw-card:active {
          cursor: grabbing;
        }

        .rw-card-inner {
          padding: 20px 22px;
          height: 100%;
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .rw-accent-bar {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, rgba(0,168,225,0.95), rgba(51,187,238,0.7));
          border-radius: 16px 16px 0 0;
        }

        .rw-scan {
          position: absolute;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(0,168,225,0.4), transparent);
          pointer-events: none;
          top: 0;
          animation: scanDown 3.5s ease-in-out infinite;
          opacity: 0;
        }

        .rw-corner {
          position: absolute;
          width: 14px;
          height: 14px;
          pointer-events: none;
        }

        .rw-corner.tl {
          top: 10px;
          left: 10px;
          border-top: 1.5px dashed rgba(255,255,255,0.24);
          border-left: 1.5px dashed rgba(255,255,255,0.24);
        }

        .rw-corner.tr {
          top: 10px;
          right: 10px;
          border-top: 1.5px dashed rgba(255,255,255,0.24);
          border-right: 1.5px dashed rgba(255,255,255,0.24);
        }

        .rw-corner.bl {
          bottom: 10px;
          left: 10px;
          border-bottom: 1.5px dashed rgba(255,255,255,0.24);
          border-left: 1.5px dashed rgba(255,255,255,0.24);
        }

        .rw-corner.br {
          bottom: 10px;
          right: 10px;
          border-bottom: 1.5px dashed rgba(255,255,255,0.24);
          border-right: 1.5px dashed rgba(255,255,255,0.24);
        }

        .rw-header {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-top: 14px;
          margin-bottom: 14px;
        }

        .rw-avatar {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          flex-shrink: 0;
          background: linear-gradient(135deg, #00A8E1, #005F8A);
          display: grid;
          place-items: center;
          position: relative;
          font-weight: 800;
          font-size: 1rem;
          color: #fff;
          cursor: pointer;
          transition: transform 0.25s;
        }

        .rw-avatar:hover {
          transform: scale(1.1);
        }

        .rw-avatar-ring {
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          border: 1.5px dashed rgba(0,168,225,0.5);
          animation: spinRing 8s linear infinite;
        }

        .rw-name {
          font-weight: 800;
          font-size: 1rem;
          color: #F0EDE8;
        }

        .rw-role-tag {
          display: inline-block;
          margin-top: 3px;
          font-size: 0.65rem;
          letter-spacing: 0.05em;
          background: rgba(0,168,225,0.15);
          border: 1px solid rgba(0,168,225,0.3);
          border-radius: 100px;
          padding: 2px 8px;
          color: #33BBEE;
        }

        .rw-location {
          font-size: 0.65rem;
          color: #7A7570;
          margin-top: 4px;
        }

        .rw-tabs {
          display: flex;
          gap: 4px;
          margin-bottom: 12px;
          background: rgba(255,255,255,0.02);
          border: 1px dashed rgba(255,255,255,0.2);
          border-radius: 8px;
          padding: 3px;
        }

        .rw-tab {
          flex: 1;
          padding: 5px 6px;
          border: none;
          background: transparent;
          color: #7A7570;
          font-size: 0.68rem;
          font-weight: 600;
          letter-spacing: 0.02em;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .rw-tab.active {
          background: rgba(0,168,225,0.12);
          color: #33BBEE;
          box-shadow: inset 0 0 0 1px rgba(0,168,225,0.35);
        }

        .rw-tab:hover:not(.active) {
          color: #F0EDE8;
          background: rgba(255,255,255,0.04);
        }

        .rw-tab-panel {
          display: none;
          flex-direction: column;
          gap: 6px;
          flex: 1;
        }

        .rw-tab-panel.active {
          display: flex;
          animation: tabIn 0.25s ease both;
        }

        .rw-entry {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 9px 10px;
          border-radius: 8px;
          border: 1px dashed rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.02);
          transition: all 0.2s;
          cursor: pointer;
        }

        .rw-entry:hover {
          background: rgba(0,168,225,0.06);
          border-color: rgba(0,168,225,0.35);
          transform: translateX(3px);
        }

        .rw-entry-title {
          font-size: 0.75rem;
          font-weight: 500;
          color: #F0EDE8;
        }

        .rw-entry-sub {
          font-size: 0.65rem;
          color: #7A7570;
          margin-top: 2px;
        }

        .rw-entry-chip {
          font-size: 0.6rem;
          font-weight: 700;
          background: rgba(0,168,225,0.12);
          border: 1px dashed rgba(0,168,225,0.4);
          color: #33BBEE;
          border-radius: 20px;
          padding: 2px 8px;
          white-space: nowrap;
        }

        .rw-entry-chip.gpa {
          background: rgba(255,200,80,0.1);
          border-color: rgba(255,200,80,0.3);
          color: #ffc850;
        }

        .rw-skills-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .rw-skill {
          padding: 5px 12px;
          border-radius: 100px;
          font-size: 0.72rem;
          letter-spacing: 0.01em;
          background: rgba(0,168,225,0.08);
          border: 1px dashed rgba(0,168,225,0.34);
          color: rgba(255,255,255,0.6);
          cursor: pointer;
          transition: all 0.2s;
        }

        .rw-skill:hover,
        .rw-skill.active {
          background: rgba(0,168,225,0.16);
          border-color: rgba(0,168,225,0.5);
          color: #33BBEE;
          transform: translateY(-2px);
          box-shadow: 2px 3px 0 rgba(0,168,225,0.18);
        }

        .rw-skill-bar-wrap {
          margin-top: 10px;
          background: rgba(255,255,255,0.03);
          border: 1px dashed rgba(255,255,255,0.18);
          border-radius: 8px;
          padding: 10px 12px;
          animation: tabIn 0.2s ease both;
        }

        .rw-skill-bar-label {
          font-size: 0.72rem;
          font-weight: 500;
          color: #F0EDE8;
          margin-bottom: 6px;
        }

        .rw-skill-bar-track {
          height: 5px;
          background: rgba(255,255,255,0.06);
          border-radius: 10px;
          overflow: hidden;
        }

        .rw-skill-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #00A8E1, #66D0F0);
          border-radius: 10px;
          width: 0%;
          transition: width 0.6s cubic-bezier(.4,0,.2,1);
        }

        .rw-skill-bar-pct {
          font-size: 0.65rem;
          color: #00A8E1;
          text-align: right;
          margin-top: 4px;
        }

        .rw-generate-wrap {
          margin-top: auto;
          padding-top: 12px;
        }

        .rw-generate-btn {
          width: 100%;
          padding: 11px;
          border-radius: 7px;
          background: rgba(0,168,225,0.1);
          border: 1.5px dashed rgba(0,168,225,0.46);
          color: #33BBEE;
          font-weight: 700;
          font-size: 0.78rem;
          letter-spacing: 0.03em;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          transition: all 0.25s;
          position: relative;
          overflow: hidden;
        }

        .rw-generate-btn:hover {
          background: rgba(0,168,225,0.16);
          border-color: rgba(0,168,225,0.6);
          box-shadow: 3px 4px 0 rgba(0,168,225,0.22);
          transform: translateY(-1px);
        }

        .rw-generate-btn.loading {
          pointer-events: none;
        }

        .rw-gen-icon {
          font-size: 0.9rem;
        }

        .rw-gen-progress {
          height: 2px;
          background: linear-gradient(90deg, #00A8E1, #66D0F0);
          border-radius: 2px;
          width: 0%;
          margin-top: 6px;
          transition: width 0.1s linear;
        }

        .rw-spark {
          position: absolute;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #00A8E1;
          pointer-events: none;
          animation: sparkFly 0.6s ease-out forwards;
        }

        .rw-drag-hint {
          position: absolute;
          bottom: -26px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 0.6rem;
          letter-spacing: 0.08em;
          color: #4A4540;
          text-transform: uppercase;
          white-space: nowrap;
          animation: fadeUp 1s 0.6s ease both;
        }

        [data-theme='light'] .rw-score {
          background: #fff8ef;
          border-color: rgba(0,168,225,0.5);
          box-shadow: 4px 5px 0 rgba(31,26,20,0.16), 0 8px 24px rgba(31,26,20,0.1);
        }

        [data-theme='light'] .rw-score svg circle:first-child {
          stroke: rgba(31,26,20,0.14);
        }

        [data-theme='light'] .rw-score-label {
          color: rgba(31,26,20,0.45);
        }

        [data-theme='light'] .rw-ai-card {
          background: #fff7ef;
          border-color: rgba(0,168,225,0.4);
          box-shadow: 4px 5px 0 rgba(31,26,20,0.14), 0 8px 20px rgba(31,26,20,0.08);
        }

        [data-theme='light'] .rw-ai-title {
          color: #1F1A14;
        }

        [data-theme='light'] .rw-ai-body {
          color: #655C51;
        }

        [data-theme='light'] .rw-card {
          background:
            repeating-linear-gradient(0deg, rgba(31,26,20,0.055) 0 1px, transparent 1px 22px),
            repeating-linear-gradient(90deg, rgba(31,26,20,0.04) 0 1px, transparent 1px 22px),
            radial-gradient(circle at 30% 20%, rgba(31,26,20,0.08), transparent 60%),
            #fdf6eb;
          border-color: rgba(31,26,20,0.28);
          box-shadow: 10px 12px 0 rgba(31,26,20,0.16), 0 16px 40px rgba(31,26,20,0.1), 0 0 0 1px rgba(0,168,225,0.1);
        }

        [data-theme='light'] .rw-card::before {
          background: repeating-linear-gradient(-18deg, rgba(31,26,20,0.06) 0 1px, transparent 1px 9px);
          opacity: 0.2;
        }

        [data-theme='light'] .rw-corner.tl,
        [data-theme='light'] .rw-corner.tr,
        [data-theme='light'] .rw-corner.bl,
        [data-theme='light'] .rw-corner.br {
          border-color: rgba(31,26,20,0.32);
        }

        [data-theme='light'] .rw-name {
          color: #1F1A14;
        }

        [data-theme='light'] .rw-location,
        [data-theme='light'] .rw-tab,
        [data-theme='light'] .rw-entry-sub {
          color: #655C51;
        }

        [data-theme='light'] .rw-tabs {
          background: rgba(31,26,20,0.04);
          border-color: rgba(31,26,20,0.2);
        }

        [data-theme='light'] .rw-tab:hover:not(.active) {
          color: #1F1A14;
          background: rgba(31,26,20,0.05);
        }

        [data-theme='light'] .rw-entry {
          background: rgba(31,26,20,0.03);
          border-color: rgba(31,26,20,0.14);
        }

        [data-theme='light'] .rw-entry-chip,
        [data-theme='light'] .rw-skill,
        [data-theme='light'] .rw-generate-btn {
          border-style: dashed;
        }

        [data-theme='light'] .rw-entry-title,
        [data-theme='light'] .rw-skill-bar-label {
          color: #1F1A14;
        }

        [data-theme='light'] .rw-skill {
          color: rgba(31,26,20,0.62);
          background: rgba(0,168,225,0.09);
          border-color: rgba(0,168,225,0.24);
        }

        [data-theme='light'] .rw-skill-bar-wrap {
          background: rgba(31,26,20,0.03);
          border-color: rgba(31,26,20,0.18);
        }

        [data-theme='light'] .rw-skill-bar-track {
          background: rgba(31,26,20,0.08);
        }

        [data-theme='light'] .rw-drag-hint {
          color: #8A7E6F;
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
          box-shadow: 0 0 32px rgba(0,168,225,0.3);
          text-decoration: none;
        }

        .btn-primary:hover {
          background: var(--orange-light);
          transform: translateY(-2px);
          box-shadow: 0 0 48px rgba(0,168,225,0.45);
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
          border-color: rgba(0,168,225,0.3);
          background: rgba(0,168,225,0.08);
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

        .about-shell {
          background: var(--bg-card);
          padding: 2px 48px;
        }
        [data-theme='light'] .about-shell {
          background: var(--bg);
        }

        .about-inner {
          padding: 100px 0 100px 56px;
          max-width: 1200px;
          margin: 0 auto;
          border-left: 3px solid var(--orange);
        }

        .about-label {
          font-size: 0.72rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--orange);
          margin-bottom: 20px;
          font-weight: 600;
        }

        .about-title {
          font-family: var(--font-dm-sans), sans-serif;
          font-weight: 800;
          font-size: clamp(2.2rem, 5vw, 3.8rem);
          letter-spacing: -0.03em;
          line-height: 1.05;
          margin-bottom: 28px;
          color: var(--text);
        }

        .about-title em {
          font-style: normal;
          color: var(--orange-light);
        }

        .about-body {
          color: var(--text);
          font-size: 1.15rem;
          line-height: 1.8;
          max-width: 640px;
          opacity: 0.85;
        }

        .feat-section {
          padding: 120px 48px 80px;
          background: var(--bg);
          text-align: center;
        }

        .feat-head {
          max-width: 700px;
          margin: 0 auto 64px;
        }

        .feat-title {
          font-family: var(--font-dm-sans), sans-serif;
          font-size: clamp(1.9rem, 4vw, 3rem);
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1.1;
          margin-bottom: 16px;
          color: var(--text);
        }

        .feat-sub {
          color: var(--muted);
          font-size: 1rem;
          line-height: 1.6;
          max-width: 560px;
          margin: 0 auto;
        }

        .feat-cards {
          display: flex;
          gap: 16px;
          justify-content: center;
          flex-wrap: wrap;
          max-width: 1200px;
          margin: 0 auto;
        }

        .feat-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 36px 24px 28px;
          width: 200px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 12px;
          transition: border-color 0.3s, transform 0.3s, box-shadow 0.3s, background 0.3s;
        }

        .feat-card:hover {
          border-color: rgba(0,168,225,0.45);
          transform: translateY(-6px);
          box-shadow: 0 18px 50px rgba(0,168,225,0.1);
          background: var(--bg-card2);
        }

        .feat-card .feat-icon {
          width: 52px;
          height: 52px;
          border-radius: 14px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          display: grid;
          place-items: center;
          color: var(--text);
        }

        .feat-card .feat-icon svg {
          width: 22px;
          height: 22px;
          stroke: currentColor;
          fill: none;
        }

        .feat-card h3 {
          font-family: var(--font-dm-sans), sans-serif;
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--text);
          letter-spacing: -0.01em;
        }

        .feat-card p {
          color: var(--muted);
          font-size: 0.82rem;
          line-height: 1.6;
        }

        .how-section {
          padding: 100px 48px 140px;
          background: var(--bg);
          text-align: center;
        }

        .how-title {
          font-family: var(--font-dm-sans), sans-serif;
          font-size: clamp(1.7rem, 3.5vw, 2.5rem);
          font-weight: 800;
          letter-spacing: -0.03em;
          margin-bottom: 14px;
          color: var(--text);
        }

        .how-sub {
          color: var(--muted);
          font-size: 1rem;
          margin-bottom: 56px;
        }

        .how-steps {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px;
          max-width: 1100px;
          margin: 0 auto;
          text-align: left;
        }

        .how-step {
          padding: 24px;
          border-left: 2px solid var(--orange);
          transition: transform 0.25s;
        }

        .how-step:hover { transform: translateX(6px); }

        .how-num {
          color: var(--orange-light);
          font-family: var(--font-dm-sans), sans-serif;
          font-weight: 700;
          font-size: 0.85rem;
          margin-bottom: 10px;
          letter-spacing: 0.02em;
        }

        .how-step h4 {
          font-family: var(--font-dm-sans), sans-serif;
          font-size: 1rem;
          font-weight: 700;
          margin-bottom: 8px;
          color: var(--text);
          letter-spacing: -0.01em;
        }

        .how-step p {
          color: var(--muted);
          font-size: 0.85rem;
          line-height: 1.55;
        }

        @media (max-width: 860px) {
          .feat-card { width: 160px; padding: 28px 16px 22px; }
          .how-steps { grid-template-columns: 1fr 1fr; }
        }

        @media (max-width: 560px) {
          .feat-card { width: 140px; padding: 24px 12px 18px; }
          .feat-card h3 { font-size: 0.85rem; }
          .how-steps { grid-template-columns: 1fr; }
        }

        .cta-banner {
          margin: 0 48px 100px;
          border-radius: 20px;
          background: linear-gradient(135deg, #001F3F 0%, #0D0D0D 60%);
          border: 1px solid rgba(0,168,225,0.2);
          padding: 80px 60px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }

        [data-theme='light'] .cta-banner {
          background: linear-gradient(135deg, #EBF6FC 0%, #D6EDF8 60%);
          border: 1px solid rgba(0,168,225,0.28);
        }

        .cta-banner::before {
          content: '';
          position: absolute;
          top: -80px;
          left: 50%;
          transform: translateX(-50%);
          width: 500px;
          height: 300px;
          background: radial-gradient(ellipse, rgba(0,168,225,0.15), transparent 70%);
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

        @keyframes floatCard {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }

        @keyframes spinGlow {
          0% { text-shadow: 0 0 6px #00A8E1; }
          50% { text-shadow: 0 0 18px #33BBEE; }
          100% { text-shadow: 0 0 6px #00A8E1; }
        }

        @keyframes scanDown {
          0% { top: 3px; opacity: 0; }
          5% { opacity: 1; }
          95% { opacity: 0.6; }
          100% { top: 100%; opacity: 0; }
        }

        @keyframes spinRing {
          to { transform: rotate(360deg); }
        }

        @keyframes tabIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes sparkFly {
          0% { transform: translate(0,0) scale(1); opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) scale(0); opacity: 0; }
        }

        @media (max-width: 768px) {
          nav { padding: 18px 24px; }
          .nav-links { display: none; }
          .nav-right { margin-left: auto; }
          .nav-cta-top { padding: 8px 16px; font-size: 0.75rem; }
          .hero { padding: 120px 24px 60px; }
          .hero-layout { grid-template-columns: 1fr; }
          .hero-right { display: none; }
          .hero::after { left: 50%; transform: translateX(-50%); }
          .section { padding: 60px 24px; }
          .steps { grid-template-columns: 1fr; }
          .features-grid { grid-template-columns: 1fr; }
          .cta-banner { margin: 0 24px 60px; padding: 50px 28px; }
          footer { padding: 28px 24px; flex-direction: column; align-items: flex-start; }
        }

        @media (max-width: 1100px) and (min-width: 769px) {
          .hero-layout {
            grid-template-columns: minmax(420px, 1fr) minmax(320px, 360px);
          }

          .resume-widget {
            transform: scale(0.9);
            transform-origin: center right;
          }
        }
      `}</style>
    </div>
  );
}
