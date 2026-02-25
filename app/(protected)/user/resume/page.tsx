// app/(protected)/user/resume/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, addDoc, serverTimestamp, getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { generateTailoredResume } from './actions';
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapProfileToResumeData(profile: any): Partial<ResumeData> {
  return {
    fullName:         profile.name               || '',
    phone:            profile.phone              || '',
    email:            profile.email              || '',
    website:          profile.website            || '',
    github:           profile.githubUrl          || '',
    linkedin:         profile.linkedinUrl        || '',
    education:        profile.education          || '',
    experience:       profile.experience         || '',
    skills:           profile.technicalSkills    || '',
    projects:         profile.projects           || '',
    coursework:       profile.relevantCoursework || '',
    extracurriculars: profile.extracurriculars   || '',
    achievements:     [profile.achievements, profile.positions]
                        .filter(Boolean).join('\n') || '',
  };
}

// ─── Live Preview Component ───────────────────────────────────────────────────

function ResumePreview({ data }: { data: ResumeData }) {
  const hasContent = (val: string) => val && val.trim().length > 0;

  // Converts **text** → <strong>text</strong>
  const boldMarkdown = (text: string) =>
    text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

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
            <span className="font-bold text-[11.5px]"
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
            <span className="font-bold text-[11.5px]"
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
              <span className="font-bold text-[11.5px]"
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
          <span className="font-bold text-[11px]">
            {parts[0]}{parts[1] ? ` | ${parts[1]}` : ''}
          </span>
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
            <span className="font-bold underline">{title}</span>
            {sub && <span> – {sub}</span>}
          </span>
          <span className="text-[10.5px]">{date}</span>
        </div>
      );
    });
  };

  // Skills: split by newline, parse bold inline per line
  const renderSkills = (raw: string) => {
    return (
      <div className="text-[11px] leading-relaxed space-y-0.5">
        {raw.split('\n').filter(l => l.trim()).map((line, i) => {
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
  };

  const SectionHeader = ({ title }: { title: string }) => (
    <div className="mt-4 mb-1">
      <h2
        className="text-[12px] font-bold tracking-widest uppercase"
        style={{ fontVariant: 'small-caps' }}
      >
        {title}
      </h2>
      <hr className="border-t border-black mt-0.5" />
    </div>
  );

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
        <h1 className="text-[28px] font-extrabold tracking-tight leading-tight">
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
          <p className="text-[11px] leading-relaxed">{data.coursework}</p>
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
  const [baseProfileData, setBaseProfileData]   = useState<any>(null);

  const emptyForm: ResumeData = {
    fullName: '', phone: '', email: '', website: '',
    github: '', linkedin: '', education: '', experience: '',
    skills: '', projects: '', coursework: '', extracurriculars: '', achievements: '',
  };

  const [formData, setFormData] = useState<ResumeData>(emptyForm);

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      try {
        const resumeSnap = await getDoc(doc(db, 'resumes', user.uid));
        if (resumeSnap.exists()) {
          setFormData(prev => ({ ...prev, ...(resumeSnap.data() as Partial<ResumeData>) }));
        }

        const profileSnap = await getDoc(doc(db, 'users', user.uid));
        if (profileSnap.exists()) {
          const profileData = profileSnap.data();
          setBaseProfileData(profileData);
          if (!resumeSnap.exists()) {
            setFormData(prev => ({ ...prev, ...mapProfileToResumeData(profileData) }));
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user]);

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
    } catch (error) {
      console.error(error);
      alert('Failed to generate AI resume. Check console for details.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'resumes'), {
        ...formData,
        targetCompany: companyName || 'General Resume',
        updatedAt:     serverTimestamp(),
        userEmail:     user.email,
      });
      alert('New Resume Variant saved! You can view it in the Export page.');
    } catch (error) {
      console.error('Error saving resume:', error);
      alert('Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const field = (
    label: string,
    key: keyof ResumeData,
    multiline = false,
    placeholder = '',
    rows = 4
  ) => (
    <div>
      <label className="block text-xs font-black uppercase mb-1 tracking-wide">{label}</label>
      {multiline ? (
        <textarea
          value={formData[key]}
          onChange={e => setFormData({ ...formData, [key]: e.target.value })}
          rows={rows}
          className="w-full border-2 border-black p-2 text-sm outline-none font-mono resize-y focus:bg-gray-50"
          placeholder={placeholder}
        />
      ) : (
        <input
          type="text"
          value={formData[key]}
          onChange={e => setFormData({ ...formData, [key]: e.target.value })}
          className="w-full border-2 border-black p-2 text-sm outline-none font-mono focus:bg-gray-50"
          placeholder={placeholder}
        />
      )}
    </div>
  );

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-black font-bold uppercase">
        Loading Resume Builder...
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-100 p-6 text-black">
      <div className="max-w-screen-2xl mx-auto">

        {/* Header */}
        <div className="border-b-4 border-black pb-4 mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tighter">Resume Builder</h1>
            <p className="text-gray-500 text-sm font-bold mt-1 italic">
              Your profile data is pre-loaded. Use AI to tailor it for a specific role.
            </p>
          </div>
          <Link
            href="/user/resume/download"
            className="border-2 border-black px-4 py-2 text-xs font-black uppercase tracking-widest hover:bg-black hover:text-white transition-colors"
          >
            View Saved Resumes →
          </Link>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">

          {/* ── LEFT: Editor ── */}
          <div className="space-y-6">

            {/* AI Section */}
            <section className="border-4 border-black p-6 bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <h2 className="text-lg font-black uppercase mb-1 bg-black text-white inline-block px-3 py-0.5">
                Auto-Tailor via AI
              </h2>
              <p className="text-xs font-bold uppercase text-gray-500 mb-4">
                All your profile fields are fed to the AI automatically.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-black uppercase mb-1">Target Company</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    className="w-full border-2 border-black p-2 text-sm outline-none font-mono"
                    placeholder="e.g. Google, Vercel…"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase mb-1">Job Description</label>
                  <textarea
                    value={jobDescription}
                    onChange={e => setJobDescription(e.target.value)}
                    rows={4}
                    className="w-full border-2 border-black p-2 text-sm outline-none font-mono resize-y"
                    placeholder="Paste the full JD here…"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleGenerateAI}
                  disabled={generating}
                  className="w-full bg-black text-white py-2.5 text-sm font-black uppercase tracking-widest hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generating ? 'Synthesizing all profile fields…' : '✦ Generate Tailored Resume'}
                </button>
              </div>
            </section>

            {/* Form */}
            <form onSubmit={handleSave} className="space-y-6">

              <section className="border-4 border-black p-6 bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <h2 className="text-lg font-black uppercase mb-4 bg-black text-white inline-block px-3 py-0.5">01. Personal Info</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">{field('Full Name', 'fullName', false, 'Pranav Reddy Mitta')}</div>
                  {field('Email', 'email', false, 'email@example.com')}
                  {field('Phone', 'phone', false, '+91 99999 99999')}
                  {field('Website', 'website', false, 'itsbypranav.com')}
                  {field('LinkedIn URL', 'linkedin', false, 'linkedin.com/in/…')}
                  {field('GitHub URL', 'github', false, 'github.com/…')}
                </div>
              </section>

              <section className="border-4 border-black p-6 bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <h2 className="text-lg font-black uppercase mb-2 bg-black text-white inline-block px-3 py-0.5">02. Education</h2>
                <p className="text-[10px] font-bold text-gray-500 uppercase mb-3">
                  Institution | Location | Date · Next line: Degree · Then - bullets · Blank line between entries
                </p>
                {field('Education', 'education', true,
                  'Mahindra University | Hyderabad, IN | Aug. 2023 – Present\nB.Tech in CSE – GPA: 9.14\n- Relevant info\n\nIIIT Hyderabad | Hyderabad, IN | Sep. 2024 – Mar. 2025\nStudent Training Program on AIML',
                  8)}
              </section>

              <section className="border-4 border-black p-6 bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <h2 className="text-lg font-black uppercase mb-2 bg-black text-white inline-block px-3 py-0.5">03. Experience</h2>
                <p className="text-[10px] font-bold text-gray-500 uppercase mb-3">
                  Role — Title | Date · Next line: Org | Location · Then - bullets · Blank line between entries
                </p>
                {field('Experience', 'experience', true,
                  'Head of Tech — Mathematics Society | Aug. 2024 — Present\nMahindra University | Hyderabad, IN\n- **Rebuilt** the Math Club website using Next.js and Firebase.',
                  10)}
              </section>

              <section className="border-4 border-black p-6 bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <h2 className="text-lg font-black uppercase mb-2 bg-black text-white inline-block px-3 py-0.5">04. Projects</h2>
                <p className="text-[10px] font-bold text-gray-500 uppercase mb-3">
                  Project Name | Tech Stack | Date · Then - bullets · Blank line between entries
                </p>
                {field('Projects', 'projects', true,
                  'Stock Trading Simulator | Next.js, Firebase | Apr. 2025\n- Built a **400+ participant** simulation platform.',
                  10)}
              </section>

              <section className="border-4 border-black p-6 bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <h2 className="text-lg font-black uppercase mb-2 bg-black text-white inline-block px-3 py-0.5">05. Relevant Coursework</h2>
                {field('Coursework (comma separated)', 'coursework', false,
                  'Data Structures and Algorithms, Linear Algebra, Statistics and Probability…')}
              </section>

              <section className="border-4 border-black p-6 bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <h2 className="text-lg font-black uppercase mb-2 bg-black text-white inline-block px-3 py-0.5">06. Technical Skills</h2>
                <p className="text-[10px] font-bold text-gray-500 uppercase mb-3">
                  Use: Languages: …(newline) Frameworks: …(newline) Tools: … — wrap tech names in **bold** if desired
                </p>
                {field('Technical Skills', 'skills', true,
                  'Languages: Python, TypeScript, JavaScript\nFrameworks: Next.js, React, Tailwind CSS\nTools: Firebase, Vercel, Git',
                  5)}
              </section>

              <section className="border-4 border-black p-6 bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <h2 className="text-lg font-black uppercase mb-2 bg-black text-white inline-block px-3 py-0.5">07. Extracurriculars</h2>
                <p className="text-[10px] font-bold text-gray-500 uppercase mb-3">
                  Title | Organization | Date · One per line
                </p>
                {field('Extracurriculars', 'extracurriculars', true,
                  'Head of Design and Tech | Mathematics Society | Aug. 2024 – Present\nHead of Tech | The Echo | Aug. 2024 – Present',
                  4)}
              </section>

              <section className="border-4 border-black p-6 bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <h2 className="text-lg font-black uppercase mb-2 bg-black text-white inline-block px-3 py-0.5">08. Achievements & Certifications</h2>
                <p className="text-[10px] font-bold text-gray-500 uppercase mb-3">
                  Award Name – Description | Date · One per line
                </p>
                {field('Achievements', 'achievements', true,
                  'Academic Excellence Award – First Year, Mahindra University | Nov. 2024\nHacktoberfest 2024 Contributor – Open-source contributions in AI/ML | Oct. 2024',
                  4)}
              </section>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-black text-white py-4 text-lg font-black uppercase tracking-widest hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving…' : 'Save Resume'}
              </button>
            </form>
          </div>

          {/* ── RIGHT: Live Preview ── */}
          <div className="xl:sticky xl:top-6">
            <div className="border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white overflow-hidden">
              <div className="bg-black text-white px-4 py-3 flex justify-between items-center">
                <span className="text-sm font-black uppercase tracking-widest">Live Preview</span>
                <span className="text-[10px] font-bold uppercase bg-white text-black px-2 py-0.5">A4 Format</span>
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 140px)' }}>
                <ResumePreview data={formData} />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}