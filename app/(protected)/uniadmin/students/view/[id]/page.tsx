'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import {
  ArrowLeft, Mail, Phone, Globe, GraduationCap, Briefcase,
  FolderKanban, Trophy, Star, Award, Code, MapPin, Calendar,
  Linkedin, Github, ExternalLink,
} from 'lucide-react';

interface StudentData {
  name?: string;
  email?: string;
  phone?: string;
  photoURL?: string;
  title?: string;
  bio?: string;
  rollNumber?: string;
  studentId?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  technicalSkills?: string;
  relevantCoursework?: string;
  educationEntries?: any[];
  experienceEntries?: any[];
  projectEntries?: any[];
  achievementEntries?: any[];
  positionEntries?: any[];
  extracurricularEntries?: any[];
  // legacy
  education?: string;
  experience?: string;
  projects?: string;
  achievements?: string;
  positions?: string;
  extracurriculars?: string;
}

function formatDateRange(from: string, to: string): string {
  if (from && to) return `${from} – ${to}`;
  if (from) return `${from} – Present`;
  return '';
}

function SectionHeader({ icon: Icon, title }: { icon: React.ComponentType<any>; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3 mt-6 first:mt-0">
      <Icon size={15} className="text-[#5E6AD2]" />
      <h2 className="text-[13px] font-bold uppercase tracking-widest text-[var(--text-primary)]">{title}</h2>
    </div>
  );
}

export default function StudentViewPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { id } = useParams();
  const [student, setStudent] = useState<StudentData | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    async function fetchStudent() {
      if (!id) return;
      try {
        const snap = await getDoc(doc(db, 'users', id as string));
        if (snap.exists()) setStudent(snap.data() as StudentData);
      } catch (error) {
        console.error('Error fetching student:', error);
      } finally {
        setFetching(false);
      }
    }
    fetchStudent();
  }, [id]);

  if (loading || fetching) return (
    <div className="flex items-center justify-center h-64">
      <div className="loading-dots"><span /><span /><span /></div>
    </div>
  );

  if (!student) return (
    <div className="window p-12 text-center">
      <p className="text-[#F54E00] text-[13px]">Student not found.</p>
    </div>
  );

  const eduEntries = student.educationEntries?.length ? student.educationEntries : null;
  const expEntries = student.experienceEntries?.length ? student.experienceEntries : null;
  const projEntries = student.projectEntries?.length ? student.projectEntries : null;
  const achEntries = student.achievementEntries?.length ? student.achievementEntries : null;
  const posEntries = student.positionEntries?.length ? student.positionEntries : null;
  const extraEntries = student.extracurricularEntries?.length ? student.extracurricularEntries : null;

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      {/* Back */}
      <Link href="/uniadmin/student-database" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] mb-5 transition-colors">
        <ArrowLeft size={14} /> Back to Database
      </Link>

      {/* Header Card */}
      <div className="window p-6 mb-5">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          {student.photoURL ? (
            <img src={student.photoURL} alt={student.name} className="w-16 h-16 rounded-full object-cover border-2 border-[var(--border-subtle)]" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-[#5E6AD2]/10 flex items-center justify-center text-[#5E6AD2] text-xl font-bold">
              {student.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-[-0.02em]">{student.name || 'Unnamed'}</h1>
            {student.title && <p className="text-[13px] text-[var(--text-muted)] mt-0.5">{student.title}</p>}
            {student.bio && <p className="text-[12px] text-[var(--text-tertiary)] mt-1 line-clamp-2">{student.bio}</p>}

            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
              {student.email && (
                <span className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
                  <Mail size={12} /> {student.email}
                </span>
              )}
              {student.phone && (
                <span className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
                  <Phone size={12} /> {student.phone}
                </span>
              )}
              {(student.rollNumber || student.studentId) && (
                <span className="text-[12px] font-mono text-[#F54E00]">
                  {student.rollNumber || student.studentId}
                </span>
              )}
            </div>

            {/* Links */}
            <div className="flex gap-2 mt-3">
              {student.linkedinUrl && (
                <a href={student.linkedinUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[#0077B5] bg-[#0077B5]/10 border border-[#0077B5]/20 rounded hover:bg-[#0077B5]/20 transition-colors">
                  <Linkedin size={11} /> LinkedIn <ExternalLink size={9} />
                </a>
              )}
              {student.githubUrl && (
                <a href={student.githubUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[var(--text-primary)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded hover:border-[var(--border-active)] transition-colors">
                  <Github size={11} /> GitHub <ExternalLink size={9} />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Skills & Coursework */}
      {(student.technicalSkills || student.relevantCoursework) && (
        <div className="window p-5 mb-5">
          {student.technicalSkills && (
            <>
              <SectionHeader icon={Code} title="Technical Skills" />
              <div className="flex flex-wrap gap-1.5">
                {student.technicalSkills.split(/[,\n]+/).map((s, i) => s.trim()).filter(Boolean).map((skill, i) => (
                  <span key={i} className="px-2 py-0.5 text-[11px] font-medium rounded bg-[#5E6AD2]/8 text-[#5E6AD2] border border-[#5E6AD2]/15">
                    {skill}
                  </span>
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

      {/* Education */}
      {eduEntries && (
        <div className="window p-5 mb-5">
          <SectionHeader icon={GraduationCap} title="Education" />
          <div className="space-y-3">
            {eduEntries.map((e: any, i: number) => (
              <div key={i} className="border-l-2 border-[#5E6AD2]/30 pl-3">
                <div className="flex justify-between items-baseline">
                  <h3 className="text-[13px] font-bold text-[var(--text-primary)]">{e.institution}</h3>
                  <span className="text-[11px] text-[var(--text-faint)] shrink-0 ml-2">{formatDateRange(e.fromDate, e.toDate)}</span>
                </div>
                <p className="text-[12px] text-[var(--text-muted)]">{e.degree}</p>
                <div className="flex gap-3 mt-0.5">
                  {e.cgpa && <span className="text-[11px] text-[#4CAF50] font-semibold">GPA: {e.cgpa}</span>}
                  {e.location && <span className="flex items-center gap-1 text-[11px] text-[var(--text-faint)]"><MapPin size={10} />{e.location}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Experience */}
      {expEntries && (
        <div className="window p-5 mb-5">
          <SectionHeader icon={Briefcase} title="Experience" />
          <div className="space-y-3">
            {expEntries.map((e: any, i: number) => (
              <div key={i} className="border-l-2 border-[#00C16E]/30 pl-3">
                <div className="flex justify-between items-baseline">
                  <h3 className="text-[13px] font-bold text-[var(--text-primary)]">{e.role}</h3>
                  <span className="text-[11px] text-[var(--text-faint)] shrink-0 ml-2">{formatDateRange(e.fromDate, e.toDate)}</span>
                </div>
                <p className="text-[12px] text-[var(--text-muted)]">{e.company}</p>
                {e.location && <span className="flex items-center gap-1 text-[11px] text-[var(--text-faint)] mt-0.5"><MapPin size={10} />{e.location}</span>}
                {e.description && <p className="text-[11px] text-[var(--text-tertiary)] mt-1 whitespace-pre-line">{e.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Projects */}
      {projEntries && (
        <div className="window p-5 mb-5">
          <SectionHeader icon={FolderKanban} title="Projects" />
          <div className="space-y-3">
            {projEntries.map((p: any, i: number) => (
              <div key={i} className="border-l-2 border-[#F54E00]/30 pl-3">
                <div className="flex justify-between items-baseline">
                  <h3 className="text-[13px] font-bold text-[var(--text-primary)]">
                    {p.title}
                    {p.link && (
                      <a href={p.link} target="_blank" rel="noopener noreferrer" className="ml-1.5 text-[#5E6AD2] hover:underline">
                        <ExternalLink size={10} className="inline" />
                      </a>
                    )}
                  </h3>
                  <span className="text-[11px] text-[var(--text-faint)] shrink-0 ml-2">{formatDateRange(p.fromDate, p.toDate)}</span>
                </div>
                {p.techStack && <p className="text-[11px] text-[#5E6AD2] font-medium mt-0.5">{p.techStack}</p>}
                {p.description && <p className="text-[11px] text-[var(--text-tertiary)] mt-1 whitespace-pre-line">{p.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Achievements */}
      {achEntries && (
        <div className="window p-5 mb-5">
          <SectionHeader icon={Trophy} title="Achievements" />
          <div className="space-y-2">
            {achEntries.map((a: any, i: number) => (
              <div key={i} className="flex justify-between items-baseline">
                <div>
                  <span className="text-[12px] font-bold text-[var(--text-primary)]">{a.title}</span>
                  {a.issuer && <span className="text-[11px] text-[var(--text-muted)]"> — {a.issuer}</span>}
                </div>
                <span className="text-[11px] text-[var(--text-faint)] shrink-0 ml-2">{a.fromDate}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Positions */}
      {posEntries && (
        <div className="window p-5 mb-5">
          <SectionHeader icon={Star} title="Positions of Responsibility" />
          <div className="space-y-2">
            {posEntries.map((p: any, i: number) => (
              <div key={i} className="flex justify-between items-baseline">
                <div>
                  <span className="text-[12px] font-bold text-[var(--text-primary)]">{p.title}</span>
                  <span className="text-[11px] text-[var(--text-muted)]"> — {p.organization}</span>
                </div>
                <span className="text-[11px] text-[var(--text-faint)] shrink-0 ml-2">{formatDateRange(p.fromDate, p.toDate)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Extracurriculars */}
      {extraEntries && (
        <div className="window p-5 mb-5">
          <SectionHeader icon={Award} title="Extracurriculars" />
          <div className="space-y-2">
            {extraEntries.map((e: any, i: number) => (
              <div key={i}>
                <div className="flex justify-between items-baseline">
                  <div>
                    <span className="text-[12px] font-bold text-[var(--text-primary)]">{e.activity}</span>
                    {e.role && <span className="text-[11px] text-[var(--text-muted)]"> — {e.role}</span>}
                  </div>
                  <span className="text-[11px] text-[var(--text-faint)] shrink-0 ml-2">{formatDateRange(e.fromDate, e.toDate)}</span>
                </div>
                {e.description && <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{e.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fallback for legacy string data when no structured entries */}
      {!eduEntries && !expEntries && !projEntries && !achEntries && !posEntries && !extraEntries && !student.technicalSkills && (
        <div className="window p-8 text-center">
          <p className="text-[var(--text-faint)] text-[13px]">This student hasn&apos;t filled out their profile yet.</p>
        </div>
      )}
    </div>
  );
}