'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firestore';
import Link from 'next/link';
import Image from 'next/image';
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

  useEffect(() => {
    if (loading || checking) return;

    const card = document.getElementById('rwCard') as HTMLElement | null;
    const widget = document.getElementById('resumeWidget') as HTMLElement | null;
    const scoreArc = document.getElementById('scoreArc') as SVGCircleElement | null;
    const scoreNum = document.getElementById('scoreNum') as HTMLElement | null;
    const aiTitle = document.getElementById('aiTitle') as HTMLElement | null;
    const aiBody = document.getElementById('aiBody') as HTMLElement | null;
    const skillBarWrap = document.getElementById('skillBarWrap') as HTMLElement | null;
    const skillBarFill = document.getElementById('skillBarFill') as HTMLElement | null;
    const skillBarLabel = document.getElementById('skillBarLabel') as HTMLElement | null;
    const skillBarPct = document.getElementById('skillBarPct') as HTMLElement | null;
    const generateBtn = document.getElementById('generateBtn') as HTMLButtonElement | null;
    const genBtnText = document.getElementById('genBtnText') as HTMLElement | null;
    const genProgress = document.getElementById('genProgress') as HTMLElement | null;
    const rwAvatar = document.getElementById('rwAvatar') as HTMLElement | null;
    const rwScore = document.getElementById('rwScore') as HTMLElement | null;
    const aiCard = document.getElementById('aiCard') as HTMLElement | null;

    if (!card || !widget || !scoreArc || !scoreNum || !aiTitle || !aiBody || !skillBarWrap || !skillBarFill || !skillBarLabel || !skillBarPct || !generateBtn || !genBtnText || !genProgress || !rwAvatar || !rwScore || !aiCard) {
      return;
    }

    const timeouts: number[] = [];
    const intervals: number[] = [];

    const applyTilt = (rx: number, ry: number) => {
      card.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
      card.style.boxShadow = `${-ry * 2}px ${rx * 2 + 20}px 80px rgba(0,0,0,0.7), 0 0 40px rgba(0,168,225,${0.04 + Math.abs(ry) * 0.005})`;
    };

    const onWidgetMouseMove = (e: MouseEvent) => {
      const r = card.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = (e.clientX - cx) / (r.width / 2);
      const dy = (e.clientY - cy) / (r.height / 2);
      applyTilt(-dy * 10, dx * 10);
    };

    const onWidgetMouseLeave = () => {
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

    const onCardTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      isTouchDragging = true;
    };

    const onCardTouchMove = (e: TouchEvent) => {
      if (!isTouchDragging) return;
      const dx = (e.touches[0].clientX - touchStartX) / 15;
      const dy = (e.touches[0].clientY - touchStartY) / 15;
      applyTilt(-dy, dx);
    };

    const onCardTouchEnd = () => {
      isTouchDragging = false;
      card.style.transition = 'transform 0.7s cubic-bezier(.4,0,.2,1), box-shadow 0.3s';
      applyTilt(0, 0);
      const t = window.setTimeout(() => {
        card.style.transition = 'transform 0.08s linear, box-shadow 0.3s';
      }, 700);
      timeouts.push(t);
    };

    const animateScore = () => {
      const total = 138;
      const target = 99;
      let cur = 99;
      const id = window.setInterval(() => {
        cur += 2;
        if (cur >= target) {
          cur = target;
          window.clearInterval(id);
        }
        scoreNum.textContent = String(cur);
        scoreArc.style.strokeDashoffset = String(total - (total * cur / 100));
      }, 30);
      intervals.push(id);
    };

    const scoreKickoff = window.setTimeout(animateScore, 800);
    timeouts.push(scoreKickoff);

    const aiMessages = [
      { title: 'Skill Match', body: 'React & TS - top 5% fit' },
      { title: 'ATS Score', body: 'Keyword density: optimal' },
      { title: 'Suggestion', body: 'Add quantified impact metrics' },
      { title: 'Job Fit', body: '17 roles matched today' },
      { title: 'AI Insight', body: 'Profile strength: Excellent' },
    ];

    let aiIdx = 0;
    const aiInterval = window.setInterval(() => {
      aiIdx = (aiIdx + 1) % aiMessages.length;
      aiTitle.style.opacity = '0';
      aiBody.style.opacity = '0';
      const t = window.setTimeout(() => {
        aiTitle.textContent = aiMessages[aiIdx].title;
        aiBody.textContent = aiMessages[aiIdx].body;
        aiTitle.style.transition = 'opacity 0.4s';
        aiBody.style.transition = 'opacity 0.4s';
        aiTitle.style.opacity = '1';
        aiBody.style.opacity = '1';
      }, 300);
      timeouts.push(t);
    }, 3000);
    intervals.push(aiInterval);

    const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('.rw-tab'));
    const panels = Array.from(document.querySelectorAll<HTMLElement>('.rw-tab-panel'));
    const skills = Array.from(document.querySelectorAll<HTMLElement>('.rw-skill'));

    const tabHandlers: Array<() => void> = [];
    tabs.forEach((tab) => {
      const handler = () => {
        tabs.forEach((t) => t.classList.remove('active'));
        panels.forEach((p) => p.classList.remove('active'));
        tab.classList.add('active');
        const tabId = tab.dataset.tab;
        const target = document.getElementById(`tab-${tabId}`);
        target?.classList.add('active');
        skillBarWrap.style.display = 'none';
        skills.forEach((s) => s.classList.remove('active'));
      };
      tab.addEventListener('click', handler);
      tabHandlers.push(() => tab.removeEventListener('click', handler));
    });

    const skillHandlers: Array<() => void> = [];
    skills.forEach((skill) => {
      const handler = () => {
        skills.forEach((s) => s.classList.remove('active'));
        skill.classList.add('active');
        const level = skill.dataset.level || '0';
        skillBarWrap.style.display = 'block';
        skillBarLabel.textContent = skill.textContent || '';
        skillBarPct.textContent = `${level}%`;
        skillBarFill.style.width = '0%';
        const t = window.setTimeout(() => {
          skillBarFill.style.width = `${level}%`;
        }, 50);
        timeouts.push(t);
      };
      skill.addEventListener('click', handler);
      skillHandlers.push(() => skill.removeEventListener('click', handler));
    });

    const spawnSparks = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      const wr = widget.getBoundingClientRect();
      for (let i = 0; i < 10; i += 1) {
        const spark = document.createElement('div');
        spark.className = 'rw-spark';
        const angle = (Math.PI * 2 * i) / 10;
        const dist = 30 + Math.random() * 30;
        spark.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
        spark.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
        spark.style.left = `${r.left - wr.left + r.width / 2}px`;
        spark.style.top = `${r.top - wr.top + r.height / 2}px`;
        spark.style.background = i % 2 === 0 ? '#00A8E1' : '#66D0F0';
        widget.appendChild(spark);
        const t = window.setTimeout(() => spark.remove(), 700);
        timeouts.push(t);
      }
    };

    const onGenerateClick = () => {
      if (generateBtn.classList.contains('loading')) return;
      generateBtn.classList.add('loading');
      spawnSparks(generateBtn);

      const phases = [
        'Scanning profile...',
        'Matching keywords...',
        'Tailoring language...',
        'Scoring ATS fit...',
        'Resume Optimized!',
      ];
      let phaseIndex = 0;
      let progress = 0;

      genBtnText.textContent = phases[0];

      const progressId = window.setInterval(() => {
        progress += 1.2;
        genProgress.style.width = `${Math.min(progress, 100)}%`;
      }, 40);
      intervals.push(progressId);

      const phaseId = window.setInterval(() => {
        phaseIndex += 1;
        if (phaseIndex < phases.length) genBtnText.textContent = phases[phaseIndex];
        if (phaseIndex >= phases.length - 1) {
          window.clearInterval(phaseId);
          window.clearInterval(progressId);
          genProgress.style.width = '100%';

          const t = window.setTimeout(() => {
            generateBtn.classList.remove('loading');
            genBtnText.textContent = 'AI Optimize Resume';
            genProgress.style.width = '0%';
            scoreNum.textContent = '99';
            scoreArc.style.strokeDashoffset = String(138 - (138 * 99 / 100));

            const t2 = window.setTimeout(() => {
              scoreNum.textContent = '99';
              scoreArc.style.strokeDashoffset = String(138 - (138 * 99 / 100));
            }, 2000);
            timeouts.push(t2);
          }, 800);
          timeouts.push(t);
        }
      }, 700);
      intervals.push(phaseId);
    };

    const onAvatarClick = () => spawnSparks(rwAvatar);

    const onDocMouseMove = (e: MouseEvent) => {
      const wx = window.innerWidth / 2;
      const wy = window.innerHeight / 2;
      const dx = (e.clientX - wx) / wx;
      const dy = (e.clientY - wy) / wy;
      rwScore.style.transform = `translate(${-dx * 6}px, ${-dy * 6}px) scale(1)`;
      aiCard.style.transform = `translate(${dx * 4}px, ${dy * 4}px)`;
    };

    widget.addEventListener('mousemove', onWidgetMouseMove);
    widget.addEventListener('mouseleave', onWidgetMouseLeave);
    card.addEventListener('touchstart', onCardTouchStart, { passive: true });
    card.addEventListener('touchmove', onCardTouchMove, { passive: true });
    card.addEventListener('touchend', onCardTouchEnd);
    generateBtn.addEventListener('click', onGenerateClick);
    rwAvatar.addEventListener('click', onAvatarClick);
    document.addEventListener('mousemove', onDocMouseMove);

    return () => {
      timeouts.forEach((id) => window.clearTimeout(id));
      intervals.forEach((id) => window.clearInterval(id));
      tabHandlers.forEach((dispose) => dispose());
      skillHandlers.forEach((dispose) => dispose());
      widget.removeEventListener('mousemove', onWidgetMouseMove);
      widget.removeEventListener('mouseleave', onWidgetMouseLeave);
      card.removeEventListener('touchstart', onCardTouchStart);
      card.removeEventListener('touchmove', onCardTouchMove);
      card.removeEventListener('touchend', onCardTouchEnd);
      generateBtn.removeEventListener('click', onGenerateClick);
      rwAvatar.removeEventListener('click', onAvatarClick);
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
        <div className="hero-grid" />

        <div className="hero-layout">
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
              <Link href="/login" className="btn-primary">SIGN IN -&gt;</Link>
              <button className="btn-secondary" onClick={() => scrollToId('process')}>See How It Works</button>
            </div>
          </div>

          <div className="hero-right">
            <div className="resume-widget sketch-widget" id="resumeWidget">
              <div className="rw-score" id="rwScore">
                <svg width="52" height="52" viewBox="0 0 52 52">
                  <circle cx="26" cy="26" r="22" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                  <circle
                    cx="26"
                    cy="26"
                    r="22"
                    fill="none"
                    stroke="#00A8E1"
                    strokeWidth="3"
                    strokeDasharray="138"
                    strokeDashoffset="1.38"
                    strokeLinecap="round"
                    id="scoreArc"
                    style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', transition: 'stroke-dashoffset 1.8s cubic-bezier(.4,0,.2,1)' }}
                  />
                </svg>
                <span className="rw-score-label">ATS SCORE</span>
                <div className="rw-score-inner">
                  <span className="rw-score-num" id="scoreNum">99</span>
                </div>
              </div>

              <div className="rw-ai-card" id="aiCard">
                <div className="rw-ai-icon">✦</div>
                <div className="rw-ai-text">
                  <div className="rw-ai-title" id="aiTitle">AI Suggestion</div>
                  <div className="rw-ai-body" id="aiBody">Optimizing for Product roles...</div>
                </div>
                <div className="rw-ai-dot" />
              </div>

              <div className="rw-card" id="rwCard">
                <div className="rw-card-inner">
                  <div className="rw-accent-bar" />
                  <div className="rw-scan" id="rwScan" />

                  <div className="rw-header">
                    <div className="rw-avatar" id="rwAvatar">
                      <span>N</span>
                      <div className="rw-avatar-ring" />
                    </div>
                    <div className="rw-name-block">
                      <div className="rw-name">Name</div>
                      <div className="rw-role-tag">Full Stack Developer</div>
                      <div className="rw-location">Hyderabad</div>
                    </div>
                  </div>

                  <div className="rw-tabs">
                    <button className="rw-tab active" data-tab="exp">Experience</button>
                    <button className="rw-tab" data-tab="skills">Skills</button>
                    <button className="rw-tab" data-tab="edu">Education</button>
                  </div>

                  <div className="rw-tab-panel active" id="tab-exp">
                    <div className="rw-entry">
                      <div className="rw-entry-left">
                        <div className="rw-entry-title">Software Engineer Intern</div>
                        <div className="rw-entry-sub">Razorpay · Bangalore</div>
                      </div>
                      <div className="rw-entry-chip">2024</div>
                    </div>
                    <div className="rw-entry">
                      <div className="rw-entry-left">
                        <div className="rw-entry-title">Frontend Developer Intern</div>
                        <div className="rw-entry-sub">Flipkart · Remote</div>
                      </div>
                      <div className="rw-entry-chip">2023</div>
                    </div>
                    <div className="rw-entry">
                      <div className="rw-entry-left">
                        <div className="rw-entry-title">Open Source Contributor</div>
                        <div className="rw-entry-sub">Mozilla Firefox · Remote</div>
                      </div>
                      <div className="rw-entry-chip">2023</div>
                    </div>
                  </div>

                  <div className="rw-tab-panel" id="tab-skills">
                    <div className="rw-skills-grid">
                      <span className="rw-skill" data-level="95">React</span>
                      <span className="rw-skill" data-level="88">TypeScript</span>
                      <span className="rw-skill" data-level="82">Node.js</span>
                      <span className="rw-skill" data-level="79">Python</span>
                      <span className="rw-skill" data-level="74">PostgreSQL</span>
                      <span className="rw-skill" data-level="91">Figma</span>
                      <span className="rw-skill" data-level="70">Docker</span>
                      <span className="rw-skill" data-level="85">Git</span>
                    </div>
                    <div className="rw-skill-bar-wrap" id="skillBarWrap" style={{ display: 'none' }}>
                      <div className="rw-skill-bar-label" id="skillBarLabel">React</div>
                      <div className="rw-skill-bar-track"><div className="rw-skill-bar-fill" id="skillBarFill" /></div>
                      <div className="rw-skill-bar-pct" id="skillBarPct">95%</div>
                    </div>
                  </div>

                  <div className="rw-tab-panel" id="tab-edu">
                    <div className="rw-entry">
                      <div className="rw-entry-left">
                        <div className="rw-entry-title">B.E. Computer Science</div>
                        <div className="rw-entry-sub"> Hyderabad Campus</div>
                      </div>
                      <div className="rw-entry-chip">2025</div>
                    </div>
                    <div className="rw-entry">
                      <div className="rw-entry-left">
                        <div className="rw-entry-title">CGPA 9.1 / 10</div>
                        <div className="rw-entry-sub">Dean's List - 4 consecutive semesters</div>
                      </div>
                      <div className="rw-entry-chip gpa">★</div>
                    </div>
                  </div>

                  <div className="rw-generate-wrap">
                    <button className="rw-generate-btn" id="generateBtn">
                      <span className="rw-gen-icon">✦</span>
                      <span id="genBtnText">AI Optimize Resume</span>
                    </button>
                    <div className="rw-gen-progress" id="genProgress" />
                  </div>
                </div>

                <div className="rw-corner tl" />
                <div className="rw-corner tr" />
                <div className="rw-corner bl" />
                <div className="rw-corner br" />
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

        .resume-widget {
          position: relative;
          width: 360px;
          height: 520px;
          perspective: 1000px;
          user-select: none;
          animation: fadeUp 0.8s 0.2s ease both;
        }

        .sketch-widget {
          filter: sepia(0.1) saturate(0.7) contrast(1.12);
        }

        .rw-score {
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
          border: 1px solid rgba(0,168,225,0.2);
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
          border: 1px solid rgba(0,168,225,0.15);
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
          background: rgba(0,168,225,0.08);
          border: 1px solid rgba(0,168,225,0.2);
          border-radius: 100px;
          font-size: 0.75rem;
          color: var(--orange-light);
          letter-spacing: 0.01em;
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
