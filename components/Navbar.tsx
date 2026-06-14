'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  LayoutDashboard,
  FileText,
  Briefcase,
  ClipboardCheck,
  BarChart3,
  Calendar,
  User,
  Users,
  LogOut,
  Search,
  Download,
  GraduationCap,
  Database,
  CalendarPlus,
  ShieldCheck,
  UserPlus,
  PanelLeftClose,
  PanelLeftOpen,
  Award,
  FolderKanban,
  Trophy,
  Star,
  Phone,
  Globe,
  Camera,
  Code,
  MapPin,
  Clock,
  Building2,
  Hash,
  Mail,
  Lock,
  Upload,
  Sparkles,
  X,
  MessageCircle,
} from '@/components/icons';

interface NavLink {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  group?: string;
}

interface SearchableItem extends NavLink {
  desc: string;
  category: string;
}

const userNavLinks: NavLink[] = [
  { href: '/user/dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Main' },
  { href: '/user/internships', label: 'College Space', icon: Briefcase, group: 'Main' },
  { href: '/user/applications', label: 'Applications', icon: ClipboardCheck, group: 'Main' },
  { href: '/user/test-portal', label: 'Tests', icon: FileText, group: 'Prepare' },
  { href: '/user/practice', label: 'Practice', icon: Code, group: 'Prepare' },
  { href: '/user/resume', label: 'AI Resume Builder', icon: Sparkles, group: 'Prepare' },
  { href: '/user/results', label: 'Results', icon: BarChart3, group: 'Track' },
  { href: '/user/resume/download', label: 'Export Resume', icon: Download, group: 'Track' },
  { href: '/user/profile', label: 'Profile', icon: User, group: 'Track' },
];

const uniadminNavLinks: NavLink[] = [
  { href: '/uniadmin/dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Main' },
  { href: '/uniadmin/create-test', label: 'Tests', icon: FileText, group: 'Manage' },
  { href: '/uniadmin/practice', label: 'Practice', icon: Code, group: 'Manage' },
  { href: '/uniadmin/proctoring', label: 'Proctoring', icon: ShieldCheck, group: 'Manage' },
  { href: '/uniadmin/create-event', label: 'Create Event', icon: CalendarPlus, group: 'Manage' },
  { href: '/uniadmin/inbox', label: 'Support Inbox', icon: MessageCircle, group: 'Manage' },
  { href: '/uniadmin/create-account', label: 'Create Account', icon: UserPlus, group: 'Admin' },
  { href: '/uniadmin/student-database', label: 'Students', icon: Database, group: 'Admin' },
  { href: '/uniadmin/profile', label: 'Profile', icon: User, group: 'Admin' },
];

const superadminNavLinks: NavLink[] = [
  { href: '/superadmin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/superadmin/universities', label: 'Universities', icon: Building2 },
  { href: '/superadmin/manage-students', label: 'Manage Students', icon: Users },
  { href: '/superadmin/create-uniadmin', label: 'Create Admin', icon: UserPlus },
  { href: '/superadmin/manage-uniadmins', label: 'Manage Admins', icon: ShieldCheck },
];

const userSearchItems: SearchableItem[] = [
  // Pages
  { href: '/user/dashboard', label: 'Dashboard', desc: 'Overview & quick stats', icon: LayoutDashboard, category: 'Pages' },
  { href: '/user/test-portal', label: 'Test Portal', desc: 'Browse & take assessments', icon: FileText, category: 'Pages' },
  { href: '/user/internships', label: 'College Space', desc: 'Events, internships & opportunities', icon: Briefcase, category: 'Pages' },
  { href: '/user/applications', label: 'Applications', desc: 'Track your submissions', icon: ClipboardCheck, category: 'Pages' },
  { href: '/user/results', label: 'Results', desc: 'View scores & performance', icon: BarChart3, category: 'Pages' },
  { href: '/user/calendar', label: 'Calendar', desc: 'Upcoming events & deadlines', icon: Calendar, category: 'Pages' },
  { href: '/user/profile', label: 'Profile', desc: 'Account settings & details', icon: User, category: 'Pages' },
  { href: '/user/resume', label: 'AI Resume Builder', desc: 'AI-powered resume editor', icon: Sparkles, category: 'Pages' },
  { href: '/user/practice', label: 'Practice', desc: 'LeetCode-style coding practice', icon: Code, category: 'Pages' },
  // Profile — In-page sections
  { href: '/user/profile#personal-details', label: 'Personal Details', desc: 'Name, roll number, phone, email, title', icon: User, category: 'Profile' },
  { href: '/user/profile#photo', label: 'Profile Photo', desc: 'Upload or change profile picture', icon: Camera, category: 'Profile' },
  { href: '/user/profile#web-presence', label: 'LinkedIn & GitHub', desc: 'Add or update social links', icon: Globe, category: 'Profile' },
  { href: '/user/profile#education', label: 'Education', desc: 'Add or edit education entries', icon: GraduationCap, category: 'Profile' },
  { href: '/user/profile#experience', label: 'Experience', desc: 'Add work experience & internships', icon: Briefcase, category: 'Profile' },
  { href: '/user/profile#projects', label: 'Projects', desc: 'Add or edit portfolio projects', icon: FolderKanban, category: 'Profile' },
  { href: '/user/profile#achievements', label: 'Achievements', desc: 'Awards, certifications & honors', icon: Trophy, category: 'Profile' },
  { href: '/user/profile#positions', label: 'Positions', desc: 'Leadership & club positions', icon: Star, category: 'Profile' },
  { href: '/user/profile#extracurriculars', label: 'Extracurriculars', desc: 'Activities & hobbies', icon: Award, category: 'Profile' },
  // Resume — In-page sections
  { href: '/user/resume#ai-tailor', label: 'AI Resume Tailor', desc: 'Auto-generate tailored resume', icon: Sparkles, category: 'Resume' },
  { href: '/user/resume/download', label: 'Saved Resumes', desc: 'View & export saved resumes', icon: Download, category: 'Resume' },
  // Dashboard — In-page sections
  { href: '/user/dashboard#stats', label: 'Application Stats', desc: 'Total applications count', icon: ClipboardCheck, category: 'Dashboard' },
  { href: '/user/dashboard#stats', label: 'Pending Tests', desc: 'Tests waiting to be taken', icon: FileText, category: 'Dashboard' },
  { href: '/user/dashboard#stats', label: 'Upcoming Events', desc: 'Scheduled events count', icon: Calendar, category: 'Dashboard' },
  { href: '/user/dashboard#stats', label: 'Average Score', desc: 'Overall test performance', icon: BarChart3, category: 'Dashboard' },
  // College Space — In-page sections
  { href: '/user/internships#listings', label: 'Browse Listings', desc: 'All posted opportunities', icon: Building2, category: 'College Space' },
  { href: '/user/internships#listings', label: 'Saved Items', desc: 'Your saved events & opportunities', icon: Star, category: 'College Space' },
  // Actions
  { href: '/user/resume/download', label: 'Download Resume', desc: 'Export as PDF', icon: Download, category: 'Actions' },
  { href: '/user/test-portal', label: 'Take a Test', desc: 'Start an available assessment', icon: FileText, category: 'Actions' },
  { href: '/user/internships', label: 'Browse College Space', desc: 'Events & opportunities', icon: Search, category: 'Actions' },
  { href: '/user/applications', label: 'Check Application Status', desc: 'View pending & accepted', icon: ClipboardCheck, category: 'Actions' },
  { href: '/user/calendar', label: 'View Upcoming Events', desc: 'See scheduled dates', icon: Calendar, category: 'Actions' },
];

const uniadminSearchItems: SearchableItem[] = [
  // Pages
  { href: '/uniadmin/dashboard', label: 'Dashboard', desc: 'Admin overview & stats', icon: LayoutDashboard, category: 'Pages' },
  { href: '/uniadmin/create-test', label: 'Tests', desc: 'Upload & manage assessments', icon: FileText, category: 'Pages' },
  { href: '/uniadmin/create-event', label: 'Create Event', desc: 'Schedule an event', icon: CalendarPlus, category: 'Pages' },
  { href: '/uniadmin/create-account', label: 'Create Account', desc: 'Add student account', icon: UserPlus, category: 'Pages' },
  { href: '/uniadmin/student-database', label: 'Student Database', desc: 'Browse all students', icon: Database, category: 'Pages' },
  { href: '/uniadmin/profile', label: 'Profile', desc: 'Admin profile settings', icon: User, category: 'Pages' },
  { href: '/uniadmin/proctoring', label: 'Proctoring', desc: 'Monitor live exams & chat', icon: ShieldCheck, category: 'Pages' },
  { href: '/uniadmin/inbox', label: 'Support Inbox', desc: 'Reply to student support chats', icon: MessageCircle, category: 'Pages' },
  { href: '/uniadmin/practice', label: 'Practice', desc: 'Manage coding practice problems', icon: Code, category: 'Pages' },
  // Dashboard — In-page sections
  { href: '/uniadmin/dashboard#stats', label: 'Active Tests', desc: 'Count of currently active tests', icon: FileText, category: 'Dashboard' },
  { href: '/uniadmin/dashboard#stats', label: 'Total Students', desc: 'Number of registered students', icon: User, category: 'Dashboard' },
  { href: '/uniadmin/dashboard#stats', label: 'Upcoming Events', desc: 'Scheduled university events', icon: Calendar, category: 'Dashboard' },
  // Create Test — In-page sections
  { href: '/uniadmin/create-test', label: 'Upload PDF', desc: 'Upload test document for parsing', icon: Upload, category: 'Tests' },
  // Create Event — In-page sections
  { href: '/uniadmin/create-event#form', label: 'Event Title', desc: 'Set event name', icon: CalendarPlus, category: 'Create Event' },
  { href: '/uniadmin/create-event#form', label: 'Event Type', desc: 'Workshop, seminar, or other', icon: Star, category: 'Create Event' },
  { href: '/uniadmin/create-event#form', label: 'Event Date & Time', desc: 'Schedule date and time', icon: Clock, category: 'Create Event' },
  { href: '/uniadmin/create-event#form', label: 'Event Location', desc: 'Set venue or online link', icon: MapPin, category: 'Create Event' },
  // Create Account — In-page sections
  { href: '/uniadmin/create-account#form', label: 'Student Name', desc: 'Register student full name', icon: User, category: 'Create Account' },
  { href: '/uniadmin/create-account#form', label: 'Student ID', desc: 'Set student roll/ID number', icon: Hash, category: 'Create Account' },
  { href: '/uniadmin/create-account#form', label: 'Student Email', desc: 'Set student email address', icon: Mail, category: 'Create Account' },
  { href: '/uniadmin/create-account#form', label: 'Temporary Password', desc: 'Set initial login password', icon: Lock, category: 'Create Account' },
  // Admin Profile — In-page sections
  { href: '/uniadmin/profile#account-details', label: 'Admin Email', desc: 'Admin account email', icon: Mail, category: 'Admin Profile' },
  { href: '/uniadmin/profile#account-details', label: 'University ID', desc: 'University identifier', icon: Hash, category: 'Admin Profile' },
  { href: '/uniadmin/profile#account-details', label: 'Admin Name', desc: 'Full name setting', icon: User, category: 'Admin Profile' },
  { href: '/uniadmin/profile#account-details', label: 'Admin Phone', desc: 'Contact phone number', icon: Phone, category: 'Admin Profile' },
  // Actions
  { href: '/uniadmin/create-test', label: 'New Assessment', desc: 'Upload a new test PDF', icon: Upload, category: 'Actions' },
  { href: '/uniadmin/create-event', label: 'Schedule Event', desc: 'Add a new event or deadline', icon: CalendarPlus, category: 'Actions' },
  { href: '/uniadmin/create-account', label: 'Add Student', desc: 'Register a new student', icon: UserPlus, category: 'Actions' },
  { href: '/uniadmin/create-test', label: 'Review Submissions', desc: 'Grade & review test results', icon: FileText, category: 'Actions' },
  { href: '/uniadmin/student-database', label: 'Search Students', desc: 'Find student by name or ID', icon: Search, category: 'Actions' },
  { href: '/uniadmin/proctoring', label: 'Monitor Exams', desc: 'Live proctoring dashboard', icon: ShieldCheck, category: 'Actions' },
];

const superadminSearchItems: SearchableItem[] = [
  // Pages
  { href: '/superadmin/dashboard', label: 'Dashboard', desc: 'System-wide overview', icon: LayoutDashboard, category: 'Pages' },
  { href: '/superadmin/universities', label: 'Universities', desc: 'Register & verify universities', icon: Building2, category: 'Pages' },
  { href: '/superadmin/manage-students', label: 'Manage Students', desc: 'View & edit all students', icon: Users, category: 'Pages' },
  { href: '/superadmin/create-uniadmin', label: 'Create Uni Admin', desc: 'Add university admin', icon: UserPlus, category: 'Pages' },
  { href: '/superadmin/manage-uniadmins', label: 'Manage Uni Admins', desc: 'View & manage all admins', icon: ShieldCheck, category: 'Pages' },
  // Dashboard — In-page sections
  { href: '/superadmin/dashboard#stats', label: 'Total Universities', desc: 'Count of registered universities', icon: Building2, category: 'Dashboard' },
  { href: '/superadmin/dashboard#stats', label: 'Uni Admins Count', desc: 'Total university administrators', icon: ShieldCheck, category: 'Dashboard' },
  { href: '/superadmin/dashboard#stats', label: 'Total Students', desc: 'System-wide student count', icon: User, category: 'Dashboard' },
  // Create Admin — In-page sections
  { href: '/superadmin/create-uniadmin#form', label: 'Admin Name', desc: 'Set admin full name', icon: User, category: 'Create Admin' },
  { href: '/superadmin/create-uniadmin#form', label: 'Admin Email', desc: 'Set admin email address', icon: Mail, category: 'Create Admin' },
  { href: '/superadmin/create-uniadmin#form', label: 'University Name', desc: 'Assign university', icon: Building2, category: 'Create Admin' },
  { href: '/superadmin/create-uniadmin#form', label: 'University ID', desc: 'Set university identifier', icon: Hash, category: 'Create Admin' },
  // Manage Admins — In-page sections
  { href: '/superadmin/manage-uniadmins#admin-list', label: 'Admin Cards', desc: 'View admin details & actions', icon: ShieldCheck, category: 'Manage Admins' },
  // Actions
  { href: '/superadmin/manage-students', label: 'Review Students', desc: 'Assign students to universities', icon: Users, category: 'Actions' },
  { href: '/superadmin/create-uniadmin', label: 'Add New Admin', desc: 'Register a university admin', icon: UserPlus, category: 'Actions' },
  { href: '/superadmin/manage-uniadmins', label: 'Review Admins', desc: 'Edit or remove university admins', icon: ShieldCheck, category: 'Actions' },
];



export default function Navbar() {
  const { role, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const navLinks = useMemo(() => {
    if (role === 'super_admin') return superadminNavLinks;
    if (role === 'university_admin') return uniadminNavLinks;
    return userNavLinks;
  }, [role]);

  const searchablePages = useMemo(() => {
    if (role === 'super_admin') return superadminSearchItems;
    if (role === 'university_admin') return uniadminSearchItems;
    return userSearchItems;
  }, [role]);

  const filteredPages = useMemo(() => {
    if (!searchQuery.trim()) {
      return searchablePages.filter(p => p.category === 'Pages');
    }
    const q = searchQuery.toLowerCase();
    return searchablePages.filter(p =>
      p.label.toLowerCase().includes(q) ||
      p.desc.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  }, [searchQuery, searchablePages]);

  const groupedResults = useMemo(() => {
    const groups: { category: string; items: typeof filteredPages }[] = [];
    const seen = new Map<string, typeof filteredPages>();
    for (const item of filteredPages) {
      if (!seen.has(item.category)) {
        seen.set(item.category, []);
        groups.push({ category: item.category, items: seen.get(item.category)! });
      }
      seen.get(item.category)!.push(item);
    }
    return groups;
  }, [filteredPages]);


  // Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdkOpen(prev => !prev);
        setSearchQuery('');
        setSelectedIndex(0);
      }
      if (e.key === 'Escape') setCmdkOpen(false);
    };
    const handleOpenCmdk = () => {
      setCmdkOpen(true);
      setSearchQuery('');
      setSelectedIndex(0);
    };
    const handleToggleMobileNav = () => setMobileOpen(prev => !prev);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('open-cmdk', handleOpenCmdk);
    document.addEventListener('toggle-mobile-nav', handleToggleMobileNav);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('open-cmdk', handleOpenCmdk);
      document.removeEventListener('toggle-mobile-nav', handleToggleMobileNav);
    };
  }, []);

  useEffect(() => {
    if (cmdkOpen) setTimeout(() => searchInputRef.current?.focus(), 50);
  }, [cmdkOpen]);

  // Warm up role-specific pages so sidebar navigation feels instant after login.
  useEffect(() => {
    navLinks.forEach((link) => router.prefetch(link.href));
  }, [navLinks, router]);

  const handleCmdkNavigate = useCallback((href: string) => {
    const [path, hash] = href.split('#');
    const isCurrentPage = pathname === path;
    setCmdkOpen(false);
    setSearchQuery('');

    if (hash) {
      if (isCurrentPage) {
        const el = document.getElementById(hash);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-2', 'ring-[#00A8E1]/40', 'rounded');
          setTimeout(() => el.classList.remove('ring-2', 'ring-[#00A8E1]/40', 'rounded'), 2000);
        }
      } else {
        router.push(path);
        // Wait for page to render, then scroll
        const scrollToHash = () => {
          const el = document.getElementById(hash);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('ring-2', 'ring-[#00A8E1]/40', 'rounded');
            setTimeout(() => el.classList.remove('ring-2', 'ring-[#00A8E1]/40', 'rounded'), 2000);
          }
        };
        // Retry a few times since the page content may load async
        setTimeout(scrollToHash, 300);
        setTimeout(scrollToHash, 800);
        setTimeout(scrollToHash, 1500);
      }
    } else {
      router.push(href);
    }
  }, [router, pathname]);

  const handleCmdkKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % filteredPages.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredPages.length) % filteredPages.length);
    } else if (e.key === 'Enter' && filteredPages[selectedIndex]) {
      handleCmdkNavigate(filteredPages[selectedIndex].href);
    }
  };

  const handleLogout = async () => {
    try { await logout(); router.push('/'); } catch {}
  };

  // Mark only the most specific matching link active so a parent route
  // (e.g. /user/resume) doesn't also highlight when on a child
  // (/user/resume/download).
  const activeHref = useMemo(() => {
    const matches = navLinks.filter(l => pathname === l.href || pathname?.startsWith(l.href + '/'));
    return matches.sort((a, b) => b.href.length - a.href.length)[0]?.href;
  }, [navLinks, pathname]);
  const isActive = (href: string) => href === activeHref;

  // Shared nav link renderer — eliminates duplication between desktop & mobile
  const renderNavLinks = (isCollapsed: boolean, closeOnNavigate = false) => {
    let lastGroup = '';
    let isFirst = true;
    return navLinks.map((link) => {
      const showHeader = link.group && link.group !== lastGroup;
      const isFirstGroup = showHeader && isFirst;
      if (showHeader) isFirst = false;
      if (link.group) lastGroup = link.group;
      return (
        <React.Fragment key={link.href}>
          {showHeader && !isCollapsed && (
            <p className={`px-2.5 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)] ${isFirstGroup ? 'pt-1' : 'pt-4'}`}>
              {link.group}
            </p>
          )}
          {showHeader && isCollapsed && !isFirstGroup && <div className="my-2 mx-2 border-t border-[var(--border-subtle)]" />}
          <Link
            href={link.href}
            onClick={closeOnNavigate ? () => setMobileOpen(false) : undefined}
            title={isCollapsed ? link.label : undefined}
            aria-current={isActive(link.href) ? 'page' : undefined}
            className={`group/nav flex items-center gap-2.5 rounded-[10px] text-[13px] font-medium transition-colors duration-150 ${isCollapsed ? 'justify-center p-2.5' : 'px-2.5 py-2.5'} ${
              isActive(link.href)
                ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
            }`}
          >
            <link.icon size={17} className={`shrink-0 transition-colors duration-150 ${isActive(link.href) ? 'text-[var(--accent-orange)]' : 'text-[var(--text-muted)] group-hover/nav:text-[var(--text-secondary)]'}`} />
            {!isCollapsed && <span className="truncate">{link.label}</span>}
          </Link>
        </React.Fragment>
      );
    });
  };

  return (
    <>
      {/* ═══ Desktop Sidebar (hidden on mobile) ═══ */}
      <aside className={`hidden md:flex h-screen bg-transparent flex-col transition-all duration-200 ease-out shrink-0 sticky top-0 ${collapsed ? 'w-[72px]' : 'w-[240px]'}`}>
        {/* Logo + collapse control */}
        <div className={`h-14 flex items-center shrink-0 ${collapsed ? 'justify-center' : 'justify-between pr-2'}`}>
          {!collapsed && (
            <Link
              href="/"
              className="flex items-center gap-1 overflow-hidden rounded-md transition-colors duration-150 ml-2 px-2 py-1.5 min-w-0"
            >
              <Image src="/logo.png" alt="Uniship" width={64} height={64} priority className="shrink-0 object-contain" />
              <span className="text-[15px] font-bold tracking-[0.12em] text-[var(--text-primary)] whitespace-nowrap self-center leading-none pt-[0.3em]">UNISHIP</span>
            </Link>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-2 rounded-[8px] text-[var(--text-faint)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors duration-150 shrink-0"
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-2">
          {renderNavLinks(collapsed)}
        </nav>

        {/* Logout — bottom of sidebar */}
        <div className="px-2 py-3 shrink-0">
          <button
            onClick={handleLogout}
            title={collapsed ? 'Logout' : undefined}
            className={`flex items-center gap-2.5 rounded-[8px] text-[13px] font-medium transition-colors duration-150 w-full text-[var(--text-tertiary)] hover:text-[var(--status-danger)] hover:bg-[var(--status-danger)]/10 ${collapsed ? 'justify-center p-2' : 'px-2.5 py-[7px]'}`}
          >
            <LogOut size={16} className="shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* ═══ Mobile Sidebar Overlay ═══ */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-[280px] bg-[var(--bg-primary)] border-r border-[var(--border-subtle)] flex flex-col animate-slide-in-left">
            {/* Logo + Close */}
            <div className="h-16 flex items-center justify-between border-b border-[var(--border-subtle)] px-3 shrink-0">
              <Link href="/" className="flex items-center gap-1">
                <Image src="/logo.png" alt="Uniship" width={76} height={76} priority className="shrink-0 object-contain" />
                <span className="text-[17px] font-bold tracking-[0.14em] text-[var(--text-primary)] whitespace-nowrap self-center leading-none pt-[0.35em]">UNISHIP</span>
              </Link>
              <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-2 py-2">
              {renderNavLinks(false, true)}
            </nav>

            {/* Logout */}
            <div className="border-t border-[var(--border-subtle)] px-2 py-2 shrink-0">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2.5 rounded text-[13px] font-medium transition-all duration-150 w-full text-[var(--text-tertiary)] hover:text-[#DC2626] hover:bg-[#DC2626]/10 border border-transparent px-2.5 py-[7px]"
              >
                <LogOut size={16} className="shrink-0" />
                <span>Logout</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ═══ Command-K Modal ═══ */}
      {cmdkOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh]">
          <div className="absolute inset-0 cmdk-overlay" onClick={() => setCmdkOpen(false)} />
          <div className="relative w-full max-w-[600px] mx-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[14px] shadow-2xl shadow-black/50 overflow-hidden animate-fade-in">
            <div className="flex items-center gap-3 px-5 sm:px-6 h-14 border-b border-[var(--border-subtle)] focus-within:bg-[var(--bg-elevated)]/35 transition-colors">
              <Search size={17} className="text-[var(--text-muted)] shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search pages, actions, or type what you need..."
                style={{ outline: 'none', boxShadow: 'none', border: 'none', background: 'transparent' }}
                className="h-full min-w-0 flex-1 px-1 bg-transparent text-[14px] leading-none text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none border-none focus-visible:outline-none"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                onKeyDown={handleCmdkKeyDown}
              />
              <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[10px] text-[var(--text-faint)] font-mono shrink-0">ESC</kbd>
            </div>
            <div className="max-h-[360px] overflow-y-auto py-1">
              {filteredPages.length === 0 ? (
                <p className="px-4 py-8 text-center text-[13px] text-[var(--text-faint)]">No results found.</p>
              ) : (
                <div className="px-1.5">
                  {groupedResults.map((group) => (
                    <div key={group.category}>
                      <p className="px-2.5 pt-3 pb-1 text-[10px] font-semibold text-[var(--text-faint)] uppercase tracking-[0.07em]">{group.category}</p>
                      {group.items.map((page) => {
                        const globalIndex = filteredPages.indexOf(page);
                        return (
                          <button
                            key={`${page.category}-${page.label}`}
                            onClick={() => handleCmdkNavigate(page.href)}
                            className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-[8px] text-left transition-colors duration-100 ${
                              globalIndex === selectedIndex
                                ? 'bg-[var(--accent-orange)]/10 text-[var(--text-primary)]'
                                : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
                            }`}
                          >
                            <page.icon size={16} className={globalIndex === selectedIndex ? 'text-[var(--accent-orange)]' : 'text-[var(--text-muted)]'} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-medium truncate">{page.label}</p>
                              <p className="text-[11px] text-[var(--text-faint)] truncate">{page.desc}</p>
                            </div>
                            {globalIndex === selectedIndex && <span className="text-[11px] text-[var(--text-faint)]">↵</span>}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="h-8 border-t border-[var(--border-subtle)] flex items-center px-3 gap-3 text-[10px] text-[var(--text-faint)]">
              <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] font-mono">↑↓</kbd> navigate</span>
              <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] font-mono">↵</kbd> open</span>
              <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] font-mono">esc</kbd> close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
