'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Image from 'next/image';
import ThemeToggle from '@/components/ThemeToggle';
import { Briefcase } from '@phosphor-icons/react/Briefcase';
import { ClipboardText } from '@phosphor-icons/react/ClipboardText';
import { PenNib } from '@phosphor-icons/react/PenNib';
import { Buildings } from '@phosphor-icons/react/Buildings';
import { CodeSimple } from '@phosphor-icons/react/CodeSimple';

const LandingAuthRedirect = dynamic(() => import('@/components/LandingAuthRedirect'), { ssr: false });

export default function Home() {
  // In-view observer for quiet fade-up reveals (observes the outer element)
  useEffect(() => {
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
  }, []);

  // Interactive app card (subtle tilt + cursor-tracking stat badge)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const widget = document.getElementById('apWidget') as HTMLElement | null;
    const card = document.getElementById('apCard') as HTMLElement | null;
    const statBadge = document.getElementById('apStatBadge') as HTMLElement | null;

    if (!widget || !card || !statBadge) return;

    const timeouts: number[] = [];
    let cardRect = card.getBoundingClientRect();
    let tiltFrame = 0;
    let badgeFrame = 0;
    let pendingTilt: MouseEvent | null = null;
    let pendingBadge: MouseEvent | null = null;

    const applyTilt = (rx: number, ry: number) => {
      card.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
    };

    const onMouseMove = (e: MouseEvent) => {
      pendingTilt = e;
      if (tiltFrame) return;
      tiltFrame = requestAnimationFrame(() => {
        tiltFrame = 0;
        const event = pendingTilt;
        if (!event) return;
        const cx = cardRect.left + cardRect.width / 2;
        const cy = cardRect.top + cardRect.height / 2;
        const dx = (event.clientX - cx) / (cardRect.width / 2);
        const dy = (event.clientY - cy) / (cardRect.height / 2);
        applyTilt(-dy * 2.5, dx * 2.5);
      });
    };

    const refreshCardRect = () => { cardRect = card.getBoundingClientRect(); };

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
      pendingBadge = e;
      if (badgeFrame) return;
      badgeFrame = requestAnimationFrame(() => {
        badgeFrame = 0;
        const event = pendingBadge;
        if (!event) return;
        const wx = window.innerWidth / 2;
        const wy = window.innerHeight / 2;
        const dx = (event.clientX - wx) / wx;
        const dy = (event.clientY - wy) / wy;
        statBadge.style.transform = `translate(${-dx * 5}px, ${-dy * 5}px)`;
      });
    };

    widget.addEventListener('mouseenter', refreshCardRect);
    widget.addEventListener('mousemove', onMouseMove);
    widget.addEventListener('mouseleave', onMouseLeave);
    card.addEventListener('touchstart', onTouchStart, { passive: true });
    card.addEventListener('touchmove', onTouchMove, { passive: true });
    card.addEventListener('touchend', onTouchEnd);
    document.addEventListener('mousemove', onDocMouseMove);
    window.addEventListener('resize', refreshCardRect, { passive: true });

    return () => {
      timeouts.forEach((id) => window.clearTimeout(id));
      cancelAnimationFrame(tiltFrame);
      cancelAnimationFrame(badgeFrame);
      widget.removeEventListener('mouseenter', refreshCardRect);
      widget.removeEventListener('mousemove', onMouseMove);
      widget.removeEventListener('mouseleave', onMouseLeave);
      card.removeEventListener('touchstart', onTouchStart);
      card.removeEventListener('touchmove', onTouchMove);
      card.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('mousemove', onDocMouseMove);
      window.removeEventListener('resize', refreshCardRect);
    };
  }, []);

  const scrollToId = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="landing-root" id="main-content">
      <LandingAuthRedirect />
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
            <h1 className="hero-h1">
              Your Career <em>Launchpad</em> Starts Here
            </h1>

            <p className="hero-sub">
              Uniship connects students with placement opportunities, internships, and full-time roles — matched to your skills, your college, your future.
            </p>

            <div className="hero-actions">
              <Link href="/login" className="btn-solid">Get started -&gt;</Link>
              <a href="#how" className="btn-ghost">See how it works</a>
            </div>

            <div className="hero-meta">
              <span>Company listings</span><i />
              <span>Mock assessments</span><i />
              <span>AI resume builder</span><i />
              <span>Live proctoring</span>
            </div>
          </div>

          <div className="hero-visual">
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

        <div className="hero-logos">
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


    </div>
  );
}
