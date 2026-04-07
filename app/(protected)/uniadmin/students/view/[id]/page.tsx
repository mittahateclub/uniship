'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  Award,
  BadgeCheck,
  Briefcase,
  Calendar,
  ClipboardCheck,
  Clock3,
  Code,
  FileText,
  FolderKanban,
  GraduationCap,
  Mail,
  MapPin,
  TrendingUp,
  BookOpen,
  Star,
  Trophy,
} from 'lucide-react';

interface StudentData {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  photoURL?: string;
  title?: string;
  bio?: string;
  rollNumber?: string;
  studentId?: string;
  technicalSkills?: string;
  relevantCoursework?: string;
  educationEntries?: any[];
  experienceEntries?: any[];
  projectEntries?: any[];
  achievementEntries?: any[];
  positionEntries?: any[];
  extracurricularEntries?: any[];
  profileReviewStatus?: 'verified' | 'resubmission_requested';
  profileReviewNote?: string;
  profileReviewedAt?: any;
  profileReviewedBy?: string;
}

interface ApplicationItem {
  id: string;
  internshipRole?: string;
  companyName?: string;
  status?: 'pending' | 'shortlisted' | 'selected' | 'rejected';
  appliedAt?: any;
}

interface ResultItem {
  id: string;
  testTitle?: string;
  score?: number;
  attemptedQuestions?: number;
  totalQuestions?: number;
  percentage?: number;
  submittedAt?: any;
  proctoring?: {
    totalViolations?: number;
    violationPoints?: number;
  };
}

interface ResumeItem {
  id: string;
  targetCompany?: string;
  updatedAt?: any;
  keywords?: string[];
}

type TabId = 'placements' | 'about' | 'academic' | 'profile' | 'resumes' | 'analysis';

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'placements', label: 'Placements' },
  { id: 'about', label: 'About' },
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

function toDateLabel(value: any): string {
  if (!value) return 'N/A';
  if (typeof value?.toDate === 'function') return value.toDate().toLocaleDateString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString();
}

function safePercentage(result: ResultItem): number {
  if (typeof result.percentage === 'number') return result.percentage;
  const score = typeof result.score === 'number' ? result.score : (result.attemptedQuestions || 0);
  const total = result.totalQuestions || 0;
  return total > 0 ? (score / total) * 100 : 0;
}

function getResultSections(result: ResultItem): Array<{ name: string; percentage: number }> {
  const sectionSource = (result as any)?.sectionResults || (result as any)?.sections || [];
  if (!Array.isArray(sectionSource)) return [];

  return sectionSource
    .map((section: any) => {
      const name = section?.sectionName || section?.name || 'Section';
      const percentage = typeof section?.percentage === 'number'
        ? section.percentage
        : (section?.totalQuestions > 0 ? ((section?.score || 0) / section.totalQuestions) * 100 : 0);

      return { name, percentage };
    })
    .filter((section: { name: string; percentage: number }) => Number.isFinite(section.percentage));
}

function SectionHeader({ icon: Icon, title }: { icon: React.ComponentType<any>; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3 mt-5 first:mt-0">
      <Icon size={15} className="text-[#4B8BBE]" />
      <h2 className="text-[13px] font-bold uppercase tracking-widest text-[var(--text-primary)]">{title}</h2>
    </div>
  );
}

export default function StudentViewPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [student, setStudent] = useState<StudentData | null>(null);
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [resumes, setResumes] = useState<ResumeItem[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>('placements');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [fetching, setFetching] = useState(true);

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
          getDocs(query(collection(db, 'applications'), where('userId', '==', id))).catch(() => ({ docs: [] } as any)),
          getDocs(query(collection(db, 'test_results'), where('userId', '==', id))).catch(() => ({ docs: [] } as any)),
          getDocs(query(collection(db, 'testResults'), where('userId', '==', id))).catch(() => ({ docs: [] } as any)),
          studentData.email
            ? getDocs(query(collection(db, 'resumes'), where('userEmail', '==', studentData.email))).catch(() => ({ docs: [] } as any))
            : Promise.resolve({ docs: [] } as any),
        ]);

        const appRows = applicationSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as ApplicationItem));
        appRows.sort((a: ApplicationItem, b: ApplicationItem) => {
          const at = typeof a.appliedAt?.toMillis === 'function' ? a.appliedAt.toMillis() : 0;
          const bt = typeof b.appliedAt?.toMillis === 'function' ? b.appliedAt.toMillis() : 0;
          return bt - at;
        });
        setApplications(appRows);

        const resultRows = [
          ...modernResultsSnap.docs.map((d: any) => ({ id: `modern-${d.id}`, ...d.data() } as ResultItem)),
          ...legacyResultsSnap.docs.map((d: any) => ({ id: `legacy-${d.id}`, ...d.data() } as ResultItem)),
        ];
        resultRows.sort((a: ResultItem, b: ResultItem) => {
          const at = typeof a.submittedAt?.toMillis === 'function' ? a.submittedAt.toMillis() : 0;
          const bt = typeof b.submittedAt?.toMillis === 'function' ? b.submittedAt.toMillis() : 0;
          return bt - at;
        });
        setResults(resultRows);

        const resumeRows = resumesSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as ResumeItem));
        resumeRows.sort((a: ResumeItem, b: ResumeItem) => {
          const at = typeof a.updatedAt?.toMillis === 'function' ? a.updatedAt.toMillis() : 0;
          const bt = typeof b.updatedAt?.toMillis === 'function' ? b.updatedAt.toMillis() : 0;
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
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-dots"><span /><span /><span /></div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="window p-12 text-center">
        <p className="text-[#00A8E1] text-[13px]">Student not found.</p>
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
    <div className="max-w-6xl mx-auto animate-fade-in">
      <Link href="/uniadmin/student-database" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] mb-5 transition-colors">
        <ArrowLeft size={14} /> Back to Database
      </Link>

      {notice && (
        <div className={`mb-4 p-3 rounded border text-[13px] ${notice.type === 'success' ? 'border-[#4CAF50]/20 bg-[#4CAF50]/10 text-[#4CAF50]' : 'border-[#00A8E1]/20 bg-[#00A8E1]/10 text-[#00A8E1]'}`}>
          {notice.message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <aside className="window p-5 lg:col-span-1 h-fit">
          <div className="flex flex-col items-center text-center">
            {student.photoURL ? (
              <img src={student.photoURL} alt={student.name || 'Student'} className="w-24 h-24 rounded-full object-cover border-2 border-[var(--border-subtle)]" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-[#4B8BBE]/10 flex items-center justify-center text-[#4B8BBE] text-3xl font-bold">
                {student.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
            )}
            <h1 className="text-[20px] font-bold text-[var(--text-primary)] mt-3">{student.name || 'Unnamed'}</h1>
            <p className="text-[13px] text-[var(--text-tertiary)]">{student.title || 'Student'}</p>
            <p className="text-[12px] font-mono text-[#00A8E1] mt-1">{student.rollNumber || student.studentId || 'N/A'}</p>

            <div className="w-full mt-5 space-y-3">
              <div className="rounded bg-[var(--bg-elevated)] p-3 border border-[var(--border-subtle)]">
                <p className="text-[10px] text-[var(--text-faint)] uppercase tracking-wider">CGPA</p>
                <p className="text-3xl font-bold text-[var(--text-primary)] tabular-nums">{cgpa}</p>
              </div>
              <div className="rounded bg-[var(--bg-elevated)] p-3 border border-[var(--border-subtle)]">
                <p className="text-[10px] text-[var(--text-faint)] uppercase tracking-wider">Applications</p>
                <p className="text-3xl font-bold text-[var(--text-primary)] tabular-nums">{applicationsCount}</p>
              </div>
              <div className="rounded bg-[var(--bg-elevated)] p-3 border border-[var(--border-subtle)]">
                <p className="text-[10px] text-[var(--text-faint)] uppercase tracking-wider">Offers</p>
                <p className="text-3xl font-bold text-[var(--text-primary)] tabular-nums">{offersCount}</p>
              </div>
            </div>
          </div>
        </aside>

        <section className="lg:col-span-3 window overflow-hidden">
          <div className="border-b border-[var(--border-subtle)] p-4 flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex rounded border border-[var(--border-subtle)] overflow-hidden bg-[var(--bg-elevated)]">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-2 text-[12px] font-semibold transition-colors ${activeTab === tab.id ? 'bg-[#4B8BBE]/10 text-[#4B8BBE]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button type="button" disabled={reviewing} onClick={() => handleReview('verified')} className="btn-secondary inline-flex items-center gap-1 text-[12px]">
                <BadgeCheck size={13} /> Mark Profile Verified
              </button>
              <button type="button" disabled={reviewing} onClick={() => handleReview('resubmission_requested')} className="btn-secondary inline-flex items-center gap-1 text-[12px]">
                <AlertCircle size={13} /> Ask Resubmission
              </button>
            </div>
          </div>

          <div className="p-5">
            {activeTab === 'placements' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
                    <p className="text-[10px] text-[var(--text-faint)] uppercase tracking-widest">Applications</p>
                    <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{applicationsCount}</p>
                  </div>
                  <div className="rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
                    <p className="text-[10px] text-[var(--text-faint)] uppercase tracking-widest">Shortlisted</p>
                    <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{shortlistedCount}</p>
                  </div>
                  <div className="rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
                    <p className="text-[10px] text-[var(--text-faint)] uppercase tracking-widest">Offers</p>
                    <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{offersCount}</p>
                  </div>
                  <div className="rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
                    <p className="text-[10px] text-[var(--text-faint)] uppercase tracking-widest">Avg Test Score</p>
                    <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{avgScore.toFixed(1)}%</p>
                  </div>
                  <div className="rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
                    <p className="text-[10px] text-[var(--text-faint)] uppercase tracking-widest">Reliability</p>
                    <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{reliability}/100</p>
                  </div>
                </div>

                <SectionHeader icon={ClipboardCheck} title="Recent Applications" />
                {applications.length === 0 ? (
                  <p className="text-[12px] text-[var(--text-faint)]">No applications available.</p>
                ) : (
                  <div className="space-y-2">
                    {applications.slice(0, 6).map((app) => (
                      <div key={app.id} className="rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 flex items-center justify-between">
                        <div>
                          <p className="text-[12px] font-semibold text-[var(--text-primary)]">{app.internshipRole || 'Internship'}</p>
                          <p className="text-[11px] text-[var(--text-tertiary)]">{app.companyName || 'Unknown company'} - {toDateLabel(app.appliedAt)}</p>
                        </div>
                        <span className="text-[11px] font-semibold uppercase text-[var(--text-faint)]">{app.status || 'pending'}</span>
                      </div>
                    ))}
                  </div>
                )}

                <SectionHeader icon={FileText} title="Recent Test Performance" />
                {results.length === 0 ? (
                  <p className="text-[12px] text-[var(--text-faint)]">No test results yet.</p>
                ) : (
                  <div className="space-y-2">
                    {results.slice(0, 6).map((result) => (
                      <div key={result.id} className="rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 flex items-center justify-between">
                        <div>
                          <p className="text-[12px] font-semibold text-[var(--text-primary)]">{result.testTitle || 'Untitled Test'}</p>
                          <p className="text-[11px] text-[var(--text-tertiary)]">Submitted {toDateLabel(result.submittedAt)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[12px] font-semibold text-[var(--text-primary)]">{safePercentage(result).toFixed(1)}%</p>
                          <p className="text-[10px] text-[var(--text-faint)]">Violations: {result.proctoring?.totalViolations || 0}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'about' && (
              <div className="space-y-4">
                <SectionHeader icon={Mail} title="Contact" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 text-[12px]">
                    <p className="text-[var(--text-faint)] mb-1">Email</p>
                    <p className="text-[var(--text-primary)] break-all">{student.email || 'N/A'}</p>
                  </div>
                  <div className="rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 text-[12px]">
                    <p className="text-[var(--text-faint)] mb-1">Phone</p>
                    <p className="text-[var(--text-primary)]">{student.phone || 'N/A'}</p>
                  </div>
                </div>

                <SectionHeader icon={Calendar} title="Review Status" />
                <div className="rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 text-[12px] space-y-1">
                  <p>Status: <span className="font-semibold text-[var(--text-primary)]">{student.profileReviewStatus || 'Not reviewed'}</span></p>
                  <p>Reviewed by: <span className="font-semibold text-[var(--text-primary)]">{student.profileReviewedBy || 'N/A'}</span></p>
                  <p>Reviewed at: <span className="font-semibold text-[var(--text-primary)]">{toDateLabel(student.profileReviewedAt)}</span></p>
                  {student.profileReviewNote && <p>Note: <span className="text-[var(--text-primary)]">{student.profileReviewNote}</span></p>}
                </div>

                {student.bio && (
                  <>
                    <SectionHeader icon={FileText} title="Bio" />
                    <p className="text-[12px] text-[var(--text-secondary)] whitespace-pre-line">{student.bio}</p>
                  </>
                )}
              </div>
            )}

            {activeTab === 'academic' && (
              <div className="space-y-4">
                {(student.technicalSkills || student.relevantCoursework) && (
                  <div className="rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
                    {student.technicalSkills && (
                      <>
                        <SectionHeader icon={Code} title="Technical Skills" />
                        <div className="flex flex-wrap gap-1.5">
                          {student.technicalSkills.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean).map((skill, i) => (
                            <span key={i} className="px-2 py-0.5 text-[11px] font-medium rounded bg-[#4B8BBE]/8 text-[#4B8BBE] border border-[#4B8BBE]/15">{skill}</span>
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

                {eduEntries ? (
                  <div className="space-y-3">
                    {eduEntries.map((e: any, i: number) => (
                      <div key={i} className="rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
                        <div className="flex justify-between items-baseline">
                          <h3 className="text-[13px] font-bold text-[var(--text-primary)]">{e.institution}</h3>
                          <span className="text-[11px] text-[var(--text-faint)]">{formatDateRange(e.fromDate, e.toDate)}</span>
                        </div>
                        <p className="text-[12px] text-[var(--text-muted)]">{e.degree}</p>
                        <div className="flex gap-3 mt-1">
                          {e.cgpa && <span className="text-[11px] text-[#4CAF50] font-semibold">CGPA: {e.cgpa}</span>}
                          {e.location && <span className="flex items-center gap-1 text-[11px] text-[var(--text-faint)]"><MapPin size={10} />{e.location}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12px] text-[var(--text-faint)]">No academic records available.</p>
                )}
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="space-y-4">
                {expEntries && (
                  <div className="window p-4">
                    <SectionHeader icon={Briefcase} title="Experience" />
                    <div className="space-y-3">
                      {expEntries.map((e: any, i: number) => (
                        <div key={i} className="border-l-2 border-[#00C16E]/30 pl-3">
                          <div className="flex justify-between items-baseline">
                            <h3 className="text-[13px] font-bold text-[var(--text-primary)]">{e.role}</h3>
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
                      {projEntries.map((p: any, i: number) => (
                        <div key={i} className="border-l-2 border-[#00A8E1]/30 pl-3">
                          <div className="flex justify-between items-baseline">
                            <h3 className="text-[13px] font-bold text-[var(--text-primary)]">{p.title}</h3>
                            <span className="text-[11px] text-[var(--text-faint)]">{formatDateRange(p.fromDate, p.toDate)}</span>
                          </div>
                          {p.techStack && <p className="text-[11px] text-[#4B8BBE] mt-1">{p.techStack}</p>}
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
                      {achEntries.map((a: any, i: number) => (
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
                      {posEntries.map((p: any, i: number) => (
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
                      {extraEntries.map((e: any, i: number) => (
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
              <div className="space-y-3">
                {resumes.length === 0 ? (
                  <p className="text-[12px] text-[var(--text-faint)]">No saved resumes found or access is restricted by rules.</p>
                ) : (
                  resumes.map((resume) => (
                    <div key={resume.id} className="rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[13px] font-semibold text-[var(--text-primary)]">{resume.targetCompany || 'General Resume'}</p>
                          <p className="text-[11px] text-[var(--text-faint)]">Updated: {toDateLabel(resume.updatedAt)}</p>
                        </div>
                        <Clock3 size={14} className="text-[var(--text-faint)]" />
                      </div>
                      {resume.keywords && resume.keywords.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {resume.keywords.slice(0, 10).map((keyword, i) => (
                            <span key={`${resume.id}-${i}`} className="px-2 py-0.5 rounded text-[10px] border border-[var(--border-subtle)] text-[var(--text-tertiary)]">{keyword}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'analysis' && (
              <div className="space-y-4">
                {results.length === 0 ? (
                  <p className="text-[12px] text-[var(--text-faint)]">No test result data available for analysis yet.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <div className="rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
                        <p className="text-[10px] text-[var(--text-faint)] uppercase tracking-widest">Tests Taken</p>
                        <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{results.length}</p>
                      </div>
                      <div className="rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
                        <p className="text-[10px] text-[var(--text-faint)] uppercase tracking-widest">Avg Score</p>
                        <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{avgScore.toFixed(1)}%</p>
                      </div>
                      <div className="rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
                        <p className="text-[10px] text-[var(--text-faint)] uppercase tracking-widest">Reliability</p>
                        <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{reliability}/100</p>
                      </div>
                      <div className="rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
                        <p className="text-[10px] text-[var(--text-faint)] uppercase tracking-widest">Consistency</p>
                        <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{consistency}%</p>
                      </div>
                      <div className="rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
                        <p className="text-[10px] text-[var(--text-faint)] uppercase tracking-widest">Violations</p>
                        <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{totalViolations}</p>
                      </div>
                    </div>

                    <div className="rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
                      <SectionHeader icon={TrendingUp} title="Performance Trend" />
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <p className="text-[11px] text-[var(--text-faint)] uppercase tracking-widest">Baseline</p>
                          <p className="text-xl font-bold text-[var(--text-primary)] tabular-nums">{baselineScore.toFixed(1)}%</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-[var(--text-faint)] uppercase tracking-widest">Latest</p>
                          <p className="text-xl font-bold text-[var(--text-primary)] tabular-nums">{latestScore.toFixed(1)}%</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-[var(--text-faint)] uppercase tracking-widest">Progress</p>
                          <p className={`text-xl font-bold tabular-nums ${scoreDelta >= 0 ? 'text-[#4CAF50]' : 'text-[#00A8E1]'}`}>
                            {scoreDelta >= 0 ? '+' : ''}{scoreDelta.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
                      <SectionHeader icon={BookOpen} title="Section-Wise Strength" />
                      {sectionAverages.length === 0 ? (
                        <p className="text-[12px] text-[var(--text-faint)]">Section-wise scores are not available in submitted test data.</p>
                      ) : (
                        <div className="space-y-2">
                          {sectionAverages.map((section) => (
                            <div key={section.name} className="rounded border border-[var(--border-subtle)] px-3 py-2 flex items-center justify-between">
                              <div>
                                <p className="text-[12px] font-semibold text-[var(--text-primary)]">{section.name}</p>
                                <p className="text-[10px] text-[var(--text-faint)]">Based on {section.attempts} test{section.attempts === 1 ? '' : 's'}</p>
                              </div>
                              <p className="text-[12px] font-bold text-[var(--text-primary)] tabular-nums">{section.average.toFixed(1)}%</p>
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
    </div>
  );
}
