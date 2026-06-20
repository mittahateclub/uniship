// app/(protected)/user/profile/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase-storage';
import { getCache, setCache } from '@/lib/page-cache';
import Camera from '@/components/icons/Camera';
import User from '@/components/icons/User';
import X from '@/components/icons/X';
import GraduationCap from '@/components/icons/GraduationCap';
import { ProfileSkeleton } from '@/components/Skeleton';

// Field names match exactly what is stored in Firebase
interface UserProfile {
  photoURL?: string;
  name?: string;
  phone?: string;
  email?: string;
  title?: string;
  bio?: string;
  rollNumber?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  // Legacy string fields (kept for resume page compatibility)
  technicalSkills?: string;
  experience?: string;
  education?: string;
  projects?: string;
  achievements?: string;
  positions?: string;
  relevantCoursework?: string;
  extracurriculars?: string;
  // Structured entry arrays
  educationEntries?: EducationEntry[];
  experienceEntries?: ExperienceEntry[];
  projectEntries?: ProjectEntry[];
  achievementEntries?: AchievementEntry[];
  positionEntries?: PositionEntry[];
  extracurricularEntries?: ExtracurricularEntry[];
}

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

// Helper to format from/to into a date range string
function formatDateRange(from: string, to: string): string {
  if (from && to) return `${from} – ${to}`;
  if (from) return `${from} – Present`;
  if (to) return to;
  return '';
}

// Serializers — flatten structured entries to strings for resume compatibility
function serializeEducation(entries: EducationEntry[]): string {
  return entries.filter(e => e.institution || e.degree).map(e =>
    [e.institution, e.location, e.degree, formatDateRange(e.fromDate, e.toDate), e.cgpa ? `CGPA: ${e.cgpa}` : ''].filter(Boolean).join(' | ')
  ).join('\n');
}
function serializeExperience(entries: ExperienceEntry[]): string {
  return entries.filter(e => e.company || e.role).map(e =>
    [[e.company, e.role, formatDateRange(e.fromDate, e.toDate)].filter(Boolean).join(' | '), e.location, e.description].filter(Boolean).join('\n')
  ).join('\n\n');
}
function serializeProjects(entries: ProjectEntry[]): string {
  return entries.filter(e => e.title).map(e =>
    [[e.title, e.techStack, formatDateRange(e.fromDate, e.toDate)].filter(Boolean).join(' | '), e.location, e.description, e.link].filter(Boolean).join('\n')
  ).join('\n\n');
}
function serializeAchievements(entries: AchievementEntry[]): string {
  return entries.filter(e => e.title).map(e =>
    [e.title, e.issuer, e.location, formatDateRange(e.fromDate, e.toDate)].filter(Boolean).join(' | ')
  ).join('\n');
}
function serializePositions(entries: PositionEntry[]): string {
  return entries.filter(e => e.title).map(e =>
    [e.title, e.organization, e.location, formatDateRange(e.fromDate, e.toDate)].filter(Boolean).join(' | ')
  ).join('\n');
}
function serializeExtracurriculars(entries: ExtracurricularEntry[]): string {
  return entries.filter(e => e.activity).map(e =>
    [e.activity, e.role, e.location, formatDateRange(e.fromDate, e.toDate), e.description].filter(Boolean).join(' | ')
  ).join('\n');
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
}

function hasFilledEntry<T extends object>(entries: T[]): boolean {
  return entries.some((entry) => Object.values(entry).some(hasText));
}

// ✅ LinkedIn SVG logo (official brand color)
const LinkedInIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-5 h-5 fill-current">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

// ✅ GitHub SVG logo (official mark)
const GitHubIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-5 h-5 fill-current">
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
  </svg>
);

// Reusable accordion panel wrapper
function AccordionPanel({
  label, hint, isOpen, hasContent, onToggle, children, id,
}: {
  label: string; hint?: string; isOpen: boolean; hasContent: boolean;
  onToggle: () => void; children: React.ReactNode; id?: string;
}) {
  return (
    <div id={id} className={isOpen ? 'bg-[var(--bg-elevated)]/40' : ''}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-5 sm:px-6 py-4 text-left hover:bg-[var(--bg-elevated)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-orange)] focus-visible:ring-inset"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${hasContent ? 'bg-[var(--accent-orange)]' : 'bg-[var(--border-active)]'}`}
            title={hasContent ? 'Has content' : 'Empty'}
          />
          <span className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--text-primary)] truncate">{label}</span>
          {hint && (
            <span className="hidden sm:inline-flex text-[10px] font-medium bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-faint)] px-2 py-0.5 rounded-full">{hint}</span>
          )}
        </div>
        <span className={`w-6 h-6 rounded-full grid place-items-center shrink-0 text-[var(--text-faint)] transition duration-200 ${isOpen ? 'rotate-180 bg-[var(--bg-surface)] text-[var(--text-secondary)]' : ''}`}>
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>
      <div className={`grid transition-[grid-template-rows,opacity] duration-200 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <div className="px-5 sm:px-6 pb-5 pt-1">{children}</div>
        </div>
      </div>
    </div>
  );
}

// Read-only live preview of the profile — mirrors how the assembled profile
// reads, so the student can see what each section produces while editing.
function PreviewBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)] mb-2">{label}</p>
      {children}
    </div>
  );
}

function ProfilePreview({
  profile, education, experience, projects, achievements, positions, extracurriculars, detailed,
}: {
  profile: UserProfile | null;
  education: EducationEntry[];
  experience: ExperienceEntry[];
  projects: ProjectEntry[];
  achievements: AchievementEntry[];
  positions: PositionEntry[];
  extracurriculars: ExtracurricularEntry[];
  detailed: boolean;
}) {
  const skills = (profile?.technicalSkills || '').split(',').map((s) => s.trim()).filter(Boolean);
  const courses = (profile?.relevantCoursework || '').split(',').map((s) => s.trim()).filter(Boolean);
  const edu = education.filter((e) => e.institution || e.degree);
  const exp = experience.filter((e) => e.company || e.role);
  const proj = projects.filter((e) => e.title);
  const ach = achievements.filter((e) => e.title);
  const pos = positions.filter((e) => e.title);
  const extra = extracurriculars.filter((e) => e.activity);

  // Identity (photo/name/title/roll/links) lives in the page header — the preview
  // shows only the portfolio content so the two don't duplicate each other.
  const anyContent = !!(
    profile?.bio || skills.length || courses.length || edu.length ||
    exp.length || proj.length || ach.length || pos.length || extra.length
  );

  const chip = 'text-[11px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] px-2 py-0.5 rounded-full';
  const join = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' · ');

  // Summary mode surfaces the few headline facts a reviewer skims first.
  const primaryEdu = edu[0];
  // Pull just the score (e.g. "8.7 / 10") out of whatever the user typed.
  const cgpaValue = primaryEdu?.cgpa
    ? (primaryEdu.cgpa.match(/[\d.]+\s*(?:\/\s*[\d.]+)?/)?.[0] ?? primaryEdu.cgpa)
    : undefined;

  return (
    <div className="space-y-5">
      {detailed && profile?.bio && (
        <p className="text-[12.5px] text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">{profile.bio}</p>
      )}

      {/* ── Summary mode — only the headline facts ── */}
      {anyContent && !detailed && (
        <>
          {primaryEdu && (primaryEdu.institution || primaryEdu.degree || cgpaValue) && (
            <div className="rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/40 px-3.5 py-3">
              {primaryEdu.institution && (
                <p className="text-[12.5px] font-semibold text-[var(--text-primary)] leading-snug">{primaryEdu.institution}</p>
              )}
              {primaryEdu.degree && (
                <p className="text-[11.5px] text-[var(--text-tertiary)] mt-0.5">{primaryEdu.degree}</p>
              )}
              {cgpaValue && (
                <div className="mt-2.5 pt-2.5 border-t border-[var(--border-subtle)] flex items-baseline gap-2">
                  <span className="text-[19px] font-bold text-[var(--accent-orange)] tracking-[-0.01em] leading-none">{cgpaValue}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)]">CGPA</span>
                </div>
              )}
            </div>
          )}

          {skills.length > 0 && (
            <PreviewBlock label="Top Skills">
              <div className="flex flex-wrap gap-1.5">
                {skills.slice(0, 6).map((s, i) => <span key={i} className={chip}>{s}</span>)}
                {skills.length > 6 && <span className={chip}>+{skills.length - 6}</span>}
              </div>
            </PreviewBlock>
          )}
        </>
      )}

      {/* ── Detailed mode — full render of every section ── */}
      {detailed && (
        <>
          {skills.length > 0 && (
            <PreviewBlock label="Technical Skills">
              <div className="flex flex-wrap gap-1.5">{skills.map((s, i) => <span key={i} className={chip}>{s}</span>)}</div>
            </PreviewBlock>
          )}

      {edu.length > 0 && (
        <PreviewBlock label="Education">
          <div className="space-y-2.5">
            {edu.map((e, i) => (
              <div key={i}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12.5px] font-semibold text-[var(--text-primary)] truncate">{e.institution || 'Institution'}</span>
                  <span className="text-[10.5px] text-[var(--text-faint)] shrink-0">{formatDateRange(e.fromDate, e.toDate)}</span>
                </div>
                {join(e.degree, e.cgpa && (/gpa/i.test(e.cgpa) ? e.cgpa : `CGPA ${e.cgpa}`), e.location) && (
                  <p className="text-[11.5px] text-[var(--text-tertiary)]">{join(e.degree, e.cgpa && (/gpa/i.test(e.cgpa) ? e.cgpa : `CGPA ${e.cgpa}`), e.location)}</p>
                )}
              </div>
            ))}
          </div>
        </PreviewBlock>
      )}

      {exp.length > 0 && (
        <PreviewBlock label="Experience">
          <div className="space-y-3">
            {exp.map((e, i) => (
              <div key={i}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12.5px] font-semibold text-[var(--text-primary)] truncate">{join(e.role, e.company) || 'Role'}</span>
                  <span className="text-[10.5px] text-[var(--text-faint)] shrink-0">{formatDateRange(e.fromDate, e.toDate)}</span>
                </div>
                {e.location && <p className="text-[11px] text-[var(--text-faint)]">{e.location}</p>}
                {e.description && <p className="text-[11.5px] text-[var(--text-tertiary)] mt-0.5 whitespace-pre-line">{e.description}</p>}
              </div>
            ))}
          </div>
        </PreviewBlock>
      )}

      {proj.length > 0 && (
        <PreviewBlock label="Projects">
          <div className="space-y-3">
            {proj.map((e, i) => (
              <div key={i}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12.5px] font-semibold text-[var(--text-primary)] truncate">{e.title}</span>
                  <span className="text-[10.5px] text-[var(--text-faint)] shrink-0">{formatDateRange(e.fromDate, e.toDate)}</span>
                </div>
                {e.techStack && <p className="text-[11px] text-[var(--accent-orange)]">{e.techStack}</p>}
                {e.description && <p className="text-[11.5px] text-[var(--text-tertiary)] mt-0.5 whitespace-pre-line">{e.description}</p>}
              </div>
            ))}
          </div>
        </PreviewBlock>
      )}

      {ach.length > 0 && (
        <PreviewBlock label="Achievements">
          <div className="space-y-1.5">
            {ach.map((e, i) => (
              <div key={i} className="flex items-baseline justify-between gap-2">
                <span className="text-[12px] text-[var(--text-primary)] truncate">{join(e.title, e.issuer)}</span>
                <span className="text-[10.5px] text-[var(--text-faint)] shrink-0">{formatDateRange(e.fromDate, e.toDate)}</span>
              </div>
            ))}
          </div>
        </PreviewBlock>
      )}

      {pos.length > 0 && (
        <PreviewBlock label="Positions of Responsibility">
          <div className="space-y-1.5">
            {pos.map((e, i) => (
              <div key={i} className="flex items-baseline justify-between gap-2">
                <span className="text-[12px] text-[var(--text-primary)] truncate">{join(e.title, e.organization)}</span>
                <span className="text-[10.5px] text-[var(--text-faint)] shrink-0">{formatDateRange(e.fromDate, e.toDate)}</span>
              </div>
            ))}
          </div>
        </PreviewBlock>
      )}

      {courses.length > 0 && (
        <PreviewBlock label="Relevant Coursework">
          <div className="flex flex-wrap gap-1.5">{courses.map((c, i) => <span key={i} className={chip}>{c}</span>)}</div>
        </PreviewBlock>
      )}

      {extra.length > 0 && (
        <PreviewBlock label="Extracurriculars">
          <div className="space-y-1.5">
            {extra.map((e, i) => (
              <div key={i} className="flex items-baseline justify-between gap-2">
                <span className="text-[12px] text-[var(--text-primary)] truncate">{join(e.activity, e.role)}</span>
                <span className="text-[10.5px] text-[var(--text-faint)] shrink-0">{formatDateRange(e.fromDate, e.toDate)}</span>
              </div>
            ))}
          </div>
        </PreviewBlock>
      )}
        </>
      )}

      {!anyContent && (
        <div className="text-center py-12">
          <p className="text-[12.5px] font-medium text-[var(--text-primary)]">Nothing to preview yet</p>
          <p className="text-[11.5px] text-[var(--text-faint)] mt-1">Fill in the sections and they’ll appear here live.</p>
        </div>
      )}
    </div>
  );
}

export default function StudentProfile() {
  const { user, loading: authLoading } = useAuth();
  const cacheKey = user ? `userprofile:${user.uid}` : '';
  const cached = cacheKey ? getCache<UserProfile>(cacheKey) : undefined;
  const [profile, setProfile] = useState<UserProfile | null>(cached ?? null);
  const [loading, setLoading] = useState(!cached);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');

  // Structured entry states
  const [educationEntries, setEducationEntries] = useState<EducationEntry[]>(cached?.educationEntries ?? []);
  const [experienceEntries, setExperienceEntries] = useState<ExperienceEntry[]>(cached?.experienceEntries ?? []);
  const [projectEntries, setProjectEntries] = useState<ProjectEntry[]>(cached?.projectEntries ?? []);
  const [achievementEntries, setAchievementEntries] = useState<AchievementEntry[]>(cached?.achievementEntries ?? []);
  const [positionEntries, setPositionEntries] = useState<PositionEntry[]>(cached?.positionEntries ?? []);
  const [extracurricularEntries, setExtracurricularEntries] = useState<ExtracurricularEntry[]>(cached?.extracurricularEntries ?? []);

  const toggleSection = (section: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  // Generic entry helpers
  function updateEntry<T>(setter: React.Dispatch<React.SetStateAction<T[]>>, index: number, field: keyof T, value: string) {
    setter(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }
  function removeEntry<T>(setter: React.Dispatch<React.SetStateAction<T[]>>, index: number) {
    setter(prev => prev.filter((_, i) => i !== index));
  }

  useEffect(() => {
    async function fetchProfile() {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as UserProfile;
          // Pre-fill email with Auth email if it's missing in profile
          if (!data.email && user.email) {
            data.email = user.email;
          }
          setProfile(data);
          // Hydrate structured entries from Firestore
          if (data.educationEntries) setEducationEntries(data.educationEntries);
          if (data.experienceEntries) setExperienceEntries(data.experienceEntries);
          if (data.projectEntries) setProjectEntries(data.projectEntries);
          if (data.achievementEntries) setAchievementEntries(data.achievementEntries);
          if (data.positionEntries) setPositionEntries(data.positionEntries);
          if (data.extracurricularEntries) setExtracurricularEntries(data.extracurricularEntries);
          if (cacheKey) setCache<UserProfile>(cacheKey, data);
        } else {
          setProfile({ email: user.email || '' });
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    }
    if (!authLoading) fetchProfile();
  }, [user, authLoading, cacheKey]);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const storageRef = ref(storage, `profile_pictures/${user.uid}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    setUploadProgress(0);
    setMessage('');

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        setUploadProgress(progress);
      },
      (error) => {
        console.error('Upload error:', error);
        setMessage('Failed to upload image.');
        setUploadProgress(null);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        await updateDoc(doc(db, 'users', user.uid), { photoURL: downloadURL });
        setProfile((prev) => ({ ...prev, photoURL: downloadURL }));
        setUploadProgress(null);
        setMessage('Profile photo updated successfully!');
      }
    );
  };

  const handleRemovePhoto = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), { photoURL: '' });
      setProfile((prev) => ({ ...prev, photoURL: '' }));
      setMessage('Profile photo removed.');
    } catch (error) {
      console.error('Error removing photo:', error);
      setMessage('Failed to remove photo.');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    setUpdating(true);
    setMessage('');
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        ...profile,
        // Structured arrays
        educationEntries,
        experienceEntries,
        projectEntries,
        achievementEntries,
        positionEntries,
        extracurricularEntries,
        // Serialized strings for resume compatibility
        education: serializeEducation(educationEntries),
        experience: serializeExperience(experienceEntries),
        projects: serializeProjects(projectEntries),
        achievements: serializeAchievements(achievementEntries),
        positions: serializePositions(positionEntries),
        extracurriculars: serializeExtracurriculars(extracurricularEntries),
        updatedAt: new Date(),
      });
      setMessage('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage('Failed to update profile.');
    } finally {
      setUpdating(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfile((prev) => (prev ? { ...prev, [name]: value } : { [name]: value }));
  };

  // Shared Tailwind classes for portfolio form
  const fieldClass = 'w-full rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-input)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:border-[var(--accent-orange)] outline-none transition-colors';
  const cardClass = 'rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4';
  const addBtnClass = 'w-full rounded-[10px] border border-dashed border-[var(--border-active)] py-2.5 text-[13px] font-semibold text-[var(--text-tertiary)] hover:border-[var(--accent-orange)]/50 hover:text-[var(--text-primary)] hover:bg-[var(--accent-orange)]/5 transition-colors';
  const removeBtnClass = 'text-[11px] font-medium text-[var(--text-faint)] hover:text-[var(--status-danger)] transition-colors';

  if (loading || authLoading) {
    return <ProfileSkeleton />;
  }

  const completeness = (() => {
    const signals = [
      profile?.name, profile?.title, profile?.bio, profile?.phone, profile?.rollNumber,
      profile?.technicalSkills, hasFilledEntry(educationEntries), hasFilledEntry(experienceEntries),
      hasFilledEntry(projectEntries), hasFilledEntry(achievementEntries), hasFilledEntry(positionEntries),
      profile?.relevantCoursework, hasFilledEntry(extracurricularEntries), (profile?.linkedinUrl || profile?.githubUrl),
    ];
    return Math.round((signals.filter(Boolean).length / signals.length) * 100);
  })();

  // Headline CGPA for the identity band — pulled from the first education entry that has one.
  const bandCgpa = (() => {
    const e = educationEntries.find((x) => x.cgpa);
    if (!e?.cgpa) return undefined;
    return e.cgpa.match(/[\d.]+\s*(?:\/\s*[\d.]+)?/)?.[0] ?? e.cgpa;
  })();

  return (
    <div className="animate-fade-in">
      <div className="max-w-[1200px] mx-auto">
        <div className="pt-8 mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-semibold tracking-[-0.025em] text-[var(--text-primary)]">Student Profile</h1>
            <p className="text-[var(--text-tertiary)] text-[13.5px] mt-1.5">
              Manage your academic identity, portfolio, and resume details.
            </p>
          </div>
          <div className="inline-flex items-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-0.5 text-[12.5px] font-medium shrink-0">
            <button
              type="button" onClick={() => setMode('edit')}
              className={`px-4 py-1.5 rounded-full transition-colors ${mode === 'edit' ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
            >Edit</button>
            <button
              type="button" onClick={() => setMode('preview')}
              className={`px-4 py-1.5 rounded-full transition-colors ${mode === 'preview' ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
            >Preview</button>
          </div>
        </div>

        {/* ── Identity band ── */}
        <div id="photo" className="rounded-[14px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 sm:p-6 mb-5 flex flex-col sm:flex-row sm:items-center gap-5">
          {/* Clickable avatar */}
          <div className="relative w-20 h-20 sm:w-[88px] sm:h-[88px] shrink-0 mx-auto sm:mx-0">
            <div
              className="w-full h-full group cursor-pointer relative"
              onClick={() => fileInputRef.current?.click()}
            >
              {profile?.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element -- uploaded profile photos can use blob URLs or arbitrary storage hosts.
                <img
                  src={profile.photoURL}
                  alt="Profile"
                  className="w-full h-full rounded-full border border-[var(--border-subtle)] object-cover"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-faint)]">
                  <User size={36} />
                </div>
              )}
              <div className="absolute inset-0 rounded-full bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera size={20} className="text-white" />
                <span className="text-white text-[9px] font-semibold uppercase mt-1 tracking-[0.07em]">Change</span>
              </div>
              {uploadProgress !== null && (
                <div className="absolute inset-0 rounded-full bg-black/70 flex items-center justify-center">
                  <span className="text-white font-semibold text-base tabular-nums">{uploadProgress}%</span>
                </div>
              )}
            </div>
            {profile?.photoURL && uploadProgress === null && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                title="Remove photo"
                aria-label="Remove photo"
                className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--status-danger)] hover:border-[var(--status-danger)]/40 transition-colors shadow-sm"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoChange}
          />

          {/* Identity */}
          <div className="flex-1 min-w-0 text-center sm:text-left">
            <h2 className="text-[19px] font-semibold tracking-[-0.015em] text-[var(--text-primary)] truncate">
              {profile?.name || user?.email?.split('@')[0]}
            </h2>
            <p className="text-[13px] text-[var(--text-tertiary)] mt-0.5 truncate">
              {profile?.title || 'Student Account'}
            </p>
            <div className="flex items-center justify-center sm:justify-start flex-wrap gap-2 mt-3">
              {profile?.rollNumber && (
                <span className="font-mono text-[11px] text-[var(--accent-orange)] bg-[var(--accent-orange)]/10 px-2.5 py-1 rounded-full tracking-[0.05em]">
                  {profile.rollNumber}
                </span>
              )}
              {profile?.linkedinUrl && (
                <a href={profile.linkedinUrl} target="_blank" rel="noopener noreferrer" title="LinkedIn Profile"
                  className="text-[var(--text-primary)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-full p-2 hover:border-[var(--border-active)] transition-colors">
                  <LinkedInIcon />
                </a>
              )}
              {profile?.githubUrl && (
                <a href={profile.githubUrl} target="_blank" rel="noopener noreferrer" title="GitHub Profile"
                  className="text-[var(--text-primary)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-full p-2 hover:border-[var(--border-active)] transition-colors">
                  <GitHubIcon />
                </a>
              )}
              {bandCgpa && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-2.5 py-1 rounded-full">
                  <GraduationCap size={13} className="text-[var(--text-faint)]" />
                  <span className="font-mono text-[var(--text-primary)]">{bandCgpa}</span>
                  <span className="text-[10px] uppercase tracking-[0.06em] text-[var(--text-faint)]">CGPA</span>
                </span>
              )}
            </div>
          </div>

          {/* Completeness meter */}
          <div className="shrink-0 w-full sm:w-[150px]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)]">Profile</span>
              <span className="text-[12px] font-semibold tabular-nums text-[var(--text-primary)]">{completeness}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
              <div className="h-full rounded-full bg-[var(--accent-orange)] transition-[width] duration-500" style={{ width: `${completeness}%` }} />
            </div>
          </div>
        </div>

        {mode === 'edit' ? (
          <form onSubmit={handleUpdate} className="space-y-5">

              {/* Personal Details */}
              <div className="window p-6" id="personal-details">
                <h3 className="text-[16px] font-semibold tracking-[-0.015em] mb-5">Personal Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.07em] mb-1.5 block">Full Name</label>
                    <input
                      type="text"
                      name="name"
                      value={profile?.name || ''}
                      onChange={handleChange}
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-[10px] px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent-orange)] outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.07em] mb-1.5 block">Roll Number</label>
                    <input
                      type="text"
                      name="rollNumber"
                      value={profile?.rollNumber || ''}
                      onChange={handleChange}
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-[10px] px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent-orange)] outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.07em] mb-1.5 block">Phone Number</label>
                    <input
                      type="tel"
                      name="phone"
                      value={profile?.phone || ''}
                      onChange={handleChange}
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-[10px] px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent-orange)] outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.07em] mb-1.5 block">Contact Email</label>
                    <input
                      type="email"
                      name="email"
                      value={profile?.email || ''}
                      onChange={handleChange}
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-[10px] px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent-orange)] outline-none transition-colors"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.07em] mb-1.5 block">Professional Title</label>
                    <input
                      type="text"
                      name="title"
                      placeholder="e.g. Computer Science Student | Aspiring SDE"
                      value={profile?.title || ''}
                      onChange={handleChange}
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-[10px] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:border-[var(--accent-orange)] outline-none transition-colors"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.07em] mb-1.5 block">Bio</label>
                    <textarea
                      name="bio"
                      rows={3}
                      value={profile?.bio || ''}
                      onChange={handleChange}
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-[10px] px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent-orange)] outline-none transition-colors resize-y"
                    />
                  </div>
                </div>
              </div>

              {/* Web Presence */}
              <div className="window p-6" id="web-presence">
                <h3 className="text-[16px] font-semibold tracking-[-0.015em] mb-5">Web Presence</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                  {/* LinkedIn */}
                  <div>
                    <label className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.07em] mb-1.5 flex items-center gap-2">
                      <span className="text-[var(--text-primary)]"><LinkedInIcon /></span>
                      LinkedIn URL
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        name="linkedinUrl"
                        value={profile?.linkedinUrl || ''}
                        onChange={handleChange}
                        placeholder="https://linkedin.com/in/yourname"
                        className="flex-1 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-[10px] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:border-[var(--accent-orange)] outline-none transition-colors"
                      />
                      {profile?.linkedinUrl && (
                        <a
                          href={profile.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open LinkedIn"
                          className="flex-shrink-0 bg-[var(--bg-elevated)] text-[var(--text-primary)] p-2.5 rounded-[10px] border border-[var(--border-subtle)] hover:border-[var(--border-active)] transition-colors"
                        >
                          <LinkedInIcon />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* GitHub */}
                  <div>
                    <label className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.07em] mb-1.5 flex items-center gap-2">
                      <span className="text-[var(--text-primary)]"><GitHubIcon /></span>
                      GitHub URL
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        name="githubUrl"
                        value={profile?.githubUrl || ''}
                        onChange={handleChange}
                        placeholder="https://github.com/yourusername"
                        className="flex-1 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-[10px] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:border-[var(--accent-orange)] outline-none transition-colors"
                      />
                      {profile?.githubUrl && (
                        <a
                          href={profile.githubUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open GitHub"
                          className="flex-shrink-0 bg-[var(--bg-elevated)] text-[var(--text-primary)] p-2.5 rounded-[10px] border border-[var(--border-subtle)] hover:border-[var(--border-active)] transition-colors"
                        >
                          <GitHubIcon />
                        </a>
                      )}
                    </div>
                  </div>

                </div>
              </div>

              {/* Portfolio & Experience — Accordion */}
              <div className="window overflow-hidden">
                <div className="px-6 py-5 border-b border-[var(--border-subtle)]">
                  <h3 className="text-lg font-semibold tracking-[-0.02em]">Portfolio & Experience</h3>
                  <p className="text-sm text-[var(--text-tertiary)] mt-1">Click a section to expand and fill in your details</p>
                </div>

                <div className="divide-y divide-[var(--border-subtle)]">

                  {/* ── 1. Technical Skills ── */}
                  <AccordionPanel
                    label="Technical Skills"
                    hint="Comma separated"
                    isOpen={openSections.has('technicalSkills')}
                    hasContent={!!profile?.technicalSkills}
                    onToggle={() => toggleSection('technicalSkills')}
                  >
                    <input
                      type="text"
                      name="technicalSkills"
                      placeholder="e.g. React, Next.js, TypeScript, Python, SQL"
                      value={profile?.technicalSkills || ''}
                      onChange={handleChange}
                      className={fieldClass}
                    />
                  </AccordionPanel>

                  {/* ── 2. Education ── */}
                  <AccordionPanel
                    label="Education"
                    id="education"
                    isOpen={openSections.has('education')}
                    hasContent={educationEntries.length > 0}
                    onToggle={() => toggleSection('education')}
                  >
                    <div className="space-y-4">
                      {educationEntries.map((entry, i) => (
                        <div key={i} className={cardClass}>
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.07em]">Entry {i + 1}</span>
                            <button type="button" onClick={() => removeEntry(setEducationEntries, i)} className={removeBtnClass}>Remove</button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <input placeholder="Institution" value={entry.institution} onChange={e => updateEntry(setEducationEntries, i, 'institution', e.target.value)} className={fieldClass} />
                            <input placeholder="Degree / Program" value={entry.degree} onChange={e => updateEntry(setEducationEntries, i, 'degree', e.target.value)} className={fieldClass} />
                            <input placeholder="Location (optional)" value={entry.location} onChange={e => updateEntry(setEducationEntries, i, 'location', e.target.value)} className={fieldClass} />
                            <input placeholder="CGPA / Percentage (optional)" value={entry.cgpa} onChange={e => updateEntry(setEducationEntries, i, 'cgpa', e.target.value)} className={fieldClass} />
                            <input placeholder="From (e.g. Aug 2022)" value={entry.fromDate} onChange={e => updateEntry(setEducationEntries, i, 'fromDate', e.target.value)} className={fieldClass} />
                            <input placeholder="To (e.g. May 2026 or Present)" value={entry.toDate} onChange={e => updateEntry(setEducationEntries, i, 'toDate', e.target.value)} className={fieldClass} />
                          </div>
                        </div>
                      ))}
                      <button type="button" onClick={() => setEducationEntries(prev => [...prev, { institution: '', degree: '', fromDate: '', toDate: '', cgpa: '', location: '' }])} className={addBtnClass}>+ Add Education</button>
                    </div>
                  </AccordionPanel>

                  {/* ── 3. Experience ── */}
                  <AccordionPanel
                    label="Experience"
                    id="experience"
                    isOpen={openSections.has('experience')}
                    hasContent={experienceEntries.length > 0}
                    onToggle={() => toggleSection('experience')}
                  >
                    <div className="space-y-4">
                      {experienceEntries.map((entry, i) => (
                        <div key={i} className={cardClass}>
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.07em]">Entry {i + 1}</span>
                            <button type="button" onClick={() => removeEntry(setExperienceEntries, i)} className={removeBtnClass}>Remove</button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <input placeholder="Company / Organization" value={entry.company} onChange={e => updateEntry(setExperienceEntries, i, 'company', e.target.value)} className={fieldClass} />
                            <input placeholder="Role / Title" value={entry.role} onChange={e => updateEntry(setExperienceEntries, i, 'role', e.target.value)} className={fieldClass} />
                            <input placeholder="Location (optional)" value={entry.location} onChange={e => updateEntry(setExperienceEntries, i, 'location', e.target.value)} className={fieldClass} />
                            <input placeholder="From (e.g. Jun 2025)" value={entry.fromDate} onChange={e => updateEntry(setExperienceEntries, i, 'fromDate', e.target.value)} className={fieldClass} />
                            <input placeholder="To (e.g. Aug 2025 or Present)" value={entry.toDate} onChange={e => updateEntry(setExperienceEntries, i, 'toDate', e.target.value)} className={fieldClass} />
                          </div>
                          <textarea placeholder="Description / Key responsibilities" rows={3} value={entry.description} onChange={e => updateEntry(setExperienceEntries, i, 'description', e.target.value)} className={`${fieldClass} mt-3 resize-y`} />
                        </div>
                      ))}
                      <button type="button" onClick={() => setExperienceEntries(prev => [...prev, { company: '', role: '', fromDate: '', toDate: '', description: '', location: '' }])} className={addBtnClass}>+ Add Experience</button>
                    </div>
                  </AccordionPanel>

                  {/* ── 4. Projects ── */}
                  <AccordionPanel
                    label="Projects"
                    id="projects"
                    isOpen={openSections.has('projects')}
                    hasContent={projectEntries.length > 0}
                    onToggle={() => toggleSection('projects')}
                  >
                    <div className="space-y-4">
                      {projectEntries.map((entry, i) => (
                        <div key={i} className={cardClass}>
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.07em]">Entry {i + 1}</span>
                            <button type="button" onClick={() => removeEntry(setProjectEntries, i)} className={removeBtnClass}>Remove</button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <input placeholder="Project Title" value={entry.title} onChange={e => updateEntry(setProjectEntries, i, 'title', e.target.value)} className={fieldClass} />
                            <input placeholder="Tech Stack (e.g. React, Firebase)" value={entry.techStack} onChange={e => updateEntry(setProjectEntries, i, 'techStack', e.target.value)} className={fieldClass} />
                            <input placeholder="Location (optional)" value={entry.location} onChange={e => updateEntry(setProjectEntries, i, 'location', e.target.value)} className={fieldClass} />
                            <input placeholder="Link (optional)" value={entry.link} onChange={e => updateEntry(setProjectEntries, i, 'link', e.target.value)} className={fieldClass} />
                            <input placeholder="From (e.g. Jan 2025) — optional" value={entry.fromDate} onChange={e => updateEntry(setProjectEntries, i, 'fromDate', e.target.value)} className={fieldClass} />
                            <input placeholder="To (e.g. Mar 2025) — optional" value={entry.toDate} onChange={e => updateEntry(setProjectEntries, i, 'toDate', e.target.value)} className={fieldClass} />
                          </div>
                          <textarea placeholder="Description / Key highlights" rows={3} value={entry.description} onChange={e => updateEntry(setProjectEntries, i, 'description', e.target.value)} className={`${fieldClass} mt-3 resize-y`} />
                        </div>
                      ))}
                      <button type="button" onClick={() => setProjectEntries(prev => [...prev, { title: '', techStack: '', description: '', link: '', fromDate: '', toDate: '', location: '' }])} className={addBtnClass}>+ Add Project</button>
                    </div>
                  </AccordionPanel>

                  {/* ── 5. Achievements & Certifications ── */}
                  <AccordionPanel
                    label="Achievements & Certifications"
                    id="achievements"
                    isOpen={openSections.has('achievements')}
                    hasContent={achievementEntries.length > 0}
                    onToggle={() => toggleSection('achievements')}
                  >
                    <div className="space-y-4">
                      {achievementEntries.map((entry, i) => (
                        <div key={i} className={cardClass}>
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.07em]">Entry {i + 1}</span>
                            <button type="button" onClick={() => removeEntry(setAchievementEntries, i)} className={removeBtnClass}>Remove</button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <input placeholder="Title / Award" value={entry.title} onChange={e => updateEntry(setAchievementEntries, i, 'title', e.target.value)} className={fieldClass} />
                            <input placeholder="Issuer / Organization (optional)" value={entry.issuer} onChange={e => updateEntry(setAchievementEntries, i, 'issuer', e.target.value)} className={fieldClass} />
                            <input placeholder="Location (optional)" value={entry.location} onChange={e => updateEntry(setAchievementEntries, i, 'location', e.target.value)} className={fieldClass} />
                            <input placeholder="From (optional)" value={entry.fromDate} onChange={e => updateEntry(setAchievementEntries, i, 'fromDate', e.target.value)} className={fieldClass} />
                            <input placeholder="To (optional)" value={entry.toDate} onChange={e => updateEntry(setAchievementEntries, i, 'toDate', e.target.value)} className={fieldClass} />
                          </div>
                        </div>
                      ))}
                      <button type="button" onClick={() => setAchievementEntries(prev => [...prev, { title: '', issuer: '', fromDate: '', toDate: '', location: '' }])} className={addBtnClass}>+ Add Achievement</button>
                    </div>
                  </AccordionPanel>

                  {/* ── 6. Positions of Responsibility ── */}
                  <AccordionPanel
                    label="Positions of Responsibility"
                    id="positions"
                    isOpen={openSections.has('positions')}
                    hasContent={positionEntries.length > 0}
                    onToggle={() => toggleSection('positions')}
                  >
                    <div className="space-y-4">
                      {positionEntries.map((entry, i) => (
                        <div key={i} className={cardClass}>
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.07em]">Entry {i + 1}</span>
                            <button type="button" onClick={() => removeEntry(setPositionEntries, i)} className={removeBtnClass}>Remove</button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <input placeholder="Title / Role" value={entry.title} onChange={e => updateEntry(setPositionEntries, i, 'title', e.target.value)} className={fieldClass} />
                            <input placeholder="Organization / Club" value={entry.organization} onChange={e => updateEntry(setPositionEntries, i, 'organization', e.target.value)} className={fieldClass} />
                            <input placeholder="Location (optional)" value={entry.location} onChange={e => updateEntry(setPositionEntries, i, 'location', e.target.value)} className={fieldClass} />
                            <input placeholder="From (optional)" value={entry.fromDate} onChange={e => updateEntry(setPositionEntries, i, 'fromDate', e.target.value)} className={fieldClass} />
                            <input placeholder="To (optional)" value={entry.toDate} onChange={e => updateEntry(setPositionEntries, i, 'toDate', e.target.value)} className={fieldClass} />
                          </div>
                        </div>
                      ))}
                      <button type="button" onClick={() => setPositionEntries(prev => [...prev, { title: '', organization: '', fromDate: '', toDate: '', location: '' }])} className={addBtnClass}>+ Add Position</button>
                    </div>
                  </AccordionPanel>

                  {/* ── 7. Relevant Coursework ── */}
                  <AccordionPanel
                    label="Relevant Coursework"
                    hint="Comma separated"
                    isOpen={openSections.has('relevantCoursework')}
                    hasContent={!!profile?.relevantCoursework}
                    onToggle={() => toggleSection('relevantCoursework')}
                  >
                    <input
                      type="text"
                      name="relevantCoursework"
                      placeholder="e.g. Data Structures, Machine Learning, DBMS, Operating Systems"
                      value={profile?.relevantCoursework || ''}
                      onChange={handleChange}
                      className={fieldClass}
                    />
                  </AccordionPanel>

                  {/* ── 8. Extracurriculars / Activities ── */}
                  <AccordionPanel
                    label="Extracurriculars / Activities"
                    id="extracurriculars"
                    isOpen={openSections.has('extracurriculars')}
                    hasContent={extracurricularEntries.length > 0}
                    onToggle={() => toggleSection('extracurriculars')}
                  >
                    <div className="space-y-4">
                      {extracurricularEntries.map((entry, i) => (
                        <div key={i} className={cardClass}>
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.07em]">Entry {i + 1}</span>
                            <button type="button" onClick={() => removeEntry(setExtracurricularEntries, i)} className={removeBtnClass}>Remove</button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <input placeholder="Activity" value={entry.activity} onChange={e => updateEntry(setExtracurricularEntries, i, 'activity', e.target.value)} className={fieldClass} />
                            <input placeholder="Role (optional)" value={entry.role} onChange={e => updateEntry(setExtracurricularEntries, i, 'role', e.target.value)} className={fieldClass} />
                            <input placeholder="Location (optional)" value={entry.location} onChange={e => updateEntry(setExtracurricularEntries, i, 'location', e.target.value)} className={fieldClass} />
                            <input placeholder="From (optional)" value={entry.fromDate} onChange={e => updateEntry(setExtracurricularEntries, i, 'fromDate', e.target.value)} className={fieldClass} />
                            <input placeholder="To (optional)" value={entry.toDate} onChange={e => updateEntry(setExtracurricularEntries, i, 'toDate', e.target.value)} className={fieldClass} />
                            <input placeholder="Description (optional)" value={entry.description} onChange={e => updateEntry(setExtracurricularEntries, i, 'description', e.target.value)} className={`${fieldClass} sm:col-span-2`} />
                          </div>
                        </div>
                      ))}
                      <button type="button" onClick={() => setExtracurricularEntries(prev => [...prev, { activity: '', role: '', description: '', fromDate: '', toDate: '', location: '' }])} className={addBtnClass}>+ Add Activity</button>
                    </div>
                  </AccordionPanel>

                </div>
              </div>

              {/* Status Message */}
              {message && (
                <div className={`window p-4 text-center text-sm font-medium ${message.includes('success') ? '!border-[var(--status-success)]/40 text-[var(--status-success)]' : '!border-[var(--status-danger)]/40 text-[var(--status-danger)]'}`}>
                  {message}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={updating}
                className="btn-primary !rounded-[10px] w-full !py-3 text-sm font-semibold"
              >
                {updating ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </form>
        ) : (
          <div className="rounded-[14px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 sm:p-8 lg:p-10 animate-fade-in">
            <ProfilePreview
              detailed
              profile={profile}
              education={educationEntries}
              experience={experienceEntries}
              projects={projectEntries}
              achievements={achievementEntries}
              positions={positionEntries}
              extracurriculars={extracurricularEntries}
            />
          </div>
        )}
      </div>
    </div>
  );
}
