'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import ThemeToggle from '@/components/ThemeToggle';
import { Briefcase, ClipboardText, PenNib, Buildings, CodeSimple } from '@phosphor-icons/react';

export default function Home() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  // Authenticated users are being redirected — keep the loading screen up
  const checking = !loading && !!user && !!role;

  // Redirect authenticated users to their dashboard using role from AuthContext
  // (eliminates a redundant Firestore read on every landing page visit)
  useEffect(() => {
    if (loading) return;
    if (!user || !role) return;

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

  // Smooth scroll (Lenis) — skipped for reduced motion
  useEffect(() => {
    if (loading || checking) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let lenis: { raf: (t: number) => void; destroy: () => void } | undefined;
    let raf = 0;
    let cancelled = false;

    import('lenis').then(({ default: Lenis }) => {
      if (cancelled) return;
      lenis = new Lenis({ duration: 1.05, easing: (t: number) => 1 - Math.pow(2, -10 * t) });
      const loop = (time: number) => {
        lenis!.raf(time);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      lenis?.destroy();
    };
  }, [loading, checking]);

  // In-view observer for quiet fade-up reveals (observes the outer element)
  useEffect(() => {
    if (loading || checking) return;
    const targets = document.querySelectorAll('.reveal-block');
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.1 }
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, [loading, checking]);

  // Interactive app card (subtle tilt + cursor-tracking stat badge)
  useEffect(() => {
    if (loading || checking) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const widget = document.getElementById('apWidget') as HTMLElement | null;
    const card = document.getElementById('apCard') as HTMLElement | null;
    const statBadge = document.getElementById('apStatBadge') as HTMLElement | null;

    if (!widget || !card || !statBadge) return;

    const timeouts: number[] = [];

    const applyTilt = (rx: number, ry: number) => {
      card.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
    };

    const onMouseMove = (e: MouseEvent) => {
      const r = card.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = (e.clientX - cx) / (r.width / 2);
      const dy = (e.clientY - cy) / (r.height / 2);
      applyTilt(-dy * 2.5, dx * 2.5);
    };

    const onMouseLeave = () => {
      card.style.transition = 'transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)';
      applyTilt(0, 0);
      const t = window.setTimeout(() => {
        card.style.transition = 'transform 0.12s linear';
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
      const dx = (e.touches[0].clientX - touchStartX) / 40;
      const dy = (e.touches[0].clientY - touchStartY) / 40;
      applyTilt(-dy, dx);
    };

    const onTouchEnd = () => {
      isTouchDragging = false;
      card.style.transition = 'transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)';
      applyTilt(0, 0);
      const t = window.setTimeout(() => {
        card.style.transition = 'transform 0.12s linear';
      }, 700);
      timeouts.push(t);
    };

    const onDocMouseMove = (e: MouseEvent) => {
      const wx = window.innerWidth / 2;
      const wy = window.innerHeight / 2;
      const dx = (e.clientX - wx) / wx;
      const dy = (e.clientY - wy) / wy;
      statBadge.style.transform = `translate(${-dx * 5}px, ${-dy * 5}px)`;
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
    <div className="landing-root" id="main-content">
      <nav aria-label="Main">
        <div className="nav-inner">
          <div className="nav-left">
            <div className="nav-logo">
              <Image src="/logo.png" alt="Uniship" width={40} height={40} priority className="nav-logo-img" />
              <span className="nav-logo-text">UNISHIP</span>
            </div>
            <div className="nav-links">
              <button onClick={() => scrollToId('about')}>About us</button>
              <button onClick={() => scrollToId('features')}>Features</button>
              <button onClick={() => scrollToId('how')}>How it works</button>
            </div>
          </div>
          <div className="nav-right">
            <ThemeToggle className="nav-theme-btn" />
            <Link href="/login" className="nav-cta">Sign In -&gt;</Link>
          </div>
        </div>
      </nav>

      <section className="hero" id="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <h1 className="hero-h1 reveal-block">
              Your Career <em>Launchpad</em> Starts Here
            </h1>

            <p className="hero-sub reveal-block" style={{ '--reveal-delay': '120ms' } as React.CSSProperties}>
              Uniship connects students with placement opportunities, internships, and full-time roles — matched to your skills, your college, your future.
            </p>

            <div className="hero-actions reveal-block" style={{ '--reveal-delay': '180ms' } as React.CSSProperties}>
              <Link href="/login" className="btn-solid">Get started -&gt;</Link>
              <a href="#how" className="btn-ghost">See how it works</a>
            </div>

            <div className="hero-meta reveal-block" style={{ '--reveal-delay': '240ms' } as React.CSSProperties}>
              <span>Company listings</span><i />
              <span>Mock assessments</span><i />
              <span>AI resume builder</span><i />
              <span>Live proctoring</span>
            </div>
          </div>

          <div className="hero-visual reveal-block" style={{ '--reveal-delay': '300ms' } as React.CSSProperties}>
            <div className="ap-widget" id="apWidget">
              <div className="ap-stat-badge" id="apStatBadge">
                <div className="ap-stat-num">3</div>
                <div className="ap-stat-label">Shortlisted</div>
              </div>

              <div className="ap-float ap-float-ats">
                <div className="ap-float-ring">92</div>
                <div className="ap-float-body">
                  <div className="ap-float-title">Resume ATS</div>
                  <div className="ap-float-sub">Optimized</div>
                </div>
              </div>

              <div className="ap-card" id="apCard">
                <div className="ap-topbar">
                  <span className="ap-topbar-title">My Applications</span>
                  <span className="ap-live">
                    <span className="ap-live-dot" />
                    Live
                  </span>
                </div>

                <div className="ap-card-inner">
                  <div className="ap-submitting-row">
                    <div className="ap-job-logo" style={{ background: '#1A56DB' }}>NC</div>
                    <div className="ap-submitting-body">
                      <div className="ap-submitting-title">Northwind Capital — Analyst</div>
                      <div className="ap-submitting-label">Submitting application…</div>
                      <div className="ap-bar-track"><div className="ap-bar-fill" /></div>
                    </div>
                  </div>

                  <div className="ap-job-list">
                    <div className="ap-job-row">
                      <div className="ap-job-logo-sm" style={{ background: '#0052CC' }}>ML</div>
                      <div className="ap-job-info">
                        <div className="ap-job-title">Meridian Labs — SDE Intern</div>
                        <div className="ap-job-meta">₹85,000/mo · Hyderabad</div>
                      </div>
                      <span className="ap-status ap-s-short">Shortlisted ✓</span>
                    </div>
                    <div className="ap-job-row">
                      <div className="ap-job-logo-sm" style={{ background: '#C75300' }}>VS</div>
                      <div className="ap-job-info">
                        <div className="ap-job-title">Vertex Systems — SDE Intern</div>
                        <div className="ap-job-meta">₹90,000/mo · Bangalore</div>
                      </div>
                      <span className="ap-status ap-s-review">Under Review</span>
                    </div>
                    <div className="ap-job-row">
                      <div className="ap-job-logo-sm" style={{ background: '#1A73E8' }}>LA</div>
                      <div className="ap-job-info">
                        <div className="ap-job-title">Lumen AI — STEP Intern</div>
                        <div className="ap-job-meta">₹1,20,000/mo · Remote</div>
                      </div>
                      <span className="ap-status ap-s-applied">Applied</span>
                    </div>
                    <div className="ap-job-row">
                      <div className="ap-job-logo-sm" style={{ background: '#26282B' }}>CM</div>
                      <div className="ap-job-info">
                        <div className="ap-job-title">Cobalt Mobility — Backend Engineer</div>
                        <div className="ap-job-meta">₹70,000/mo · Pune</div>
                      </div>
                      <span className="ap-status ap-s-new">New</span>
                    </div>
                  </div>

                  <div className="ap-footer">
                    <div className="ap-footer-stat">
                      <span className="ap-footer-num">8<em>+</em></span>
                      <span className="ap-footer-label">Applied</span>
                    </div>
                    <div className="ap-footer-stat">
                      <span className="ap-footer-num">3</span>
                      <span className="ap-footer-label">Shortlisted</span>
                    </div>
                    <div className="ap-footer-stat">
                      <span className="ap-footer-num">1</span>
                      <span className="ap-footer-label">Interview</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="hero-logos reveal-block" style={{ '--reveal-delay': '360ms' } as React.CSSProperties}>
          <p className="hero-logos-label">Opportunities across every track</p>
          <div className="hero-logos-row">
            <span className="hero-cat">Software Engineering</span>
            <span className="hero-cat">Data &amp; AI</span>
            <span className="hero-cat">Product</span>
            <span className="hero-cat">Consulting</span>
            <span className="hero-cat">Finance</span>
            <span className="hero-cat">Core Engineering</span>
            <span className="hero-cat">Design</span>
          </div>
        </div>
      </section>

      <div className="about-shell" id="about">
        <div className="container">
          <h2 className="statement-lead reveal-block">Built to simplify <em>placements</em>.</h2>
          <p className="statement-body reveal-block" style={{ '--reveal-delay': '90ms' } as React.CSSProperties}>
            Uniship is a unified placement platform that bridges the gap between students and placement cells.
            We bring company listings, mock assessments, AI-powered resume building, and application tracking
            into one seamless experience — simplifying the process of placements.
          </p>
        </div>
      </div>

      <div className="feat-section" id="features">
        <div className="container">
          <div className="feat-head">
            <h2 className="feat-title reveal-block">Everything you need to get placed</h2>
            <p className="feat-sub reveal-block" style={{ '--reveal-delay': '80ms' } as React.CSSProperties}>
              A complete toolkit built for students, powered by AI, loved by placement cells.
            </p>
          </div>
          <div className="feat-grid">
            <div className="feat-card reveal-block">
              <div className="feat-icon">
                <Briefcase size={17} weight="duotone" />
              </div>
              <h3>Smart Job Applications</h3>
              <p>Apply to top companies and track your applications effortlessly.</p>
            </div>
            <div className="feat-card reveal-block" style={{ '--reveal-delay': '60ms' } as React.CSSProperties}>
              <div className="feat-icon">
                <ClipboardText size={17} weight="duotone" />
              </div>
              <h3>Mock Tests &amp; Assessments</h3>
              <p>Practice real placement tests and improve with instant feedback.</p>
            </div>
            <div className="feat-card reveal-block" style={{ '--reveal-delay': '120ms' } as React.CSSProperties}>
              <div className="feat-icon">
                <PenNib size={17} weight="duotone" />
              </div>
              <h3>AI Resume Builder</h3>
              <p>Create ATS-ready resumes tailored for your target roles.</p>
            </div>
            <div className="feat-card feat-card-wide reveal-block">
              <div className="feat-icon">
                <Buildings size={17} weight="duotone" />
              </div>
              <h3>College Space</h3>
              <p>Stay updated with drives, events, and placement announcements.</p>
            </div>
            <div className="feat-card feat-card-wide reveal-block" style={{ '--reveal-delay': '60ms' } as React.CSSProperties}>
              <div className="feat-icon">
                <CodeSimple size={17} weight="duotone" />
              </div>
              <h3>Practice Arena</h3>
              <p>Solve curated problems and climb the leaderboard.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="how-section" id="how">
        <div className="container">
          <div className="how-head">
            <h2 className="how-title reveal-block">From profile to placement in four steps</h2>
            <p className="how-sub reveal-block" style={{ '--reveal-delay': '80ms' } as React.CSSProperties}>
              A clear path from your first login to your first offer.
            </p>
          </div>
          <div className="how-steps">
            <div className="how-step reveal-block">
              <div className="how-num">01</div>
              <h4>Sign up with your college</h4>
              <p>Verify with your university email and join your placement cell automatically.</p>
            </div>
            <div className="how-step reveal-block" style={{ '--reveal-delay': '70ms' } as React.CSSProperties}>
              <div className="how-num">02</div>
              <h4>Build your AI resume</h4>
              <p>Answer a few questions — get a recruiter-ready resume in minutes.</p>
            </div>
            <div className="how-step reveal-block" style={{ '--reveal-delay': '140ms' } as React.CSSProperties}>
              <div className="how-num">03</div>
              <h4>Practice &amp; prepare</h4>
              <p>Take mock tests targeted at the companies visiting your campus.</p>
            </div>
            <div className="how-step reveal-block" style={{ '--reveal-delay': '210ms' } as React.CSSProperties}>
              <div className="how-num">04</div>
              <h4>Apply &amp; get hired</h4>
              <p>Apply in one click and track every application until you land the offer.</p>
            </div>
          </div>
        </div>
      </div>

      <footer>
        <div className="container footer-inner">
          <div className="nav-logo">
            <Image src="/logo.png" alt="Uniship" width={40} height={40} className="nav-logo-img" />
            <span className="nav-logo-text">UNISHIP</span>
          </div>
          <div className="footer-links">
            <a href="#" onClick={(e) => e.preventDefault()}>Privacy</a>
            <a href="#" onClick={(e) => e.preventDefault()}>Terms</a>
            <a href="#" onClick={(e) => e.preventDefault()}>Contact</a>
            <a href="#" onClick={(e) => e.preventDefault()}>Blog</a>
          </div>
          <div className="footer-copy">© 2026 Uniship. All rights reserved.</div>
        </div>
      </footer>

      <style jsx global>{`
        .landing-root,
        .landing-root * {
          box-sizing: border-box;
        }

        /* ── Theme tokens (Linear-style) — dark is the default, light reacts to the app theme toggle ── */
        .landing-root {
          --l-bg: #08090a;
          --l-panel: #0c0d0e;
          --l-card: #0f1011;
          --l-card-2: #131415;
          --l-border: rgba(255, 255, 255, 0.08);
          --l-border-strong: rgba(255, 255, 255, 0.16);
          --l-row-line: rgba(255, 255, 255, 0.05);
          --l-row-hover: rgba(255, 255, 255, 0.03);
          --l-icon-bg: rgba(255, 255, 255, 0.05);
          --l-track: rgba(255, 255, 255, 0.07);
          --l-stroke: rgba(255, 255, 255, 0.18);
          --l-heading: #f7f8f8;
          --l-text: #8a8f98;
          --l-dim: #5e6269;
          --l-accent: #00a8e1;
          --l-live: #4cb782;
          --l-btn-bg: #e9eaeb;
          --l-btn-bg-hover: #ffffff;
          --l-btn-fg: #08090a;
          --l-glass: rgba(13, 14, 16, 0.82);
          --l-glass-border: rgba(255, 255, 255, 0.12);
          --l-glass-glint: rgba(255, 255, 255, 0.08);
          --l-glass-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
          --l-nav-link: #c9cdd3;
          --l-shadow-panel: 0 20px 60px rgba(0, 0, 0, 0.5);
          --l-shadow-badge: 0 14px 36px rgba(0, 0, 0, 0.45);
          --l-ambient: rgba(120, 160, 190, 0.09);
          --l-s-new-fg: #8a8f98;      --l-s-new-bg: rgba(255, 255, 255, 0.06);
          --l-s-applied-fg: #4ea7fc;  --l-s-applied-bg: rgba(78, 167, 252, 0.12);
          --l-s-short-fg: #4cb782;    --l-s-short-bg: rgba(76, 183, 130, 0.12);
          --l-s-review-fg: #f2c94c;   --l-s-review-bg: rgba(242, 201, 76, 0.1);

          background: var(--l-bg);
          color: var(--l-text);
          font-family: var(--font-geist), system-ui, sans-serif;
          font-size: 15px;
          line-height: 1.6;
          overflow-x: hidden;
          min-height: 100vh;
          transition: background 0.3s ease, color 0.3s ease;
        }

        [data-theme='light'] .landing-root {
          --l-bg: #fcfcfd;
          --l-panel: #ffffff;
          --l-card: #f7f8f9;
          --l-card-2: #f0f1f3;
          --l-border: rgba(0, 0, 0, 0.08);
          --l-border-strong: rgba(0, 0, 0, 0.16);
          --l-row-line: rgba(0, 0, 0, 0.05);
          --l-row-hover: rgba(0, 0, 0, 0.03);
          --l-icon-bg: rgba(0, 0, 0, 0.04);
          --l-track: rgba(0, 0, 0, 0.08);
          --l-stroke: rgba(0, 0, 0, 0.2);
          --l-heading: #0e0f11;
          --l-text: #5c6066;
          --l-dim: #82868d;
          --l-accent: #0082be;
          --l-live: #1d8f55;
          --l-btn-bg: #121316;
          --l-btn-bg-hover: #000000;
          --l-btn-fg: #ffffff;
          --l-glass: rgba(255, 255, 255, 0.85);
          --l-glass-border: rgba(0, 0, 0, 0.08);
          --l-glass-glint: rgba(255, 255, 255, 0.9);
          --l-glass-shadow: 0 12px 40px rgba(13, 14, 16, 0.1);
          --l-nav-link: #3c4046;
          --l-shadow-panel: 0 20px 60px rgba(13, 14, 16, 0.12);
          --l-shadow-badge: 0 14px 36px rgba(13, 14, 16, 0.14);
          --l-ambient: rgba(70, 130, 170, 0.08);
          --l-s-new-fg: #5c6066;      --l-s-new-bg: rgba(0, 0, 0, 0.05);
          --l-s-applied-fg: #1467c8;  --l-s-applied-bg: rgba(20, 103, 200, 0.1);
          --l-s-short-fg: #15794a;    --l-s-short-bg: rgba(21, 121, 74, 0.1);
          --l-s-review-fg: #9a6e00;   --l-s-review-bg: rgba(154, 110, 0, 0.1);
        }

        .landing-root .container {
          width: 100%;
          max-width: 1104px;
          margin: 0 auto;
          padding: 0 24px;
        }

        .landing-root ::selection {
          background: rgba(0, 168, 225, 0.35);
        }

        /* ── Floating liquid-glass nav ── */
        .landing-root nav {
          position: fixed;
          top: 14px;
          left: 0;
          right: 0;
          z-index: 100;
          pointer-events: none;
        }

        .landing-root .nav-inner {
          pointer-events: auto;
          width: min(960px, calc(100% - 28px));
          margin: 0 auto;
          height: 54px;
          padding: 0 8px 0 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-radius: 999px;
          background: var(--l-glass);
          backdrop-filter: blur(24px) saturate(1.5);
          -webkit-backdrop-filter: blur(24px) saturate(1.5);
          border: 1px solid var(--l-glass-border);
          box-shadow: var(--l-glass-shadow), inset 0 1px 0 var(--l-glass-glint);
          transition: background 0.3s ease, border-color 0.3s ease;
        }

        .landing-root .nav-left {
          display: flex;
          align-items: center;
          gap: 22px;
        }

        .landing-root .nav-logo {
          display: flex;
          align-items: center;
          gap: 2px;
          line-height: 1;
        }

        .landing-root .nav-logo-img {
          object-fit: contain;
          flex-shrink: 0;
        }

        .landing-root .nav-logo-text {
          font-weight: 600;
          font-size: 14px;
          letter-spacing: 0.04em;
          color: var(--l-heading);
          padding-top: 0.15em;
        }

        .landing-root .nav-links {
          display: flex;
          align-items: center;
          gap: 2px;
        }

        .landing-root .nav-links button {
          appearance: none;
          background: none;
          border: none;
          font-family: inherit;
          font-size: 13.5px;
          font-weight: 500;
          color: var(--l-nav-link);
          padding: 7px 12px;
          border-radius: 999px;
          cursor: pointer;
          transition: color 0.15s ease, background 0.15s ease;
        }

        .landing-root .nav-links button:hover {
          color: var(--l-heading);
          background: var(--l-icon-bg);
        }

        .landing-root .nav-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .landing-root .nav-theme-btn {
          appearance: none;
          background: none;
          border: none;
          width: 36px;
          height: 36px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          color: var(--l-nav-link);
          cursor: pointer;
          transition: color 0.15s ease, background 0.15s ease;
        }

        .landing-root .nav-theme-btn:hover {
          color: var(--l-heading);
          background: var(--l-icon-bg);
        }

        .landing-root .nav-cta {
          display: inline-flex;
          align-items: center;
          height: 38px;
          padding: 0 18px;
          background: var(--l-btn-bg);
          color: var(--l-btn-fg);
          font-size: 13px;
          font-weight: 600;
          border-radius: 999px;
          text-decoration: none;
          transition: background 0.15s ease;
        }

        .landing-root .nav-cta:hover {
          background: var(--l-btn-bg-hover);
        }

        /* ── Hero: copy left, compact app card right ── */
        .landing-root .hero {
          position: relative;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 52px;
          padding: 104px 0 48px;
          overflow: hidden;
          box-sizing: border-box;
        }

        .landing-root .hero::before {
          content: '';
          position: absolute;
          top: -240px;
          left: 50%;
          transform: translateX(-50%);
          width: 1100px;
          height: 560px;
          background: radial-gradient(ellipse at center, var(--l-ambient) 0%, transparent 65%);
          pointer-events: none;
        }

        .landing-root .hero-grid {
          position: relative;
          display: grid;
          grid-template-columns: 1fr 420px;
          gap: 64px;
          align-items: center;
        }

        .landing-root .hero-h1 {
          font-size: clamp(2.6rem, 4.7vw, 4.1rem);
          font-weight: 560;
          font-variation-settings: 'wght' 560;
          letter-spacing: -0.025em;
          line-height: 1.08;
          color: var(--l-heading);
          margin: 0;
        }

        .landing-root .hero-h1 em {
          font-style: normal;
        }

        .landing-root .hero-sub {
          margin: 20px 0 0;
          max-width: 480px;
          font-size: 16px;
          line-height: 1.6;
          color: var(--l-text);
        }

        .landing-root .hero-actions {
          display: flex;
          gap: 14px;
          margin-top: 30px;
        }

        .landing-root .btn-solid {
          display: inline-flex;
          align-items: center;
          height: 40px;
          padding: 0 20px;
          background: var(--l-btn-bg);
          color: var(--l-btn-fg);
          font-size: 14px;
          font-weight: 600;
          border-radius: 999px;
          text-decoration: none;
          transition: background 0.15s ease, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .landing-root .btn-solid:hover {
          background: var(--l-btn-bg-hover);
          transform: translateY(-1px);
        }

        .landing-root .btn-ghost {
          display: inline-flex;
          align-items: center;
          height: 40px;
          padding: 0 18px;
          border-radius: 999px;
          border: 1px solid var(--l-border-strong);
          background: transparent;
          color: var(--l-heading);
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          transition: background 0.15s ease, border-color 0.15s ease, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .landing-root .btn-ghost:hover {
          background: var(--l-card);
          border-color: var(--l-stroke);
          transform: translateY(-1px);
        }

        /* ── Hero capability line ── */
        .landing-root .hero-meta {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 9px 14px;
          margin-top: 30px;
          font-size: 13px;
          color: var(--l-dim);
        }

        .landing-root .hero-meta i {
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: var(--l-stroke);
          display: inline-block;
        }

        /* ── Hero floating chip (Resume ATS) ── */
        .landing-root .ap-float {
          position: absolute;
          z-index: 3;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 14px 9px 9px;
          background: var(--l-panel);
          border: 1px solid var(--l-border);
          border-radius: 13px;
          box-shadow: var(--l-shadow-badge);
        }

        .landing-root .ap-float-ats {
          left: -26px;
          bottom: 42px;
        }

        .landing-root .ap-float-ring {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          font-size: 12px;
          font-weight: 700;
          color: var(--l-accent);
          background: color-mix(in srgb, var(--l-accent) 12%, transparent);
          border: 1.5px solid color-mix(in srgb, var(--l-accent) 35%, transparent);
        }

        .landing-root .ap-float-title { font-size: 12px; font-weight: 600; color: var(--l-heading); }
        .landing-root .ap-float-sub { font-size: 10.5px; color: var(--l-dim); margin-top: 1px; }

        /* ── Hero company strip ── */
        .landing-root .hero-logos {
          width: 100%;
          padding: 0 24px;
          text-align: center;
        }

        .landing-root .hero-logos-label {
          font-size: 11.5px;
          font-weight: 500;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--l-dim);
          margin: 0 0 18px;
        }

        .landing-root .hero-logos-row {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          align-items: center;
          gap: 10px 12px;
        }

        .landing-root .hero-cat {
          font-size: 13px;
          font-weight: 500;
          letter-spacing: -0.005em;
          color: var(--l-text);
          padding: 7px 15px;
          border: 1px solid var(--l-border);
          border-radius: 999px;
          background: var(--l-card);
          transition: color 0.2s ease, border-color 0.2s ease, background 0.2s ease;
        }

        .landing-root .hero-cat:hover {
          color: var(--l-heading);
          border-color: var(--l-border-strong);
        }

        /* ── Compact application card ── */
        .landing-root .hero-visual {
          position: relative;
        }

        .landing-root .ap-widget {
          position: relative;
          perspective: 1400px;
        }

        .landing-root .ap-card {
          background: var(--l-panel);
          border: 1px solid var(--l-border);
          border-radius: 14px;
          overflow: hidden;
          transform-style: preserve-3d;
          transition: transform 0.12s linear, background 0.3s ease, border-color 0.3s ease;
          box-shadow: var(--l-shadow-panel);
        }

        .landing-root .ap-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 40px;
          padding: 0 14px;
          border-bottom: 1px solid var(--l-border);
          background: var(--l-card);
        }

        .landing-root .ap-topbar-title {
          font-size: 12.5px;
          font-weight: 550;
          color: var(--l-heading);
        }

        .landing-root .ap-live {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 500;
          color: var(--l-live);
        }

        .landing-root .ap-live-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--l-live);
          animation: apLivePulse 1.6s ease-in-out infinite;
        }

        @keyframes apLivePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.25; }
        }

        .landing-root .ap-card-inner {
          padding: 12px 14px 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .landing-root .ap-submitting-row {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 10px 12px;
          background: var(--l-card-2);
          border: 1px solid var(--l-border);
          border-radius: 10px;
        }

        .landing-root .ap-job-logo {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          flex-shrink: 0;
          display: grid;
          place-items: center;
          font-size: 10px;
          font-weight: 700;
          color: #fff;
        }

        .landing-root .ap-submitting-body { flex: 1; min-width: 0; }

        .landing-root .ap-submitting-title {
          font-size: 12.5px;
          font-weight: 550;
          color: var(--l-heading);
          margin-bottom: 2px;
        }

        .landing-root .ap-submitting-label {
          font-size: 11px;
          color: var(--l-accent);
          margin-bottom: 7px;
        }

        .landing-root .ap-bar-track {
          height: 3px;
          border-radius: 99px;
          background: var(--l-track);
          overflow: hidden;
        }

        .landing-root .ap-bar-fill {
          height: 100%;
          border-radius: 99px;
          background: var(--l-accent);
          animation: apBarProgress 3.2s cubic-bezier(0.16, 1, 0.3, 1) infinite;
        }

        @keyframes apBarProgress {
          0%   { width: 0%;   opacity: 1; }
          65%  { width: 100%; opacity: 1; }
          85%  { width: 100%; opacity: 0.4; }
          100% { width: 0%;   opacity: 0; }
        }

        .landing-root .ap-job-list {
          display: flex;
          flex-direction: column;
        }

        .landing-root .ap-job-row {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 9px 6px;
          border-radius: 8px;
          border-bottom: 1px solid var(--l-row-line);
          transition: background 0.15s ease;
        }

        .landing-root .ap-job-row:last-child {
          border-bottom: none;
        }

        .landing-root .ap-job-row:hover {
          background: var(--l-row-hover);
        }

        .landing-root .ap-job-logo-sm {
          width: 27px;
          height: 27px;
          border-radius: 7px;
          flex-shrink: 0;
          display: grid;
          place-items: center;
          font-size: 9px;
          font-weight: 700;
          color: #fff;
        }

        .landing-root .ap-job-info { flex: 1; min-width: 0; }

        .landing-root .ap-job-title {
          font-size: 12.5px;
          font-weight: 500;
          color: var(--l-heading);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .landing-root .ap-job-meta {
          font-size: 11px;
          color: var(--l-dim);
          margin-top: 1px;
        }

        .landing-root .ap-status {
          font-size: 10.5px;
          font-weight: 550;
          padding: 3px 9px;
          border-radius: 99px;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .landing-root .ap-s-new     { color: var(--l-s-new-fg);     background: var(--l-s-new-bg); }
        .landing-root .ap-s-applied { color: var(--l-s-applied-fg); background: var(--l-s-applied-bg); }
        .landing-root .ap-s-short   { color: var(--l-s-short-fg);   background: var(--l-s-short-bg); }
        .landing-root .ap-s-review  { color: var(--l-s-review-fg);  background: var(--l-s-review-bg); }

        .landing-root .ap-footer {
          display: flex;
          align-items: center;
          gap: 22px;
          padding: 11px 6px 0;
          border-top: 1px solid var(--l-row-line);
        }

        .landing-root .ap-footer-stat {
          display: flex;
          align-items: baseline;
          gap: 6px;
        }

        .landing-root .ap-footer-num {
          font-size: 14px;
          font-weight: 600;
          color: var(--l-heading);
        }

        .landing-root .ap-footer-num em {
          color: var(--l-accent);
          font-style: normal;
        }

        .landing-root .ap-footer-label {
          font-size: 11px;
          color: var(--l-dim);
        }

        .landing-root .ap-stat-badge {
          position: absolute;
          top: -36px;
          right: -10px;
          z-index: 10;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: var(--l-card-2);
          border: 1px solid var(--l-border-strong);
          border-radius: 10px;
          box-shadow: var(--l-shadow-badge);
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), background 0.3s ease;
        }

        .landing-root .ap-stat-num {
          font-size: 17px;
          font-weight: 650;
          color: var(--l-accent);
          line-height: 1;
        }

        .landing-root .ap-stat-label {
          font-size: 11px;
          color: var(--l-text);
        }

        /* ── Statement (about) ── */
        .landing-root .about-shell {
          padding: 130px 0 40px;
        }

        .landing-root .statement-lead {
          font-size: clamp(1.5rem, 2.6vw, 2.1rem);
          font-weight: 540;
          font-variation-settings: 'wght' 540;
          letter-spacing: -0.02em;
          line-height: 1.25;
          color: var(--l-heading);
          margin: 0 0 14px;
        }

        .landing-root .statement-lead em {
          font-style: normal;
          color: var(--l-accent);
        }

        .landing-root .statement-body {
          font-size: clamp(1.15rem, 1.9vw, 1.45rem);
          font-weight: 460;
          font-variation-settings: 'wght' 460;
          letter-spacing: -0.012em;
          line-height: 1.45;
          color: var(--l-dim);
          max-width: 56rem;
          margin: 0;
        }

        /* ── Features ── */
        .landing-root .feat-section {
          padding: 110px 0 20px;
        }

        .landing-root .feat-head {
          margin-bottom: 44px;
        }

        .landing-root .feat-title {
          font-size: clamp(1.5rem, 2.6vw, 2.1rem);
          font-weight: 540;
          font-variation-settings: 'wght' 540;
          letter-spacing: -0.02em;
          line-height: 1.15;
          color: var(--l-heading);
          margin: 0 0 10px;
        }

        .landing-root .feat-sub {
          font-size: 15px;
          color: var(--l-text);
          margin: 0;
          max-width: 480px;
        }

        .landing-root .feat-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 14px;
        }

        .landing-root .feat-card {
          grid-column: span 2;
          background: var(--l-card);
          border: 1px solid var(--l-border);
          border-radius: 12px;
          padding: 26px 24px 24px;
          transition: border-color 0.2s ease, background 0.2s ease;
        }

        .landing-root .feat-card-wide {
          grid-column: span 3;
        }

        .landing-root .feat-card:hover {
          border-color: var(--l-border-strong);
          background: var(--l-card-2);
        }

        .landing-root .feat-icon {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          background: var(--l-icon-bg);
          border: 1px solid var(--l-border);
          display: grid;
          place-items: center;
          color: var(--l-text);
          margin-bottom: 18px;
          transition: color 0.2s ease;
        }

        .landing-root .feat-card:hover .feat-icon {
          color: var(--l-heading);
        }

        .landing-root .feat-icon svg {
          width: 17px;
          height: 17px;
        }

        .landing-root .feat-card h3 {
          font-size: 15px;
          font-weight: 550;
          letter-spacing: -0.01em;
          color: var(--l-heading);
          margin: 0 0 6px;
        }

        .landing-root .feat-card p {
          font-size: 13.5px;
          line-height: 1.55;
          color: var(--l-text);
          margin: 0;
        }

        /* ── How it works ── */
        .landing-root .how-section {
          padding: 110px 0 130px;
        }

        .landing-root .how-head {
          margin-bottom: 48px;
        }

        .landing-root .how-title {
          font-size: clamp(1.5rem, 2.6vw, 2.1rem);
          font-weight: 540;
          font-variation-settings: 'wght' 540;
          letter-spacing: -0.02em;
          line-height: 1.15;
          color: var(--l-heading);
          margin: 0 0 10px;
        }

        .landing-root .how-sub {
          font-size: 15px;
          color: var(--l-text);
          margin: 0;
        }

        .landing-root .how-steps {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
        }

        .landing-root .how-step {
          padding: 24px 20px 26px;
          background: var(--l-card);
          border: 1px solid var(--l-border);
          border-radius: 12px;
          transition: border-color 0.2s ease;
        }

        .landing-root .how-step:hover {
          border-color: var(--l-border-strong);
        }

        .landing-root .how-num {
          font-size: 44px;
          font-weight: 650;
          line-height: 1;
          letter-spacing: -0.02em;
          color: transparent;
          -webkit-text-stroke: 1px var(--l-stroke);
          margin-bottom: 40px;
        }

        .landing-root .how-step h4 {
          font-size: 15px;
          font-weight: 550;
          letter-spacing: -0.01em;
          color: var(--l-heading);
          margin: 0 0 6px;
        }

        .landing-root .how-step p {
          font-size: 13.5px;
          line-height: 1.55;
          color: var(--l-text);
          margin: 0;
        }

        /* ── Footer ── */
        .landing-root footer {
          border-top: 1px solid var(--l-border);
          padding: 28px 0;
        }

        .landing-root .footer-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
        }

        .landing-root .footer-links {
          display: flex;
          gap: 24px;
        }

        .landing-root .footer-links a {
          font-size: 13px;
          color: var(--l-text);
          text-decoration: none;
          transition: color 0.15s ease;
        }

        .landing-root .footer-links a:hover {
          color: var(--l-heading);
        }

        .landing-root .footer-copy {
          font-size: 12.5px;
          color: var(--l-dim);
        }

        /* ── Reveal (quiet fade-up) ── */
        .landing-root .reveal-block {
          opacity: 0;
          transform: translateY(14px);
        }
        .landing-root .reveal-block.is-in {
          opacity: 1;
          transform: translateY(0);
          transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
          transition-delay: var(--reveal-delay, 0ms);
        }

        @media (prefers-reduced-motion: reduce) {
          .landing-root .reveal-block { opacity: 1; transform: none; }
        }

        /* ── Responsive ── */
        @media (max-width: 980px) {
          .landing-root .hero-grid {
            grid-template-columns: 1fr;
            gap: 56px;
          }
          .landing-root .hero-visual {
            max-width: 480px;
          }
        }

        @media (max-width: 900px) {
          .landing-root .feat-card { grid-column: span 3; }
          .landing-root .feat-card-wide { grid-column: span 3; }
          .landing-root .how-steps { grid-template-columns: 1fr 1fr; }
        }

        @media (max-width: 768px) {
          .landing-root .nav-links { display: none; }
          .landing-root nav { top: 10px; }
          .landing-root .hero { padding-top: 118px; justify-content: flex-start; gap: 40px; }
          .landing-root .hero-h1 { font-size: clamp(2.1rem, 9vw, 2.9rem); }
          .landing-root .about-shell { padding-top: 96px; }
          .landing-root .feat-section,
          .landing-root .how-section { padding-top: 80px; }
          .landing-root .ap-stat-badge { right: 0; top: -34px; }
          .landing-root .ap-float-ats { left: -6px; bottom: 28px; transform: scale(0.94); }
          .landing-root .footer-inner {
            flex-direction: column;
            align-items: flex-start;
          }
        }

        @media (max-width: 560px) {
          .landing-root .feat-card,
          .landing-root .feat-card-wide { grid-column: span 6; }
          .landing-root .how-steps { grid-template-columns: 1fr; }
          .landing-root .ap-status { display: none; }
        }
      `}</style>
    </div>
  );
}
