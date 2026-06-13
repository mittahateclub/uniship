// app/(protected)/user/resume/page.tsx
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, addDoc, serverTimestamp, getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { generateTailoredResume } from './actions';
import ATSScorePanel from './ats-score';
import Link from 'next/link';

interface ResumeData {
  fullName: string;
  phone: string;
  email: string;
  website: string;
  github: string;
  linkedin: string;
  education: string;
  experience: string;
  skills: string;
  projects: string;
  coursework: string;
  extracurriculars: string;
  achievements: string;
}

type ProfileEntry = {
  institution?: string;
  location?: string;
  fromDate?: string;
  toDate?: string;
  degree?: string;
  cgpa?: string;
  role?: string;
  company?: string;
  organization?: string;
  description?: string;
  title?: string;
  techStack?: string;
  issuer?: string;
  activity?: string;
};

type UserProfile = {
  name?: string;
  phone?: string;
  email?: string;
  website?: string;
  githubUrl?: string;
  linkedinUrl?: string;
  education?: string;
  experience?: string;
  technicalSkills?: string;
  projects?: string;
  relevantCoursework?: string;
  extracurriculars?: string;
  achievements?: string;
  educationEntries?: ProfileEntry[];
  experienceEntries?: ProfileEntry[];
  projectEntries?: ProfileEntry[];
  achievementEntries?: ProfileEntry[];
  extracurricularEntries?: ProfileEntry[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapProfileToResumeData(profile: UserProfile): Partial<ResumeData> {
  const fmtEdu = (entries: ProfileEntry[]) => entries?.map(e =>
    `${e.institution} | ${e.location || ''} | ${e.fromDate} – ${e.toDate}\n${e.degree}${e.cgpa ? ` – GPA: ${e.cgpa}` : ''}`
  ).join('\n\n') || '';

  const fmtExp = (entries: ProfileEntry[]) => entries?.map(e =>
    `${e.role} | ${e.fromDate} – ${e.toDate}\n${e.company} | ${e.location || ''}\n${e.description?.split('\n').map((l: string) => `- ${l.replace(/^[-•]\s*/, '')}`).join('\n') || ''}`
  ).join('\n\n') || '';

  const fmtProj = (entries: ProfileEntry[]) => entries?.map(e =>
    `${e.title} | ${e.techStack || ''} | ${e.fromDate} – ${e.toDate}\n${e.description?.split('\n').map((l: string) => `- ${l.replace(/^[-•]\s*/, '')}`).join('\n') || ''}`
  ).join('\n\n') || '';

  const fmtAch = (entries: ProfileEntry[]) => entries?.map(e =>
    `${e.title} – ${e.issuer || ''} | ${e.fromDate}`
  ).join('\n') || '';

  const fmtPos = (entries: ProfileEntry[]) => entries?.map(e =>
    `${e.title} | ${e.organization} | ${e.fromDate} – ${e.toDate}`
  ).join('\n') || '';
  void fmtPos;

  const fmtExtra = (entries: ProfileEntry[]) => entries?.map(e =>
    `${e.activity} | ${e.role || ''} | ${e.fromDate} – ${e.toDate}`
  ).join('\n') || '';

  return {
    fullName:         profile.name               || '',
    phone:            profile.phone              || '',
    email:            profile.email              || '',
    website:          profile.website            || '',
    github:           profile.githubUrl          || '',
    linkedin:         profile.linkedinUrl        || '',
    education:        (profile.educationEntries?.length ? fmtEdu(profile.educationEntries) : profile.education) || '',
    experience:       (profile.experienceEntries?.length ? fmtExp(profile.experienceEntries) : profile.experience) || '',
    skills:           profile.technicalSkills    || '',
    projects:         (profile.projectEntries?.length ? fmtProj(profile.projectEntries) : profile.projects) || '',
    coursework:       profile.relevantCoursework || '',
    extracurriculars: (profile.extracurricularEntries?.length ? fmtExtra(profile.extracurricularEntries) : profile.extracurriculars) || '',
    achievements:     (profile.achievementEntries?.length ? fmtAch(profile.achievementEntries) : profile.achievements) || '',
  };
}

// ─── Live Preview Component ───────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mt-4 mb-1">
      <h2
        className="text-[12px] font-semibold tracking-[0.07em] uppercase"
        style={{ fontVariant: 'small-caps' }}
      >
        {title}
      </h2>
      <hr className="border-t border-black mt-0.5" />
    </div>
  );
}

function ResumePreview({ data, keywords }: { data: ResumeData; keywords: string[] }) {
  const hasContent = (val: string) => val && val.trim().length > 0;

  // Highlight keywords in text
  const highlightText = (text: string) => {
    if (!keywords.length) return text;
    const escaped = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern = new RegExp(`(${escaped.join('|')})`, 'gi');
    return text.replace(pattern, '<mark class="bg-yellow-200/70 text-black px-0.5 rounded-sm">$1</mark>');
  };

  // Converts **text** → <strong>text</strong>, then highlights keywords
  const boldMarkdown = (text: string) => {
    const bolded = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    return highlightText(bolded);
  };

  const renderBullets = (text: string) => {
    const lines = text.split('\n').filter(l => l.trim().length > 0);
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

  const parseEducation = (raw: string) => {
    if (!hasContent(raw)) return null;
    return raw.split(/\n\n+/).map((block, i) => {
      const lines = block.split('\n').filter(l => l.trim());
      const parts   = (lines[0] || '').split('|').map(p => p.trim());
      const bullets = lines.slice(2);
      return (
        <div key={i} className="mb-2">
          <div className="flex justify-between items-baseline">
            <span className="font-semibold text-[11.5px]"
              dangerouslySetInnerHTML={{ __html: boldMarkdown(parts[0]) }} />
            <span className="text-[10.5px]">{parts[1]}</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="italic text-[10.5px]"
              dangerouslySetInnerHTML={{ __html: boldMarkdown(lines[1] || '') }} />
            <span className="text-[10.5px]">{parts[2]}</span>
          </div>
          {bullets.length > 0 && renderBullets(bullets.join('\n'))}
        </div>
      );
    });
  };

  const parseExperience = (raw: string) => {
    if (!hasContent(raw)) return null;
    return raw.split(/\n\n+/).map((block, i) => {
      const lines    = block.split('\n').filter(l => l.trim());
      const dateParts = (lines[0] || '').split('|').map(p => p.trim());
      const orgParts  = (lines[1] || '').split('|').map(p => p.trim());
      const bullets   = lines.slice(2);
      return (
        <div key={i} className="mb-3">
          <div className="flex justify-between items-baseline">
            <span className="font-semibold text-[11.5px]"
              dangerouslySetInnerHTML={{ __html: boldMarkdown(dateParts[0]) }} />
            <span className="text-[10.5px]">{dateParts[1]}</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="italic text-[10.5px]"
              dangerouslySetInnerHTML={{ __html: boldMarkdown(orgParts[0]) }} />
            {orgParts[1] && <span className="text-[10.5px]">{orgParts[1]}</span>}
          </div>
          {bullets.length > 0 && renderBullets(bullets.join('\n'))}
        </div>
      );
    });
  };

  const parseProjects = (raw: string) => {
    if (!hasContent(raw)) return null;
    return raw.split(/\n\n+/).map((block, i) => {
      const lines   = block.split('\n').filter(l => l.trim());
      const parts   = (lines[0] || '').split('|').map(p => p.trim());
      const bullets = lines.slice(1);
      return (
        <div key={i} className="mb-3">
          <div className="flex justify-between items-baseline">
            <span>
              <span className="font-semibold text-[11.5px]"
                dangerouslySetInnerHTML={{ __html: boldMarkdown(parts[0]) }} />
              {parts[1] && (
                <span className="text-[10.5px] italic"
                  dangerouslySetInnerHTML={{ __html: ` | ${boldMarkdown(parts[1])}` }} />
              )}
            </span>
            <span className="text-[10.5px]">{parts[2]}</span>
          </div>
          {bullets.length > 0 && renderBullets(bullets.join('\n'))}
        </div>
      );
    });
  };

  const parseExtracurriculars = (raw: string) => {
    if (!hasContent(raw)) return null;
    return raw.split(/\n+/).filter(l => l.trim()).map((line, i) => {
      const parts = line.split('|').map(p => p.trim());
      return (
        <div key={i} className="flex justify-between items-baseline mb-1">
          <span className="font-semibold text-[11px]"
            dangerouslySetInnerHTML={{ __html: highlightText(`${parts[0]}${parts[1] ? ` | ${parts[1]}` : ''}`) }} />
          <span className="text-[10.5px]">{parts[2]}</span>
        </div>
      );
    });
  };

  const parseAchievements = (raw: string) => {
    if (!hasContent(raw)) return null;
    return raw.split(/\n+/).filter(l => l.trim()).map((line, i) => {
      const pipeIdx = line.lastIndexOf('|');
      const desc = pipeIdx > -1 ? line.slice(0, pipeIdx).trim() : line.trim();
      const date = pipeIdx > -1 ? line.slice(pipeIdx + 1).trim() : '';
      const dashIdx = desc.indexOf('–');
      const title = dashIdx > -1 ? desc.slice(0, dashIdx).trim() : desc;
      const sub   = dashIdx > -1 ? desc.slice(dashIdx + 1).trim() : '';
      return (
        <div key={i} className="flex justify-between items-baseline mb-1">
          <span className="text-[11px]">
            <span className="font-semibold underline" dangerouslySetInnerHTML={{ __html: highlightText(title) }} />
            {sub && <span dangerouslySetInnerHTML={{ __html: ` – ${highlightText(sub)}` }} />}
          </span>
          <span className="text-[10.5px]">{date}</span>
        </div>
      );
    });
  };

  const renderSkills = (raw: string) => {
    return (
      <div className="text-[11px] leading-relaxed space-y-0.5">
        {raw.split('\n').filter(l => l.trim()).map((line, i) => {
          const parts = line.split(/(\*\*[^*]+\*\*)/g);
          return (
            <div key={i}>
              {parts.map((part, j) =>
                part.startsWith('**') && part.endsWith('**')
                  ? <strong key={j} dangerouslySetInnerHTML={{ __html: highlightText(part.slice(2, -2)) }} />
                  : <span key={j} dangerouslySetInnerHTML={{ __html: highlightText(part) }} />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const contactItems = [
    data.website,
    data.email,
    data.phone,
    data.linkedin ? data.linkedin.replace('https://', '') : '',
    data.github   ? data.github.replace('https://', '')   : '',
  ].filter(Boolean);

  return (
    <div
      className="bg-white text-black font-serif"
      style={{
        width: '210mm',
        minHeight: '297mm',
        padding: '18mm',
        fontSize: '11px',
        lineHeight: '1.4',
        boxSizing: 'border-box',
      }}
    >
      {/* Name */}
      <div className="text-center mb-1">
        <h1 className="text-[28px] font-bold tracking-tight leading-tight">
          {data.fullName || 'Your Name'}
        </h1>
      </div>

      {/* Contact Row */}
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

      {hasContent(data.education) && (
        <><SectionHeader title="Education" />{parseEducation(data.education)}</>
      )}
      {hasContent(data.experience) && (
        <><SectionHeader title="Experience" />{parseExperience(data.experience)}</>
      )}
      {hasContent(data.projects) && (
        <><SectionHeader title="Projects" />{parseProjects(data.projects)}</>
      )}
      {hasContent(data.coursework) && (
        <>
          <SectionHeader title="Relevant Coursework" />
          <p className="text-[11px] leading-relaxed" dangerouslySetInnerHTML={{ __html: highlightText(data.coursework) }} />
        </>
      )}
      {hasContent(data.skills) && (
        <>
          <SectionHeader title="Technical Skills" />
          {renderSkills(data.skills)}
        </>
      )}
      {hasContent(data.extracurriculars) && (
        <><SectionHeader title="Extracurriculars / Activities" />{parseExtracurriculars(data.extracurriculars)}</>
      )}
      {hasContent(data.achievements) && (
        <><SectionHeader title="Achievements & Certifications" />{parseAchievements(data.achievements)}</>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ResumeBuilder() {
  const { user } = useAuth();
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [generating, setGenerating] = useState(false);

  const [companyName, setCompanyName]           = useState('');
  const [jobDescription, setJobDescription]     = useState('');
  const [baseProfileData, setBaseProfileData]   = useState<UserProfile | null>(null);
  const [keywords, setKeywords]                 = useState<string[]>([]);

  const emptyForm: ResumeData = {
    fullName: '', phone: '', email: '', website: '',
    github: '', linkedin: '', education: '', experience: '',
    skills: '', projects: '', coursework: '', extracurriculars: '', achievements: '',
  };

  const [formData, setFormData] = useState<ResumeData>(emptyForm);

  // Scale the A4 live preview to fill the preview width. The page scroll owns overflow.
  const previewColRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);
  useEffect(() => {
    const el = previewColRef.current;
    if (!el) return;
    const A4_WIDTH = 794; // 210mm at ~96dpi
    const compute = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setPreviewScale(Math.max(0.1, (w - 2) / A4_WIDTH));
    };
    const frame = requestAnimationFrame(compute);
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    window.addEventListener('resize', compute);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, []);

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      try {
        const profileSnap = await getDoc(doc(db, 'users', user.uid));
        if (profileSnap.exists()) {
          const profileData = profileSnap.data();
          setBaseProfileData(profileData);
          setFormData(prev => ({ ...prev, ...mapProfileToResumeData(profileData) }));
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user]);

  // Count profile completeness
  const profileStats = useMemo(() => {
    if (!baseProfileData) return null;
    const fields = [
      { label: 'Name & Contact', filled: !!(baseProfileData.name && baseProfileData.email) },
      { label: 'Education', filled: !!(baseProfileData.educationEntries?.length || baseProfileData.education) },
      { label: 'Experience', filled: !!(baseProfileData.experienceEntries?.length || baseProfileData.experience) },
      { label: 'Projects', filled: !!(baseProfileData.projectEntries?.length || baseProfileData.projects) },
      { label: 'Skills', filled: !!baseProfileData.technicalSkills },
      { label: 'Achievements', filled: !!(baseProfileData.achievementEntries?.length || baseProfileData.achievements) },
    ];
    return fields;
  }, [baseProfileData]);

  const profileCompletion = useMemo(() => {
    if (!profileStats?.length) return 0;
    return Math.round((profileStats.filter(f => f.filled).length / profileStats.length) * 100);
  }, [profileStats]);

  const jobWordCount = useMemo(() => {
    return jobDescription.trim().split(/\s+/).filter(Boolean).length;
  }, [jobDescription]);

  const handleGenerateAI = async () => {
    if (!companyName || !jobDescription) {
      alert('Please enter both the company name and job description.');
      return;
    }
    if (!baseProfileData) {
      alert('No profile data found. Please fill out your Student Profile first.');
      return;
    }

    setGenerating(true);
    try {
      const plainProfileData = JSON.parse(JSON.stringify(baseProfileData));
      const generated = await generateTailoredResume(plainProfileData, companyName, jobDescription);

      setFormData(prev => ({
        ...prev,
        fullName:         generated.fullName         || prev.fullName,
        phone:            generated.phone            || prev.phone,
        email:            generated.email            || prev.email,
        website:          generated.website          || prev.website,
        github:           generated.github           || prev.github,
        linkedin:         generated.linkedin         || prev.linkedin,
        education:        generated.education        || prev.education,
        experience:       generated.experience       || prev.experience,
        skills:           generated.skills           || prev.skills,
        projects:         generated.projects         || prev.projects,
        coursework:       generated.coursework       || prev.coursework,
        extracurriculars: generated.extracurriculars || prev.extracurriculars,
        achievements:     generated.achievements     || prev.achievements,
      }));

      if (generated.keywords && Array.isArray(generated.keywords)) {
        setKeywords(generated.keywords);
      }
    } catch (error) {
      console.error(error);
      alert('Failed to generate AI resume. Check console for details.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'resumes'), {
        ...formData,
        targetCompany: companyName || 'General Resume',
        keywords,
        updatedAt:     serverTimestamp(),
        userId:        user.uid,
        userEmail:     user.email,
      });
      alert('Resume saved! You can view it in the Export page.');
    } catch (error) {
      console.error('Error saving resume:', error);
      alert('Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center py-24">
        <div className="loading-dots"><span /><span /><span /></div>
      </div>
    );

  return (
    <div className="animate-fade-in">
      <div className="max-w-[1200px] mx-auto">

        {/* Header */}
        <div className="pt-8 mb-7 flex flex-wrap justify-between items-end gap-3">
          <div>
            <h1 className="text-[26px] font-semibold tracking-[-0.025em] text-[var(--text-primary)]">Resume Builder</h1>
            <p className="text-[var(--text-tertiary)] text-[13.5px] mt-1.5">
              Data is pulled from your profile. Use AI to tailor it for a specific role.
            </p>
          </div>
          <Link
            href="/user/resume/download"
            className="btn-secondary inline-flex items-center gap-2 !rounded-[10px] !px-4 !py-2.5 text-xs font-semibold"
          >
            View Saved Resumes →
          </Link>
        </div>

        {/* Controls (left) + live preview (right) */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(320px,380px)_1fr] gap-6 items-start">

          {/* ── LEFT: All controls ── */}
          <div className="space-y-5">

            {/* AI Section */}
            <section className="window p-6" id="ai-tailor">
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center bg-[var(--accent-orange)] text-[var(--accent-ink)] px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.05em] rounded-full">
                  AI
                </span>
                <h2 className="text-sm font-semibold">Tailor for a Job</h2>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mb-4">
                Paste the job description and the AI will rewrite your resume to match the role, highlighting relevant keywords.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.07em] mb-1.5 block">Target Company</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-[10px] px-3.5 py-2.5 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-orange)] transition-colors"
                    placeholder="e.g. Google, Vercel…"
                  />
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <label className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.07em]">Job Description</label>
                    <span className="text-[10px] text-[var(--text-faint)]">{jobWordCount} words</span>
                  </div>
                  <textarea
                    value={jobDescription}
                    onChange={e => setJobDescription(e.target.value)}
                    rows={7}
                    className="min-h-[180px] w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-[10px] px-3.5 py-2.5 text-[13px] leading-5 text-[var(--text-primary)] outline-none resize-y focus:border-[var(--accent-orange)] transition-colors"
                    placeholder="Paste the full JD here…"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleGenerateAI}
                  disabled={generating}
                  className="btn-primary inline-flex w-full items-center justify-center !rounded-[10px] !py-3 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generating ? 'Analyzing JD & tailoring resume…' : 'Generate Tailored Resume'}
                </button>
              </div>
            </section>

            {/* Profile data status */}
            {profileStats && (
              <section className="window p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">Profile Source</h2>
                    <p className="text-[11px] text-[var(--text-muted)]">{profileCompletion}% complete</p>
                  </div>
                  <Link href="/user/profile" className="text-[11.5px] font-medium text-[var(--accent-orange)] hover:underline">
                    Edit Profile →
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {profileStats.map(f => (
                    <div key={f.label} className={`flex min-h-10 items-center gap-2 px-3 py-2 rounded-[9px] border text-[11px] font-medium ${
                      f.filled
                        ? 'bg-[var(--status-success)]/8 border-[var(--status-success)]/20 text-[var(--status-success)]'
                        : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-faint)]'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${f.filled ? 'bg-[var(--status-success)]' : 'bg-[var(--text-faint)]'}`} />
                      {f.label}
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-[var(--text-faint)] mt-2">
                  The resume is built from your profile. Fill in more sections for a richer resume.
                </p>
              </section>
            )}

            {/* ATS score */}
            <ATSScorePanel data={formData} keywords={keywords} />

            {/* Keywords */}
            {keywords.length > 0 && (
              <section className="window p-5">
                <h2 className="text-[13px] font-semibold text-[var(--text-primary)] mb-2">Matched Keywords</h2>
                <p className="text-[10px] text-[var(--text-faint)] mb-3">These keywords from the JD are highlighted in your resume preview.</p>
                <div className="flex flex-wrap gap-1.5">
                  {keywords.map((kw, i) => (
                    <span key={i} className="px-2.5 py-[3px] rounded-full text-[10px] font-medium bg-yellow-200/60 text-yellow-900">
                      {kw}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary inline-flex w-full items-center justify-center !rounded-[10px] !py-3 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : 'Save Resume'}
            </button>
          </div>

          {/* ── RIGHT: Live preview, scaled to fit (no scroll) ── */}
          <div>
            <div className="window overflow-hidden">
              <div ref={previewColRef} className="overflow-hidden bg-[var(--bg-primary)]">
                <div
                  style={{
                    height: `${1123 * previewScale}px`,
                    overflow: 'hidden',
                    width: '100%',
                  }}
                >
                <div
                  style={{
                    transform: `scale(${previewScale})`,
                    transformOrigin: 'top left',
                    width: '210mm',
                  }}
                >
                  <ResumePreview data={formData} keywords={keywords} />
                </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
