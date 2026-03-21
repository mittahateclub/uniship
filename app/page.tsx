'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firestore';
import Link from 'next/link';
import {
  ArrowRight,
  GraduationCap,
  ShieldCheck,
  ChevronDown,
  Server,
  ChartNoAxesColumn,
  Copyright,
  Users,
  BriefcaseBusiness,
  UserCog,
  Gauge,
  Workflow,
  LockKeyhole,
} from 'lucide-react';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeSection, setActiveSection] = useState('hero');

  useEffect(() => {
    async function checkUserRole() {
      if (!loading) {
        if (!user) {
          setChecking(false);
        } else {
          setChecking(true);
          // Get user role from Firestore
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          
          if (userDoc.exists()) {
            const role = userDoc.data().role;
            
            switch(role) {
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
            // Default to user dashboard if no role set
            router.push('/user/dashboard');
          }
          return;
        }
      }
    }

    checkUserRole();
  }, [user, loading, router]);

  useEffect(() => {
    const onScroll = () => {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) {
        setScrollProgress(0);
        return;
      }
      setScrollProgress(Math.min(100, Math.max(0, (window.scrollY / docHeight) * 100)));
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const ids = ['hero', 'roles', 'capabilities', 'how-it-works', 'cta'];
    const observers = ids.map((id) => {
      const el = document.getElementById(id);
      if (!el) return null;
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) setActiveSection(id);
          });
        },
        { threshold: 0.35 },
      );
      observer.observe(el);
      return observer;
    });

    return () => observers.forEach((o) => o?.disconnect());
  }, []);

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
    <div className="min-h-screen bg-[var(--bg-primary)] relative overflow-x-hidden">
      <div className="fixed top-0 left-0 h-0.5 bg-[#F54E00] z-[60] transition-[width] duration-150" style={{ width: `${scrollProgress}%` }} />

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-20 left-[-8%] w-[30rem] h-[30rem] rounded-full bg-[#F54E00]/12 blur-3xl" />
        <div className="absolute top-[36rem] right-[-10%] w-[28rem] h-[28rem] rounded-full bg-[#5E6AD2]/12 blur-3xl" />
        <div className="absolute bottom-[15rem] left-[15%] w-[22rem] h-[22rem] rounded-full bg-[#4CAF50]/8 blur-3xl" />
      </div>

      <div className="hidden lg:flex fixed right-5 top-1/2 -translate-y-1/2 z-40 flex-col gap-2">
        {[
          { id: 'hero', label: 'Start' },
          { id: 'roles', label: 'Roles' },
          { id: 'capabilities', label: 'Features' },
          { id: 'how-it-works', label: 'Flow' },
          { id: 'cta', label: 'Login' },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => scrollToId(item.id)}
            className={`px-2 py-1 rounded text-[10px] uppercase tracking-wider border transition-colors ${
              activeSection === item.id
                ? 'border-[#F54E00]/60 text-[#F54E00] bg-[#F54E00]/8'
                : 'border-[var(--border-subtle)] text-[var(--text-faint)] hover:text-[var(--text-primary)]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
        <header className="sticky top-0 z-50 backdrop-blur bg-[var(--bg-surface)]/95 border-b border-[var(--border-active)] shadow-sm">
          <div className="h-16 flex items-center justify-between">
            <button onClick={() => scrollToId('hero')} className="inline-flex items-center gap-2 px-3 py-2 rounded border border-[var(--border-active)] bg-[var(--bg-primary)] hover:bg-[var(--bg-elevated)] transition-colors">
              <GraduationCap size={16} className="text-[#F54E00]" />
              <span className="text-[12px] font-semibold tracking-wide text-[var(--text-primary)]">UNISHIP</span>
            </button>

            <nav className="hidden md:flex items-center gap-5 text-[12px] text-[var(--text-secondary)]">
              <button onClick={() => scrollToId('roles')} className="hover:text-[var(--text-primary)] font-medium transition-colors">Who Uses It</button>
              <button onClick={() => scrollToId('capabilities')} className="hover:text-[var(--text-primary)] font-medium transition-colors">Capabilities</button>
              <button onClick={() => scrollToId('how-it-works')} className="hover:text-[var(--text-primary)] font-medium transition-colors">Process</button>
            </nav>

            <Link href="/login" className="btn-secondary inline-flex items-center gap-1.5">
              Sign In
              <ArrowRight size={14} />
            </Link>
          </div>
        </header>

        <section id="hero" className="min-h-[92vh] py-16 sm:py-20 flex items-center animate-fade-in">
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-end">
            <div className="lg:col-span-8">
              <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-faint)] mb-5">Assessment Operations Platform</p>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-[-0.035em] text-[var(--text-primary)] leading-[1.02] max-w-4xl">
                Launch secure coding tests.
                <br />
                Get verdicts.
                <br />
                Move faster on hiring decisions.
              </h1>
              <p className="text-[15px] sm:text-[16px] text-[var(--text-tertiary)] mt-6 max-w-2xl leading-relaxed">
                UniShip combines exam security, auto-evaluation, and role-based workflows in one platform designed for campus recruitment at scale.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/login" className="btn-primary inline-flex items-center gap-2">
                  Sign In to Platform
                  <ArrowRight size={14} />
                </Link>
                <button onClick={() => scrollToId('roles')} className="btn-secondary inline-flex items-center gap-1.5">
                  Discover Experience
                  <ChevronDown size={14} />
                </button>
              </div>
            </div>

            <div className="lg:col-span-4 window p-5 sm:p-6">
              <p className="text-[10px] uppercase tracking-widest text-[var(--text-faint)] mb-3">Live Platform Signals</p>
              <div className="space-y-2.5">
                <div className="rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
                  <p className="text-[11px] text-[var(--text-faint)]">Judge Status</p>
                  <p className="text-[13px] font-semibold text-[#4CAF50] mt-1">Running AC/WA/TLE/RE pipeline</p>
                </div>
                <div className="rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
                  <p className="text-[11px] text-[var(--text-faint)]">Exam Integrity</p>
                  <p className="text-[13px] font-semibold text-[#5E6AD2] mt-1">Fullscreen + activity monitoring enabled</p>
                </div>
                <div className="rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
                  <p className="text-[11px] text-[var(--text-faint)]">Role Access</p>
                  <p className="text-[13px] font-semibold text-[#F54E00] mt-1">Students, Uni Admins, Super Admins</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="roles" className="min-h-[72vh] py-12 sm:py-16">
          <div className="mb-7">
            <p className="text-[11px] uppercase tracking-widest text-[var(--text-faint)] mb-2">Built for Teams</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">Different roles, one shared outcome</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="window p-6">
              <div className="w-10 h-10 rounded bg-[#5E6AD2]/10 border border-[#5E6AD2]/20 flex items-center justify-center mb-4">
                <Users size={18} className="text-[#5E6AD2]" />
              </div>
              <h3 className="text-[16px] font-semibold text-[var(--text-primary)] mb-2">Students</h3>
              <p className="text-[13px] text-[var(--text-tertiary)] leading-relaxed">Write code in a secure exam space, run quick checks, and submit with confidence.</p>
            </div>

            <div className="window p-6">
              <div className="w-10 h-10 rounded bg-[#F54E00]/10 border border-[#F54E00]/20 flex items-center justify-center mb-4">
                <UserCog size={18} className="text-[#F54E00]" />
              </div>
              <h3 className="text-[16px] font-semibold text-[var(--text-primary)] mb-2">University Admins</h3>
              <p className="text-[13px] text-[var(--text-tertiary)] leading-relaxed">Create tests, monitor sessions, and review readiness metrics from one control layer.</p>
            </div>

            <div className="window p-6">
              <div className="w-10 h-10 rounded bg-[#4CAF50]/10 border border-[#4CAF50]/20 flex items-center justify-center mb-4">
                <BriefcaseBusiness size={18} className="text-[#4CAF50]" />
              </div>
              <h3 className="text-[16px] font-semibold text-[var(--text-primary)] mb-2">Placement Teams</h3>
              <p className="text-[13px] text-[var(--text-tertiary)] leading-relaxed">Use verified performance signals and trend analysis to shortlist the right candidates faster.</p>
            </div>
          </div>
        </section>

        <section id="capabilities" className="min-h-[78vh] py-12 sm:py-16">
          <div className="mb-7">
            <p className="text-[11px] uppercase tracking-widest text-[var(--text-faint)] mb-2">Core Capabilities</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">Platform-grade operations for every assessment cycle</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              {
                title: 'Secure Exam Runtime',
                desc: 'Control exam behavior with fullscreen enforcement, tab integrity checks, and session-level monitoring.',
                icon: LockKeyhole,
                tone: 'text-[#5E6AD2] border-[#5E6AD2]/20 bg-[#5E6AD2]/10',
              },
              {
                title: 'Evaluation Engine',
                desc: 'Run code and submit against hidden constraints with deterministic verdicts and bounded runtime limits.',
                icon: Server,
                tone: 'text-[#F54E00] border-[#F54E00]/20 bg-[#F54E00]/10',
              },
              {
                title: 'Performance Analytics',
                desc: 'Convert raw attempts into interpretable reliability and accuracy signals for selection workflows.',
                icon: ChartNoAxesColumn,
                tone: 'text-[#4CAF50] border-[#4CAF50]/20 bg-[#4CAF50]/10',
              },
              {
                title: 'High Throughput Experience',
                desc: 'Deliver consistent student and admin UX even under larger batches of exams and reviews.',
                icon: Gauge,
                tone: 'text-[#F1A82C] border-[#F1A82C]/20 bg-[#F1A82C]/10',
              },
            ].map((item) => (
              <div key={item.title} className="window p-6">
                <div className={`w-10 h-10 rounded border flex items-center justify-center mb-4 ${item.tone}`}>
                  <item.icon size={18} />
                </div>
                <h3 className="text-[16px] font-semibold text-[var(--text-primary)] mb-2">{item.title}</h3>
                <p className="text-[13px] text-[var(--text-tertiary)] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="min-h-[68vh] py-12 sm:py-16">
          <div className="window p-6 sm:p-8">
            <div className="flex items-center gap-2 mb-4">
              <Workflow size={16} className="text-[#F54E00]" />
              <p className="text-[11px] uppercase tracking-widest text-[var(--text-faint)]">Execution Flow</p>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mb-6">From question creation to hiring insight in four stages</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {[
                { step: '01', title: 'Author', desc: 'Admins define problems, constraints, and scoring conditions.' },
                { step: '02', title: 'Attempt', desc: 'Students solve in a monitored environment with built-in guidance.' },
                { step: '03', title: 'Evaluate', desc: 'The judge executes and returns clear verdicts with execution metadata.' },
                { step: '04', title: 'Decide', desc: 'Dashboards turn performance into selection-ready context.' },
              ].map((item) => (
                <div key={item.step} className="rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
                  <p className="text-[10px] font-bold tracking-widest text-[var(--text-faint)] mb-2">PHASE {item.step}</p>
                  <h3 className="text-[14px] font-semibold text-[var(--text-primary)] mb-1.5">{item.title}</h3>
                  <p className="text-[12px] text-[var(--text-tertiary)] leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="cta" className="py-12 sm:py-16">
          <div className="window p-7 sm:p-10 bg-gradient-to-br from-[var(--bg-surface)] to-[var(--bg-elevated)]">
            <p className="text-[11px] uppercase tracking-widest text-[var(--text-faint)] mb-3">Ready to Begin</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] max-w-2xl">
              Sign in and launch your full assessment workflow.
            </h2>
            <p className="text-[14px] text-[var(--text-tertiary)] mt-3 max-w-xl">
              Continue with your existing account to access student, uni admin, or super admin experience.
            </p>
            <div className="mt-6">
              <Link href="/login" className="btn-primary inline-flex items-center gap-2">
                Continue to Sign In
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </section>

        <footer id="footer" className="mt-8 border-t border-[var(--border-subtle)] py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[12px] text-[var(--text-tertiary)]">
            <Copyright size={13} className="text-[var(--text-faint)]" />
            <span>{new Date().getFullYear()} UniShip. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-4 text-[12px] text-[var(--text-tertiary)]">
            <button onClick={() => scrollToId('hero')} className="hover:text-[var(--text-primary)] transition-colors">Back to Top</button>
            <Link href="/login" className="hover:text-[var(--text-primary)] transition-colors">Sign In</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}