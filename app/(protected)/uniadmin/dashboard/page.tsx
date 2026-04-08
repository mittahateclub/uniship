'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import {
  ClipboardCheck, UserPlus, CalendarPlus,
  Database, Settings, PlusCircle, ArrowRight,
} from 'lucide-react';

/* ── Decorative SVG art per card ── */
const cardArt: Record<string, React.ReactNode> = {
  createTest: (
    <svg className="absolute right-0 top-0 h-full w-1/2" viewBox="0 0 200 200" fill="none">
      <rect x="35" y="25" width="60" height="80" rx="4" stroke="currentColor" strokeWidth="2"/>
      <line x1="50" y1="50" x2="80" y2="50" stroke="currentColor" strokeWidth="2"/>
      <line x1="50" y1="63" x2="75" y2="63" stroke="currentColor" strokeWidth="2"/>
      <line x1="50" y1="76" x2="70" y2="76" stroke="currentColor" strokeWidth="2"/>
      <circle cx="145" cy="65" r="28" stroke="currentColor" strokeWidth="2"/>
      <line x1="145" y1="52" x2="145" y2="78" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="132" y1="65" x2="158" y2="65" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <rect x="110" y="120" width="50" height="45" rx="5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3"/>
      <circle cx="50" cy="155" r="18" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3"/>
    </svg>
  ),
  manageTests: (
    <svg className="absolute right-0 top-0 h-full w-1/2" viewBox="0 0 200 200" fill="none">
      <rect x="30" y="20" width="60" height="80" rx="4" stroke="currentColor" strokeWidth="2"/>
      <line x1="45" y1="45" x2="75" y2="45" stroke="currentColor" strokeWidth="2"/>
      <line x1="45" y1="58" x2="70" y2="58" stroke="currentColor" strokeWidth="2"/>
      <line x1="45" y1="71" x2="65" y2="71" stroke="currentColor" strokeWidth="2"/>
      <circle cx="140" cy="60" r="35" stroke="currentColor" strokeWidth="2"/>
      <path d="M125 60l10 10 20-20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="110" y="120" width="50" height="50" rx="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3"/>
      <circle cx="50" cy="150" r="20" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3"/>
    </svg>
  ),
  createAccount: (
    <svg className="absolute right-0 top-0 h-full w-1/2" viewBox="0 0 200 200" fill="none">
      <circle cx="85" cy="60" r="28" stroke="currentColor" strokeWidth="2"/>
      <path d="M40 140c0-25 20-45 45-45s45 20 45 45" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="150" cy="55" r="18" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="150" y1="45" x2="150" y2="65" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="140" y1="55" x2="160" y2="55" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <rect x="115" y="130" width="45" height="40" rx="4" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3"/>
    </svg>
  ),
  createEvent: (
    <svg className="absolute right-0 top-0 h-full w-1/2" viewBox="0 0 200 200" fill="none">
      <rect x="30" y="30" width="100" height="90" rx="6" stroke="currentColor" strokeWidth="2"/>
      <line x1="30" y1="55" x2="130" y2="55" stroke="currentColor" strokeWidth="2"/>
      <circle cx="55" cy="43" r="4" fill="currentColor" opacity="0.5"/>
      <circle cx="105" cy="43" r="4" fill="currentColor" opacity="0.5"/>
      <line x1="55" y1="30" x2="55" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="105" y1="30" x2="105" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <rect x="42" y="66" width="16" height="12" rx="2" fill="currentColor" opacity="0.15"/>
      <rect x="66" y="66" width="16" height="12" rx="2" fill="currentColor" opacity="0.3"/>
      <rect x="90" y="66" width="16" height="12" rx="2" fill="currentColor" opacity="0.15"/>
      <rect x="42" y="86" width="16" height="12" rx="2" fill="currentColor" opacity="0.15"/>
      <rect x="66" y="86" width="16" height="12" rx="2" fill="currentColor" opacity="0.15"/>
      <circle cx="155" cy="120" r="28" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3"/>
    </svg>
  ),
  studentDb: (
    <svg className="absolute right-0 top-0 h-full w-1/2" viewBox="0 0 200 200" fill="none">
      <ellipse cx="90" cy="45" rx="45" ry="14" stroke="currentColor" strokeWidth="2"/>
      <path d="M45 45v40c0 8 20 14 45 14s45-6 45-14V45" stroke="currentColor" strokeWidth="2"/>
      <path d="M45 65c0 8 20 14 45 14s45-6 45-14" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3"/>
      <path d="M45 85v35c0 8 20 14 45 14s45-6 45-14V85" stroke="currentColor" strokeWidth="2"/>
      <rect x="120" y="130" width="40" height="40" rx="5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3"/>
    </svg>
  ),
  profile: (
    <svg className="absolute right-0 top-0 h-full w-1/2" viewBox="0 0 200 200" fill="none">
      <circle cx="100" cy="58" r="25" stroke="currentColor" strokeWidth="2"/>
      <path d="M55 138c0-25 20-45 45-45s45 20 45 45" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="155" cy="40" r="18" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M148 40h14M155 33v14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="40" cy="130" r="14" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3"/>
    </svg>
  ),
};

export default function UniAdminDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="loading-dots"><span /><span /><span /></div>
    </div>
  );

  const tools = [
    { title: 'Create AI Test', desc: 'Upload PDFs to automatically generate structured exam questions', href: '/uniadmin/create-test', icon: PlusCircle, art: cardArt.createTest },
    { title: 'Manage Tests', desc: 'Review, approve and share AI-generated tests with students', href: '/uniadmin/tests', icon: ClipboardCheck, art: cardArt.manageTests },
    { title: 'Create Account', desc: 'Register new student profiles and assign university access', href: '/uniadmin/create-account', icon: UserPlus, art: cardArt.createAccount },
    { title: 'Create Event', desc: 'Post workshops, seminars and campus opportunity listings', href: '/uniadmin/create-event', icon: CalendarPlus, art: cardArt.createEvent },
    { title: 'Student Database', desc: 'Browse and manage all registered students for your university', href: '/uniadmin/student-database', icon: Database, art: cardArt.studentDb },
    { title: 'Admin Profile', desc: 'Update your credentials, settings and university details', href: '/uniadmin/profile', icon: Settings, art: cardArt.profile },
  ];

  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in">
      <style>{`
        .dash-card {
          position: relative;
          overflow: hidden;
          border-radius: 10px;
          border: 1px solid var(--border-subtle);
          background: var(--bg-surface);
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
        }
        .dash-card:hover {
          border-color: var(--border-active);
          transform: translateY(-1px);
          box-shadow: 0 4px 20px -4px rgba(0,0,0,0.15);
        }
        .dash-card::before {
          content: '';
          position: absolute;
          inset: 0;
          opacity: 0;
          transition: opacity 0.2s ease;
          background: radial-gradient(500px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255,255,255,0.03), transparent 40%);
          pointer-events: none;
        }
        .dash-card:hover::before { opacity: 1; }
        [data-theme='light'] .dash-card::before {
          background: radial-gradient(500px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(0,0,0,0.02), transparent 40%);
        }
        .dash-card-icon {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
          transition: border-color 0.2s ease;
        }
        .dash-card:hover .dash-card-icon { border-color: var(--border-active); }
        .dash-card .card-arrow {
          transition: all 0.2s ease;
          opacity: 0;
          transform: translateX(-4px);
        }
        .dash-card:hover .card-arrow {
          opacity: 0.5;
          transform: translateX(0);
        }
        .dash-card .card-art {
          transition: opacity 0.3s ease;
          color: var(--text-faint);
          opacity: 0.4;
        }
        .dash-card:hover .card-art { opacity: 0.6; }
        [data-theme='light'] .dash-card:hover {
          box-shadow: 0 4px 20px -4px rgba(0,0,0,0.08);
        }
      `}</style>

      {/* Header */}
      <div className="mb-8 mt-5">
        <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-[-0.02em]">University Admin Dashboard</h1>
        <p className="text-[var(--text-tertiary)] text-[13px] mt-1">Welcome back, <span className="text-[var(--text-primary)]">{user?.email?.split('@')[0]}</span></p>
      </div>

      {/* Card Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 stagger-children">
        {tools.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="dash-card group"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
              e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
            }}
          >
            {/* Background art */}
            <div className="card-art pointer-events-none">
              {item.art}
            </div>

            {/* Content */}
            <div className="relative z-10 p-5 flex flex-col h-full min-h-[150px]">
              <div className="flex items-start justify-between mb-auto">
                <div className="dash-card-icon">
                  <item.icon size={16} className="text-[#00A8E1]" />
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-[13px] font-semibold text-[var(--text-primary)] tracking-[-0.01em]">{item.title}</h3>
                  <ArrowRight size={12} className="card-arrow text-[var(--text-faint)]" />
                </div>
                <p className="text-[var(--text-muted)] text-[11px] mt-1 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}