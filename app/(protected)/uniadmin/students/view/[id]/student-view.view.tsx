'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, limit, query, updateDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { calculateATSScore } from '@/app/(protected)/user/resume/ats-score';
import Link from 'next/link';
import { DetailSkeleton } from '@/components/Skeleton';
import AlertCircle from '@/components/icons/AlertCircle';
import ArrowLeft from '@/components/icons/ArrowLeft';
import Award from '@/components/icons/Award';
import BadgeCheck from '@/components/icons/BadgeCheck';
import Briefcase from '@/components/icons/Briefcase';
import ClipboardCheck from '@/components/icons/ClipboardCheck';
import Clock3 from '@/components/icons/Clock3';
import Code from '@/components/icons/Code';
import FileText from '@/components/icons/FileText';
import FolderKanban from '@/components/icons/FolderKanban';
import GraduationCap from '@/components/icons/GraduationCap';
import Mail from '@/components/icons/Mail';
import MapPin from '@/components/icons/MapPin';
import TrendingUp from '@/components/icons/TrendingUp';
import BookOpen from '@/components/icons/BookOpen';
import Star from '@/components/icons/Star';
import Trophy from '@/components/icons/Trophy';
import CheckCircle2 from '@/components/icons/CheckCircle2';
import XCircle from '@/components/icons/XCircle';
import { StatBar } from '@/components/StatBar';
import { Modal, ModalHeader, ModalBody } from '@/components/Modal';

interface EducationEntry {
  institution: string;
  degree: string;
  fromDate: string;
  toDate: string;
  cgpa: string;
  location: string;
}

interface ExperienceEntry {
  company: string;
  role: string;
  fromDate: string;
  toDate: string;
  description: string;
  location: string;
}

interface ProjectEntry {
  title: string;
  techStack: string;
  description: string;
  link: string;
  fromDate: string;
  toDate: string;
  location: string;
}

interface AchievementEntry {
  title: string;
  issuer: string;
  fromDate: string;
  toDate: string;
  location: string;
}

interface PositionEntry {
  title: string;
  organization: string;
  fromDate: string;
  toDate: string;
  location: string;
}

interface ExtracurricularEntry {
  activity: string;
  role: string;
  description: string;
  fromDate: string;
  toDate: string;
  location: string;
}

interface StudentData {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  photoURL?: string;
  title?: string;
  bio?: string;
  rollNumber?: string;
  studentId?: string;
  technicalSkills?: string;
  relevantCoursework?: string;
  educationEntries?: EducationEntry[];
  experienceEntries?: ExperienceEntry[];
  projectEntries?: ProjectEntry[];
  achievementEntries?: AchievementEntry[];
  positionEntries?: PositionEntry[];
  extracurricularEntries?: ExtracurricularEntry[];
  profileReviewStatus?: 'verified' | 'resubmission_requested';
  profileReviewNote?: string;
  profileReviewedAt?: unknown;
  profileReviewedBy?: string;
}

interface ApplicationItem {
  id: string;
  internshipRole?: string;
  companyName?: string;
  status?: 'pending' | 'shortlisted' | 'selected' | 'rejected';
  appliedAt?: unknown;
}

interface ResultSection {
  sectionName?: string;
  name?: string;
  percentage?: number;
  totalQuestions?: number;
  score?: number;
}

interface ResultItem {
  id: string;
  testTitle?: string;
  score?: number;
  attemptedQuestions?: number;
  totalQuestions?: number;
  percentage?: number;
  submittedAt?: unknown;
  sectionResults?: ResultSection[];
  sections?: ResultSection[];
  proctoring?: {
    totalViolations?: number;
    violationPoints?: number;
  };
  answers?: Record<string, string>;
  questionSnapshots?: Array<{
    questionDescription?: string;
    sectionType?: string;
    sectionTitle?: string;
    options?: string[] | null;
    correctAnswer?: string | null;
    sampleTestCases?: Array<{ input?: string; output?: string }> | null;
    studentAnswer?: string;
    difficulty?: string | null;
  }>;
}

interface ResumeItem {
  id: string;
  targetCompany?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  website?: string;
  github?: string;
  linkedin?: string;
  userEmail?: string;
  uploadedFileUrl?: string;
  uploadedFileName?: string;
  uploadedFileType?: string;
  updatedAt?: unknown;
  keywords?: string[];
  education?: string;
  experience?: string;
  skills?: string;
  projects?: string;
  coursework?: string;
  extracurriculars?: string;
  achievements?: string;
}

type TabId = 'placements' | 'applications' | 'academic' | 'profile' | 'resumes' | 'analysis';

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'placements', label: 'Placements' },
  { id: 'applications', label: 'Applications' },
  { id: 'academic', label: 'Academic Details' },
  { id: 'profile', label: 'Profile' },
  { id: 'resumes', label: 'Resumes' },
  { id: 'analysis', label: 'Analysis' },
];

function formatDateRange(from: string, to: string): string {
  if (from && to) return `${from} - ${to}`;
  if (from) return `${from} - Present`;
  return '';
}

function toDateLabel(value: unknown): string {
  if (!value) return 'N/A';
  const timestampDate = (value as { toDate?: () => Date }).toDate?.();
  if (timestampDate) return timestampDate.toLocaleDateString();
  const d = new Date(value as string | number | Date);
  return Number.isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString();
}

function toMillis(value: unknown): number {
  return (value as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0;
}

function safePercentage(result: ResultItem): number {
  if (typeof result.percentage === 'number') return result.percentage;
  const score = typeof result.score === 'number' ? result.score : (result.attemptedQuestions || 0);
  const total = result.totalQuestions || 0;
  return total > 0 ? (score / total) * 100 : 0;
}

function getResultSections(result: ResultItem): Array<{ name: string; percentage: number }> {
  const sectionSource = result.sectionResults || result.sections || [];
  if (!Array.isArray(sectionSource)) return [];

  return sectionSource
    .map((section) => {
      const name = section.sectionName || section.name || 'Section';
      const percentage = typeof section.percentage === 'number'
        ? section.percentage
        : ((section.totalQuestions || 0) > 0 ? ((section.score || 0) / (section.totalQuestions || 1)) * 100 : 0);

      return { name, percentage };
    })
    .filter((section: { name: string; percentage: number }) => Number.isFinite(section.percentage));
}

function SectionHeader({ icon: Icon, title }: { icon: React.ComponentType<{ size?: number; className?: string }>; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3 mt-5 first:mt-0">
      <Icon size={15} className="text-[var(--type-event)]" />
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.07em] text-[var(--text-primary)]">{title}</h2>
    </div>
  );
}

function ResumeSectionTitle({ title }: { title: string }) {
  return (
    <div className="mt-4 mb-1">
      <h2 className="text-[12px] font-semibold tracking-[0.07em] uppercase" style={{ fontVariant: 'small-caps' }}>{title}</h2>
      <hr className="border-t border-black mt-0.5" />
    </div>
  );
}

function AdminResumePreview({ data }: { data: ResumeItem }) {
  const hasContent = (val?: string) => !!val && val.trim().length > 0;

  const boldMarkdown = (text: string) => text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  const renderBullets = (text: string) => {
    const lines = text.split('\n').filter((l) => l.trim().length > 0);
    return (
      <ul className="list-none mt-1 space-y-0.5">
        {lines.map((line, i) => (
          <li key={i} className="flex gap-2 text-[11px] leading-snug">
            <span className="mt-[2px] shrink-0">•</span>
            <span dangerouslySetInnerHTML={{ __html: boldMarkdown(line.replace(/^[-•]\s*/, '')) }} />
          </li>
        ))}
      </ul>
    );
  };

  const parseEducation = (raw?: string) => {
    if (!hasContent(raw)) return null;
    return raw!.split(/\n\n+/).map((block, i) => {
      const lines = block.split('\n').filter((l) => l.trim());
      const parts = (lines[0] || '').split('|').map((p) => p.trim());
      const bullets = lines.slice(2);
      return (
        <div key={i} className="mb-2">
          <div className="flex justify-between items-baseline">
            <span className="font-semibold text-[11.5px]" dangerouslySetInnerHTML={{ __html: boldMarkdown(parts[0] || '') }} />
            <span className="text-[10.5px]">{parts[1]}</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="italic text-[10.5px]" dangerouslySetInnerHTML={{ __html: boldMarkdown(lines[1] || '') }} />
            <span className="text-[10.5px]">{parts[2]}</span>
          </div>
          {bullets.length > 0 && renderBullets(bullets.join('\n'))}
        </div>
      );
    });
  };

  const parseExperience = (raw?: string) => {
    if (!hasContent(raw)) return null;
    return raw!.split(/\n\n+/).map((block, i) => {
      const lines = block.split('\n').filter((l) => l.trim());
      const dateParts = (lines[0] || '').split('|').map((p) => p.trim());
      const orgParts = (lines[1] || '').split('|').map((p) => p.trim());
      const bullets = lines.slice(2);
      return (
        <div key={i} className="mb-3">
          <div className="flex justify-between items-baseline">
            <span className="font-semibold text-[11.5px]" dangerouslySetInnerHTML={{ __html: boldMarkdown(dateParts[0] || '') }} />
            <span className="text-[10.5px]">{dateParts[1]}</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="italic text-[10.5px]" dangerouslySetInnerHTML={{ __html: boldMarkdown(orgParts[0] || '') }} />
            {orgParts[1] && <span className="text-[10.5px]">{orgParts[1]}</span>}
          </div>
          {bullets.length > 0 && renderBullets(bullets.join('\n'))}
        </div>
      );
    });
  };

  const parseProjects = (raw?: string) => {
    if (!hasContent(raw)) return null;
    return raw!.split(/\n\n+/).map((block, i) => {
      const lines = block.split('\n').filter((l) => l.trim());
      const parts = (lines[0] || '').split('|').map((p) => p.trim());
      const bullets = lines.slice(1);
      return (
        <div key={i} className="mb-3">
          <div className="flex justify-between items-baseline">
            <span>
              <span className="font-semibold text-[11.5px]" dangerouslySetInnerHTML={{ __html: boldMarkdown(parts[0] || '') }} />
              {parts[1] && (
                <span className="text-[10.5px] italic" dangerouslySetInnerHTML={{ __html: ` | ${boldMarkdown(parts[1])}` }} />
              )}
            </span>
            <span className="text-[10.5px]">{parts[2]}</span>
          </div>
          {bullets.length > 0 && renderBullets(bullets.join('\n'))}
        </div>
      );
    });
  };

  const parseExtracurriculars = (raw?: string) => {
    if (!hasContent(raw)) return null;
    return raw!.split(/\n+/).filter((l) => l.trim()).map((line, i) => {
      const parts = line.split('|').map((p) => p.trim());
      return (
        <div key={i} className="flex justify-between items-baseline mb-1">
          <span className="font-semibold text-[11px]">{parts[0]}{parts[1] ? ` | ${parts[1]}` : ''}</span>
          <span className="text-[10.5px]">{parts[2]}</span>
        </div>
      );
    });
  };

  const parseAchievements = (raw?: string) => {
    if (!hasContent(raw)) return null;
    return raw!.split(/\n+/).filter((l) => l.trim()).map((line, i) => {
      const pipeIdx = line.lastIndexOf('|');
      const desc = pipeIdx > -1 ? line.slice(0, pipeIdx).trim() : line.trim();
      const date = pipeIdx > -1 ? line.slice(pipeIdx + 1).trim() : '';
      const dashIdx = desc.indexOf('–');
      const title = dashIdx > -1 ? desc.slice(0, dashIdx).trim() : desc;
      const sub = dashIdx > -1 ? desc.slice(dashIdx + 1).trim() : '';
      return (
        <div key={i} className="flex justify-between items-baseline mb-1">
          <span className="text-[11px]">
            <span className="font-semibold underline">{title}</span>
            {sub && <span> – {sub}</span>}
          </span>
          <span className="text-[10.5px]">{date}</span>
        </div>
      );
    });
  };

  const renderSkills = (raw?: string) => (
    <div className="text-[11px] leading-relaxed space-y-0.5">
      {(raw || '').split('\n').filter((l) => l.trim()).map((line, i) => {
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <div key={i}>
            {parts.map((part, j) =>
              part.startsWith('**') && part.endsWith('**')
                ? <strong key={j}>{part.slice(2, -2)}</strong>
                : <span key={j}>{part}</span>
            )}
          </div>
        );
      })}
    </div>
  );

  const contactItems = [
    data.website,
    data.email || data.userEmail,
    data.phone,
    data.linkedin ? data.linkedin.replace('https://', '') : '',
    data.github ? data.github.replace('https://', '') : '',
  ].filter(Boolean);

  return (
    <div className="bg-white text-black font-serif mx-auto" style={{ width: '210mm', minHeight: '297mm', padding: '18mm', fontSize: '11px', lineHeight: '1.4', boxSizing: 'border-box' }}>
      <div className="text-center mb-1">
        <h1 className="text-[28px] font-bold tracking-tight leading-tight">{data.fullName || 'Student Resume'}</h1>
      </div>

      {contactItems.length > 0 && (
        <div className="text-center text-[10.5px] mb-2 flex flex-wrap justify-center gap-x-1">
          {contactItems.map((item, i) => (
            <span key={i}>
              {i > 0 && <span className="mx-1">|</span>}
              {item}
            </span>
          ))}
        </div>
      )}

      {hasContent(data.education) && <><ResumeSectionTitle title="Education" />{parseEducation(data.education)}</>}
      {hasContent(data.experience) && <><ResumeSectionTitle title="Experience" />{parseExperience(data.experience)}</>}
      {hasContent(data.projects) && <><ResumeSectionTitle title="Projects" />{parseProjects(data.projects)}</>}
      {hasContent(data.coursework) && <><ResumeSectionTitle title="Relevant Coursework" /><p className="text-[11px] leading-relaxed">{data.coursework}</p></>}
      {hasContent(data.skills) && <><ResumeSectionTitle title="Technical Skills" />{renderSkills(data.skills)}</>}
      {hasContent(data.extracurriculars) && <><ResumeSectionTitle title="Extracurriculars / Activities" />{parseExtracurriculars(data.extracurriculars)}</>}
      {hasContent(data.achievements) && <><ResumeSectionTitle title="Achievements & Certifications" />{parseAchievements(data.achievements)}</>}

      {!hasContent(data.education) && !hasContent(data.experience) && !hasContent(data.projects) && !hasContent(data.coursework) && !hasContent(data.skills) && !hasContent(data.extracurriculars) && !hasContent(data.achievements) && (
        <p className="text-[12px] text-[#666]">No structured resume fields are available for this record.</p>
      )}
    </div>
  );
}

export default function StudentViewPage({ studentId }: { studentId?: string }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = studentId ?? params?.id;
  // Embedded (in-page, inside the Students tab) vs standalone route.
  const embedded = !!studentId;

  const [student, setStudent] = useState<StudentData | null>(null);
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [resumes, setResumes] = useState<ResumeItem[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>('placements');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [resumePreview, setResumePreview] = useState<ResumeItem | null>(null);
  const [answerReviewResult, setAnswerReviewResult] = useState<ResultItem | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  useEffect(() => {
    async function fetchWorkspace() {
      if (!id) return;
      try {
        const studentSnap = await getDoc(doc(db, 'users', id));
        if (!studentSnap.exists()) return;

        const studentData = { id: studentSnap.id, ...studentSnap.data() } as StudentData;
        setStudent(studentData);

        const [applicationSnap, modernResultsSnap, legacyResultsSnap, resumesSnap] = await Promise.all([
          getDocs(query(collection(db, 'applications'), where('userId', '==', id), limit(200))).catch(() => null),
          getDocs(query(collection(db, 'test_results'), where('userId', '==', id), limit(200))).catch(() => null),
          getDocs(query(collection(db, 'testResults'), where('userId', '==', id), limit(200))).catch(() => null),
          studentData.email
            ? getDocs(query(collection(db, 'resumes'), where('userEmail', '==', studentData.email), limit(50))).catch(() => null)
            : Promise.resolve(null),
        ]);

        const appRows = (applicationSnap?.docs ?? []).map((d) => ({ id: d.id, ...d.data() } as ApplicationItem));
        appRows.sort((a: ApplicationItem, b: ApplicationItem) => {
          const at = toMillis(a.appliedAt);
          const bt = toMillis(b.appliedAt);
          return bt - at;
        });
        setApplications(appRows);

        const resultRows = [
          ...(modernResultsSnap?.docs ?? []).map((d) => ({ id: `modern-${d.id}`, ...d.data() } as ResultItem)),
          ...(legacyResultsSnap?.docs ?? []).map((d) => ({ id: `legacy-${d.id}`, ...d.data() } as ResultItem)),
        ];
        resultRows.sort((a: ResultItem, b: ResultItem) => {
          const at = toMillis(a.submittedAt);
          const bt = toMillis(b.submittedAt);
          return bt - at;
        });
        setResults(resultRows);

        const resumeRows = (resumesSnap?.docs ?? []).map((d) => ({ id: d.id, ...d.data() } as ResumeItem));
        resumeRows.sort((a: ResumeItem, b: ResumeItem) => {
          const at = toMillis(a.updatedAt);
          const bt = toMillis(b.updatedAt);
          return bt - at;
        });
        setResumes(resumeRows);
      } catch (error) {
        console.error('Error fetching student workspace:', error);
      } finally {
        setFetching(false);
      }
    }

    fetchWorkspace();
  }, [id]);

  const handleReview = async (status: 'verified' | 'resubmission_requested') => {
    if (!student || !id || !user) return;

    const note = status === 'resubmission_requested'
      ? window.prompt('Add a resubmission reason (required):', '')
      : window.prompt('Optional verification note:', '') || '';

    if (status === 'resubmission_requested' && !note?.trim()) {
      setNotice({ type: 'error', message: 'Resubmission reason is required.' });
      return;
    }

    setReviewing(true);
    try {
      const payload = {
        profileReviewStatus: status,
        profileReviewNote: note?.trim() || '',
        profileReviewedAt: new Date().toISOString(),
        profileReviewedBy: user.email || user.uid,
      };

      await updateDoc(doc(db, 'users', id), payload);
      setStudent((prev) => (prev ? { ...prev, ...payload } : prev));
      setNotice({ type: 'success', message: status === 'verified' ? 'Profile marked as verified.' : 'Resubmission requested.' });
    } catch (error) {
      console.error('Failed to update review status:', error);
      setNotice({ type: 'error', message: 'Unable to update review status. Check Firestore rules for uni-admin updates.' });
    } finally {
      setReviewing(false);
    }
  };

  if (loading || fetching) {
    return <DetailSkeleton />;
  }

  if (!student) {
    return (
      <div className={embedded ? 'animate-fade-in' : 'max-w-[1200px] mx-auto animate-fade-in pt-8'}>
        <div className="text-center py-16 border border-[var(--border-subtle)] rounded-[var(--radius)] bg-[var(--bg-surface)]">
          <p className="text-[var(--text-primary)] text-[13px] font-medium">Student not found.</p>
        </div>
      </div>
    );
  }

  const eduEntries = student.educationEntries?.length ? student.educationEntries : null;
  const expEntries = student.experienceEntries?.length ? student.experienceEntries : null;
  const projEntries = student.projectEntries?.length ? student.projectEntries : null;
  const achEntries = student.achievementEntries?.length ? student.achievementEntries : null;
  const posEntries = student.positionEntries?.length ? student.positionEntries : null;
  const extraEntries = student.extracurricularEntries?.length ? student.extracurricularEntries : null;

  const cgpa = eduEntries?.[0]?.cgpa || 'N/A';

  const applicationsCount = applications.length;
  const shortlistedCount = applications.filter((a) => a.status === 'shortlisted').length;
  const offersCount = applications.filter((a) => a.status === 'selected').length;
  const scoreSeries = [...results].reverse().map((item) => safePercentage(item));
  const avgScore = results.length > 0
    ? scoreSeries.reduce((sum, value) => sum + value, 0) / scoreSeries.length
    : 0;
  const avgViolationPoints = results.length > 0
    ? results.reduce((sum, item) => sum + (item.proctoring?.violationPoints || 0), 0) / results.length
    : 0;
  const reliability = Math.max(0, Math.round(100 - avgViolationPoints * 10));
  const latestScore = scoreSeries.length ? scoreSeries[scoreSeries.length - 1] : 0;
  const baselineScore = scoreSeries.length ? scoreSeries[0] : 0;
  const scoreDelta = latestScore - baselineScore;
  const totalViolations = results.reduce((sum, item) => sum + (item.proctoring?.totalViolations || 0), 0);
  const testsAbove70 = scoreSeries.filter((value) => value >= 70).length;
  const consistency = scoreSeries.length > 0 ? Math.round((testsAbove70 / scoreSeries.length) * 100) : 0;

  const getResumeAts = (resume: ResumeItem): number => {
    const breakdown = calculateATSScore({
      fullName: resume.fullName || student.name || '',
      phone: resume.phone || student.phone || '',
      email: resume.email || resume.userEmail || student.email || '',
      website: resume.website || '',
      github: resume.github || '',
      linkedin: resume.linkedin || '',
      education: resume.education || '',
      experience: resume.experience || '',
      skills: resume.skills || '',
      projects: resume.projects || '',
      coursework: resume.coursework || '',
      extracurriculars: resume.extracurriculars || '',
      achievements: resume.achievements || '',
    }, resume.keywords || []);
    return breakdown.total;
  };

  const sectionBuckets: Record<string, { sum: number; count: number }> = {};
  results.forEach((result) => {
    getResultSections(result).forEach((section) => {
      if (!sectionBuckets[section.name]) sectionBuckets[section.name] = { sum: 0, count: 0 };
      sectionBuckets[section.name].sum += section.percentage;
      sectionBuckets[section.name].count += 1;
    });
  });

  const sectionAverages = Object.entries(sectionBuckets)
    .map(([name, bucket]) => ({
      name,
      average: bucket.count > 0 ? bucket.sum / bucket.count : 0,
      attempts: bucket.count,
    }))
    .sort((a, b) => b.average - a.average);

  return (
    <div className={embedded ? 'animate-fade-in' : 'max-w-[1200px] mx-auto animate-fade-in pt-8'}>
      {!embedded && (
        <Link href="/uniadmin/student-database" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-primary)] mb-5 transition-colors">
          <ArrowLeft size={14} /> Back to Database
        </Link>
      )}

      {notice && (
        <div className={`mb-4 p-3 rounded-[var(--radius)] border text-[13px] ${notice.type === 'success' ? 'border-[var(--status-success)]/20 bg-[var(--status-success)]/10 text-[var(--status-success)]' : 'border-[var(--status-danger)]/20 bg-[var(--status-danger)]/10 text-[var(--status-danger)]'}`}>
          {notice.message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <aside className="window p-5 lg:col-span-1 h-fit">
          <div className="flex flex-col items-center text-center">
            {student.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element -- profile photos can come from arbitrary user-configured hosts.
              <img src={student.photoURL} alt={student.name || 'Student'} className="w-24 h-24 rounded-full object-cover border-2 border-[var(--border-subtle)]" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-[var(--type-event)]/10 flex items-center justify-center text-[var(--type-event)] text-3xl font-semibold">
                {student.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
            )}
            <h1 className="text-[20px] font-semibold text-[var(--text-primary)] mt-3">{student.name || 'Unnamed'}</h1>
            <p className="text-[13px] text-[var(--text-tertiary)]">{student.title || 'Student'}</p>
            <p className="text-[12px] font-mono text-[var(--accent-orange)] mt-1">{student.rollNumber || student.studentId || 'N/A'}</p>

            <div className="w-full mt-5 grid grid-cols-3 rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] overflow-hidden divide-x divide-[var(--border-subtle)]">
              {[
                { label: 'CGPA', value: String(cgpa).match(/[\d.]+/)?.[0] ?? 'N/A' },
                { label: 'Applied', value: applicationsCount },
                { label: 'Offers', value: offersCount },
              ].map((s) => (
                <div key={s.label} className="px-2 py-3 text-center">
                  <p className="text-[18px] font-semibold text-[var(--text-primary)] tabular-nums leading-none">{s.value}</p>
                  <p className="text-[9.5px] text-[var(--text-faint)] uppercase tracking-[0.06em] mt-1.5">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="w-full mt-3 space-y-2">
              <button type="button" disabled={reviewing} onClick={() => handleReview('verified')} className="w-full btn-secondary inline-flex items-center justify-center gap-1.5 text-[12px] disabled:opacity-50">
                <BadgeCheck size={13} /> Mark Verified
              </button>
              <button type="button" disabled={reviewing} onClick={() => handleReview('resubmission_requested')} className="w-full btn-secondary inline-flex items-center justify-center gap-1.5 text-[12px] disabled:opacity-50">
                <AlertCircle size={13} /> Ask Resubmission
              </button>
            </div>
          </div>
        </aside>

        <section className="lg:col-span-3 window overflow-hidden">
          <div className="border-b border-[var(--border-subtle)] p-4">
            <div className="inline-flex flex-wrap rounded-[8px] border border-[var(--border-subtle)] overflow-hidden bg-[var(--bg-elevated)]">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-2 text-[12px] font-semibold transition-colors ${activeTab === tab.id ? 'bg-[var(--type-event)]/10 text-[var(--type-event)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-5">
            {activeTab === 'placements' && (
              <div className="rounded-[8px] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-8 text-center">
                <p className="text-[12px] text-[var(--text-faint)]">Placements section is intentionally left empty for now.</p>
                <p className="text-[11px] text-[var(--text-faint)] mt-1">Use the Applications and Analysis tabs for current student activity.</p>
              </div>
            )}

            {activeTab === 'applications' && (
              <div className="space-y-4">
                <StatBar
                  items={[
                    { label: 'applications', value: applicationsCount, icon: ClipboardCheck },
                    { label: 'pending', value: applications.filter((a) => (a.status || 'pending') === 'pending').length, icon: Clock3 },
                    { label: 'shortlisted', value: shortlistedCount, icon: Star },
                    { label: 'selected', value: offersCount, icon: BadgeCheck, accent: offersCount > 0 ? 'text-[var(--status-success)]' : undefined },
                  ]}
                />

                <SectionHeader icon={ClipboardCheck} title="All Applications" />
                {applications.length === 0 ? (
                  <p className="text-[12px] text-[var(--text-faint)]">No applications found for this student.</p>
                ) : (
                  <div className="space-y-2">
                    {applications.map((app) => {
                      const status = (app.status || 'pending').toLowerCase();
                      const statusClass =
                        status === 'selected'
                          ? 'text-[var(--status-success)] bg-[var(--status-success)]/10 border-[var(--status-success)]/20'
                          : status === 'shortlisted'
                            ? 'text-[var(--accent-orange)] bg-[var(--accent-orange)]/10 border-[var(--accent-orange)]/20'
                            : status === 'rejected'
                              ? 'text-[var(--status-danger)] bg-[var(--status-danger)]/10 border-[var(--status-danger)]/20'
                              : 'text-[var(--text-faint)] bg-[var(--bg-surface)] border-[var(--border-subtle)]';

                      return (
                        <div key={app.id} className="rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[12px] font-semibold text-[var(--text-primary)]">{app.internshipRole || 'Internship Application'}</p>
                            <p className="text-[11px] text-[var(--text-tertiary)]">{app.companyName || 'Unknown company'}</p>
                            <p className="text-[10px] text-[var(--text-faint)] mt-0.5">Applied: {toDateLabel(app.appliedAt)}</p>
                          </div>
                          <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-[0.07em] ${statusClass}`}>
                            {status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'academic' && (
              <div className="space-y-4">
                <p className="text-[12px] text-[var(--text-faint)]">Academic Details section is intentionally empty for now.</p>
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="space-y-4">
                <div className="window p-4">
                  <SectionHeader icon={FileText} title="Personal Details" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[12px]">
                    <div className="rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
                      <p className="text-[var(--text-faint)] mb-1">Full Name</p>
                      <p className="text-[var(--text-primary)] font-medium">{student.name || 'N/A'}</p>
                    </div>
                    <div className="rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
                      <p className="text-[var(--text-faint)] mb-1">Roll Number</p>
                      <p className="text-[var(--text-primary)] font-medium">{student.rollNumber || student.studentId || 'N/A'}</p>
                    </div>
                    <div className="rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
                      <p className="text-[var(--text-faint)] mb-1">Phone Number</p>
                      <p className="text-[var(--text-primary)] font-medium">{student.phone || 'N/A'}</p>
                    </div>
                    <div className="rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
                      <p className="text-[var(--text-faint)] mb-1">Contact Email</p>
                      <p className="text-[var(--text-primary)] font-medium break-all">{student.email || 'N/A'}</p>
                    </div>
                    <div className="rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
                      <p className="text-[var(--text-faint)] mb-1">Professional Title</p>
                      <p className="text-[var(--text-primary)] font-medium">{student.title || 'N/A'}</p>
                    </div>
                    <div className="rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 md:col-span-2">
                      <p className="text-[var(--text-faint)] mb-1">Bio</p>
                      <p className="text-[var(--text-primary)] whitespace-pre-line">{student.bio || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                <div className="window p-4">
                  <SectionHeader icon={Mail} title="Web Presence" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[12px]">
                    <div className="rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
                      <p className="text-[var(--text-faint)] mb-1">LinkedIn URL</p>
                      <p className="text-[var(--text-primary)] break-all">{student.linkedinUrl || 'N/A'}</p>
                    </div>
                    <div className="rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
                      <p className="text-[var(--text-faint)] mb-1">GitHub URL</p>
                      <p className="text-[var(--text-primary)] break-all">{student.githubUrl || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {(student.technicalSkills || student.relevantCoursework) && (
                  <div className="window p-4">
                    {student.technicalSkills && (
                      <>
                        <SectionHeader icon={Code} title="Technical Skills" />
                        <div className="flex flex-wrap gap-1.5">
                          {student.technicalSkills.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean).map((skill, i) => (
                            <span key={i} className="px-2.5 py-0.5 text-[11px] font-medium rounded-full bg-[var(--type-event)]/10 text-[var(--type-event)]">{skill}</span>
                          ))}
                        </div>
                      </>
                    )}
                    {student.relevantCoursework && (
                      <>
                        <SectionHeader icon={GraduationCap} title="Relevant Coursework" />
                        <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">{student.relevantCoursework}</p>
                      </>
                    )}
                  </div>
                )}

                {eduEntries && (
                  <div className="window p-4">
                    <SectionHeader icon={GraduationCap} title="Education" />
                    <div className="space-y-3">
                      {eduEntries.map((e, i) => (
                        <div key={i} className="border-l-2 border-[var(--type-event)]/30 pl-3">
                          <div className="flex justify-between items-baseline">
                            <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">{e.institution}</h3>
                            <span className="text-[11px] text-[var(--text-faint)]">{formatDateRange(e.fromDate, e.toDate)}</span>
                          </div>
                          <p className="text-[12px] text-[var(--text-muted)]">{e.degree}</p>
                          <div className="flex gap-3 mt-1">
                            {e.cgpa && <span className="text-[11px] text-[var(--status-success)] font-semibold">CGPA: {e.cgpa}</span>}
                            {e.location && <span className="flex items-center gap-1 text-[11px] text-[var(--text-faint)]"><MapPin size={10} />{e.location}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {expEntries && (
                  <div className="window p-4">
                    <SectionHeader icon={Briefcase} title="Experience" />
                    <div className="space-y-3">
                      {expEntries.map((e, i) => (
                        <div key={i} className="border-l-2 border-[var(--type-internship)]/30 pl-3">
                          <div className="flex justify-between items-baseline">
                            <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">{e.role}</h3>
                            <span className="text-[11px] text-[var(--text-faint)]">{formatDateRange(e.fromDate, e.toDate)}</span>
                          </div>
                          <p className="text-[12px] text-[var(--text-muted)]">{e.company}</p>
                          {e.description && <p className="text-[11px] text-[var(--text-tertiary)] mt-1 whitespace-pre-line">{e.description}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {projEntries && (
                  <div className="window p-4">
                    <SectionHeader icon={FolderKanban} title="Projects" />
                    <div className="space-y-3">
                      {projEntries.map((p, i) => (
                        <div key={i} className="border-l-2 border-[var(--accent-orange)]/30 pl-3">
                          <div className="flex justify-between items-baseline">
                            <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">{p.title}</h3>
                            <span className="text-[11px] text-[var(--text-faint)]">{formatDateRange(p.fromDate, p.toDate)}</span>
                          </div>
                          {p.techStack && <p className="text-[11px] text-[var(--type-event)] mt-1">{p.techStack}</p>}
                          {p.description && <p className="text-[11px] text-[var(--text-tertiary)] mt-1 whitespace-pre-line">{p.description}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {achEntries && (
                  <div className="window p-4">
                    <SectionHeader icon={Trophy} title="Achievements" />
                    <div className="space-y-2">
                      {achEntries.map((a, i) => (
                        <div key={i} className="text-[12px]">
                          <span className="font-semibold text-[var(--text-primary)]">{a.title}</span>
                          {a.issuer && <span className="text-[var(--text-muted)]"> - {a.issuer}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {posEntries && (
                  <div className="window p-4">
                    <SectionHeader icon={Star} title="Positions of Responsibility" />
                    <div className="space-y-2">
                      {posEntries.map((p, i) => (
                        <div key={i} className="text-[12px]">
                          <span className="font-semibold text-[var(--text-primary)]">{p.title}</span>
                          <span className="text-[var(--text-muted)]"> - {p.organization}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {extraEntries && (
                  <div className="window p-4">
                    <SectionHeader icon={Award} title="Extracurriculars" />
                    <div className="space-y-2">
                      {extraEntries.map((e, i) => (
                        <div key={i} className="text-[12px]">
                          <span className="font-semibold text-[var(--text-primary)]">{e.activity}</span>
                          {e.role && <span className="text-[var(--text-muted)]"> - {e.role}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'resumes' && (
              <div className="space-y-4">
                {resumes.length === 0 ? (
                  <p className="text-[12px] text-[var(--text-faint)]">No saved resumes found or access is restricted by rules.</p>
                ) : (
                  <>
                    <div>
                      <h3 className="text-[22px] font-semibold text-[var(--text-primary)]">Student Resumes</h3>
                      <p className="text-[13px] text-[var(--text-faint)] mt-1">All resumes generated by this student are listed below.</p>
                    </div>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      {resumes.map((resume) => {
                        const title = resume.targetCompany || resume.uploadedFileName || 'Generated Resume';
                        const owner = resume.fullName || student.name || 'Student';
                        const hasStructuredContent = !!(
                          resume.education || resume.experience || resume.skills || resume.projects ||
                          resume.coursework || resume.extracurriculars || resume.achievements
                        );
                        const atsScore = hasStructuredContent ? getResumeAts(resume) : null;

                        return (
                          <div key={resume.id} className="rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
                            <div className="flex items-start gap-3">
                              <div className="w-12 h-12 rounded-[10px] bg-[var(--accent-orange)]/15 flex items-center justify-center">
                                <FileText size={22} className="text-[var(--accent-orange)]" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[15px] font-semibold text-[var(--text-primary)] truncate">{title}</p>
                                <p className="text-[12px] text-[var(--text-faint)]">{toDateLabel(resume.updatedAt)}</p>
                              </div>
                            </div>

                            <p className="text-[12px] text-[var(--text-tertiary)] mt-3 truncate">
                              FOR: {resume.targetCompany || 'General'} · {owner}
                            </p>

                            {atsScore !== null && (
                              <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-[var(--type-event)]/30 bg-[var(--type-event)]/10 px-2.5 py-1">
                                <span className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--type-event)]">ATS</span>
                                <span className="text-[12px] font-semibold text-[var(--type-event)] tabular-nums">{atsScore}/100</span>
                              </div>
                            )}

                            {resume.keywords && resume.keywords.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {resume.keywords.slice(0, 8).map((keyword, i) => (
                                  <span key={`${resume.id}-${i}`} className="px-2 py-0.5 rounded-full text-[10px] border border-[var(--border-subtle)] text-[var(--text-tertiary)]">{keyword}</span>
                                ))}
                              </div>
                            )}

                            <div className="mt-3 flex gap-2">
                              {resume.uploadedFileUrl ? (
                                <a
                                  href={resume.uploadedFileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex-1 rounded-[8px] border border-[var(--border-subtle)] px-3 py-2 text-[12px] font-semibold text-center text-[var(--text-primary)] hover:border-[var(--type-event)] hover:text-[var(--type-event)] transition-colors"
                                >
                                  Open Uploaded File
                                </a>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setResumePreview(resume)}
                                  disabled={!hasStructuredContent}
                                  className="flex-1 rounded-[8px] border border-[var(--border-subtle)] px-3 py-2 text-[12px] font-semibold text-[var(--text-primary)] hover:border-[var(--type-event)] hover:text-[var(--type-event)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  View Resume
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'analysis' && (
              <div className="space-y-4">
                {results.length === 0 ? (
                  <p className="text-[12px] text-[var(--text-faint)]">No test result data available for analysis yet.</p>
                ) : (
                  <>
                    <StatBar
                      items={[
                        { label: 'tests', value: results.length, icon: ClipboardCheck },
                        { label: 'avg score', value: `${avgScore.toFixed(1)}%`, icon: TrendingUp },
                        { label: 'reliability', value: `${reliability}/100`, icon: BadgeCheck },
                        { label: 'consistency', value: `${consistency}%`, icon: Star },
                        { label: 'violations', value: totalViolations, icon: AlertCircle, accent: totalViolations > 0 ? 'text-[var(--status-danger)]' : undefined },
                      ]}
                    />

                    <div className="rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
                      <SectionHeader icon={TrendingUp} title="Performance Trend" />
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <p className="text-[11px] text-[var(--text-faint)] uppercase tracking-[0.07em]">Baseline</p>
                          <p className="text-xl font-semibold text-[var(--text-primary)] tabular-nums">{baselineScore.toFixed(1)}%</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-[var(--text-faint)] uppercase tracking-[0.07em]">Latest</p>
                          <p className="text-xl font-semibold text-[var(--text-primary)] tabular-nums">{latestScore.toFixed(1)}%</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-[var(--text-faint)] uppercase tracking-[0.07em]">Progress</p>
                          <p className={`text-xl font-semibold tabular-nums ${scoreDelta >= 0 ? 'text-[var(--status-success)]' : 'text-[var(--accent-orange)]'}`}>
                            {scoreDelta >= 0 ? '+' : ''}{scoreDelta.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
                      <SectionHeader icon={ClipboardCheck} title="Test Results" />
                      <div className="space-y-2">
                        {results.map((result) => (
                          <div key={result.id} className="rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[12px] font-semibold text-[var(--text-primary)]">{result.testTitle || 'Untitled Test'}</p>
                              <p className="text-[11px] text-[var(--text-tertiary)]">Submitted: {toDateLabel(result.submittedAt)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[12px] font-semibold text-[var(--text-primary)] tabular-nums">{safePercentage(result).toFixed(1)}%</p>
                              <p className="text-[10px] text-[var(--text-faint)]">Violations: {result.proctoring?.totalViolations || 0}</p>
                              <button
                                type="button"
                                onClick={() => setAnswerReviewResult(result)}
                                className="mt-1 text-[11px] font-semibold text-[var(--type-event)] hover:underline"
                              >
                                View Answers
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
                      <SectionHeader icon={BookOpen} title="Section-Wise Strength" />
                      {sectionAverages.length === 0 ? (
                        <p className="text-[12px] text-[var(--text-faint)]">Section-wise scores are not available in submitted test data.</p>
                      ) : (
                        <div className="space-y-2">
                          {sectionAverages.map((section) => (
                            <div key={section.name} className="rounded-[8px] border border-[var(--border-subtle)] px-3 py-2 flex items-center justify-between">
                              <div>
                                <p className="text-[12px] font-semibold text-[var(--text-primary)]">{section.name}</p>
                                <p className="text-[10px] text-[var(--text-faint)]">Based on {section.attempts} test{section.attempts === 1 ? '' : 's'}</p>
                              </div>
                              <p className="text-[12px] font-semibold text-[var(--text-primary)] tabular-nums">{section.average.toFixed(1)}%</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      <Modal open={!!answerReviewResult} onClose={() => setAnswerReviewResult(null)} size="lg">
        {answerReviewResult && (() => {
          const snaps = answerReviewResult.questionSnapshots || [];
          const gradedSnaps = snaps.filter((q) => (q.correctAnswer || '').trim());
          const correctCount = gradedSnaps.filter((q) => (q.studentAnswer || '').trim().toLowerCase() === (q.correctAnswer || '').trim().toLowerCase()).length;
          return (
            <>
              <ModalHeader
                icon={ClipboardCheck}
                title="Answer review"
                subtitle={`${answerReviewResult.testTitle || 'Untitled Test'} · ${toDateLabel(answerReviewResult.submittedAt)}`}
                right={gradedSnaps.length > 0 ? (
                  <span className="text-[12px] font-semibold tabular-nums text-[var(--text-secondary)]">{correctCount}/{gradedSnaps.length} correct</span>
                ) : undefined}
                onClose={() => setAnswerReviewResult(null)}
              />
              <ModalBody className="space-y-2.5">
                {snaps.length > 0 ? snaps.map((q, idx) => {
                  const studentAns = (q.studentAnswer || '').trim();
                  const correctAns = (q.correctAnswer || '').trim();
                  const isGraded = !!correctAns;
                  const answered = studentAns.length > 0;
                  const isCorrect = isGraded && answered && studentAns.toLowerCase() === correctAns.toLowerCase();
                  return (
                    <div key={idx} className="rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--text-tertiary)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-2 py-0.5 rounded-full">Q{idx + 1}</span>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--type-event)] bg-[var(--type-event)]/10 px-2 py-0.5 rounded-full">{q.sectionType || 'question'}</span>
                        {isGraded && (
                          <span className={`ml-auto inline-flex items-center gap-1 text-[10.5px] font-semibold ${isCorrect ? 'text-[var(--status-success)]' : 'text-[var(--status-danger)]'}`}>
                            {isCorrect ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                            {isCorrect ? 'Correct' : 'Incorrect'}
                          </span>
                        )}
                      </div>
                      <p className="text-[12.5px] text-[var(--text-primary)] whitespace-pre-line mb-2.5">{q.questionDescription || 'Question text not available.'}</p>
                      <div className="space-y-1.5">
                        <div className={`flex items-baseline gap-2 px-3 py-2 rounded-[8px] text-[12px] border ${
                          !answered ? 'border-[var(--border-subtle)]'
                          : isGraded ? (isCorrect ? 'border-[var(--status-success)]/30 bg-[var(--status-success)]/10' : 'border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10')
                          : 'border-[var(--border-subtle)]'
                        }`}>
                          <span className="text-[9.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)] shrink-0 w-14">Answer</span>
                          <span className={`font-medium ${!answered ? 'text-[var(--text-faint)] italic' : isGraded ? (isCorrect ? 'text-[var(--status-success)]' : 'text-[var(--status-danger)]') : 'text-[var(--text-primary)]'} whitespace-pre-line break-words`}>{answered ? studentAns : 'Not answered'}</span>
                        </div>
                        {isGraded && !isCorrect && (
                          <div className="flex items-baseline gap-2 px-3 py-2 rounded-[8px] text-[12px] border border-[var(--status-success)]/30 bg-[var(--status-success)]/10">
                            <span className="text-[9.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)] shrink-0 w-14">Correct</span>
                            <span className="font-medium text-[var(--status-success)] whitespace-pre-line break-words">{correctAns}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }) : (
                  <p className="text-[12px] text-[var(--text-faint)] text-center py-10">Detailed question snapshots are not available for this result record.</p>
                )}
              </ModalBody>
            </>
          );
        })()}
      </Modal>

      <Modal open={!!resumePreview} onClose={() => setResumePreview(null)} size="xl">
        {resumePreview && (
          <>
            <ModalHeader
              icon={FileText}
              title="Resume Preview"
              subtitle={`${resumePreview.targetCompany || 'General Resume'} · Updated ${toDateLabel(resumePreview.updatedAt)}`}
              right={!!(
                resumePreview.education || resumePreview.experience || resumePreview.skills || resumePreview.projects ||
                resumePreview.coursework || resumePreview.extracurriculars || resumePreview.achievements
              ) ? (
                <span className="text-[11px] font-semibold text-[var(--type-event)] tabular-nums">ATS {getResumeAts(resumePreview)}/100</span>
              ) : undefined}
              onClose={() => setResumePreview(null)}
            />
            <ModalBody>
              <div className="rounded-[8px] border border-[var(--border-subtle)] bg-[#111] p-3">
                <AdminResumePreview data={resumePreview} />
              </div>
            </ModalBody>
          </>
        )}
      </Modal>
    </div>
  );
}
