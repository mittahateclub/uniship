// app/(protected)/user/resume/download/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { FileText, ArrowLeft, Download } from 'lucide-react';

// ─── Shared ResumeData type ───────────────────────────────────────────────────

interface ResumeData {
  id?: string;
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
  targetCompany?: string;
  updatedAt?: any;
}

// ─── ResumePreview (identical to page.tsx) ───────────────────────────────────

function ResumePreview({ data }: { data: ResumeData }) {
  const hasContent = (val: string) => val && val.trim().length > 0;

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
      const lines   = block.split('\n').filter(l => l.trim());
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
      const lines     = block.split('\n').filter(l => l.trim());
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

  // Skills: parse bold inline per line
  const renderSkills = (raw: string) => (
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

// ─── Main Download Page ───────────────────────────────────────────────────────

export default function DownloadResume() {
  const { user } = useAuth();
  const [loading, setLoading]               = useState(true);
  const [isDownloading, setIsDownloading]   = useState(false);
  const [resumes, setResumes]               = useState<ResumeData[]>([]);
  const [selectedResume, setSelectedResume] = useState<ResumeData | null>(null);

  useEffect(() => {
    async function fetchResumes() {
      if (!user) return;
      try {
        const q = query(
          collection(db, 'resumes'),
          where('userEmail', '==', user.email)
        );
        const querySnapshot = await getDocs(q);

        const fetchedResumes = querySnapshot.docs.map(docSnap => ({
          id: docSnap.id,
          fullName: '', phone: '', email: '', website: '',
          github: '', linkedin: '', education: '', experience: '',
          skills: '', projects: '', coursework: '', extracurriculars: '', achievements: '',
          ...docSnap.data(),
        })) as ResumeData[];

        fetchedResumes.sort((a, b) => {
          const timeA = a.updatedAt?.seconds || 0;
          const timeB = b.updatedAt?.seconds || 0;
          return timeB - timeA;
        });

        setResumes(fetchedResumes);
      } catch (error) {
        console.error('Error fetching resumes:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchResumes();
  }, [user]);

  const handleDownloadPDF = async () => {
    const element = document.getElementById('resume-pdf-container');
    if (!element || !selectedResume) return;

    setIsDownloading(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const fileName = `${selectedResume.fullName?.replace(/\s+/g, '_') || 'My'}_Resume.pdf`;
      const opt = {
        margin:      0,
        filename:    fileName,
        image:       { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
      };
      await html2pdf().set(opt).from(element).save();
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f4f4] text-black font-black uppercase">
        Loading Your Resumes...
      </div>
    );
  }

  // ── Empty state ──
  if (resumes.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f4f4f4] text-black p-8">
        <h1 className="text-3xl font-black uppercase mb-4">No Resumes Found</h1>
        <p className="font-bold mb-8 text-gray-600">
          You haven't generated or saved any resumes yet.
        </p>
        <Link
          href="/user/resume"
          className="bg-black text-white px-8 py-3 font-black uppercase tracking-widest hover:bg-gray-800 transition-all shadow-[4px_4px_0px_0px_rgba(150,150,150,1)] active:translate-y-1 active:shadow-none"
        >
          Go to Builder
        </Link>
      </div>
    );
  }

  // ── Resume list grid ──
  if (!selectedResume) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] p-8 text-black">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-end mb-10 border-b-8 border-black pb-6">
            <div>
              <h1 className="text-5xl font-black uppercase tracking-tighter">My Resumes</h1>
              <p className="text-gray-600 font-bold mt-2 uppercase text-sm">
                Select a tailored resume to preview or download as PDF.
              </p>
            </div>
            <Link
              href="/user/resume"
              className="bg-black text-white px-6 py-3 font-black uppercase tracking-widest hover:bg-gray-800 transition-all shadow-[4px_4px_0px_0px_rgba(150,150,150,1)] active:translate-y-1 active:shadow-none hidden md:block"
            >
              + Create New
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {resumes.map((resume, idx) => (
              <div
                key={resume.id}
                className="bg-white border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-2 hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-orange-100 p-3 rounded-full text-orange-600 border-2 border-black">
                      <FileText size={24} />
                    </div>
                    <div>
                      <h3 className="font-black uppercase text-xl truncate">
                        {resume.targetCompany || `Resume Variant ${resumes.length - idx}`}
                      </h3>
                      <p className="text-xs font-bold text-gray-500 uppercase">
                        {resume.updatedAt
                          ? new Date(resume.updatedAt.seconds * 1000).toLocaleDateString()
                          : 'Draft'}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-gray-700 mb-6 line-clamp-3">
                    <span className="text-black uppercase text-xs">For: </span>
                    {resume.targetCompany || 'General Resume'}
                    {resume.fullName ? ` · ${resume.fullName}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedResume(resume)}
                  className="w-full bg-white border-4 border-black text-black py-3 font-black uppercase tracking-widest hover:bg-black hover:text-white transition-colors"
                >
                  View & Export
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Selected resume view + download ──
  return (
    <div className="min-h-screen bg-[#f4f4f4] py-10 text-black">

      {/* Toolbar */}
      <div className="max-w-[210mm] mx-auto mb-6 flex justify-between items-center px-4 lg:px-0">
        <div>
          <button
            onClick={() => setSelectedResume(null)}
            className="flex items-center gap-2 text-sm font-black uppercase tracking-wider hover:underline mb-1"
          >
            <ArrowLeft size={16} /> Back to List
          </button>
          <h1 className="text-2xl font-black uppercase tracking-tighter">Export Resume</h1>
        </div>
        <div className="flex gap-3">
          <Link
            href="/user/resume"
            className="border-4 border-black px-5 py-2.5 font-black uppercase text-sm hover:bg-gray-200 transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1 bg-white"
          >
            Edit Content
          </Link>
          <button
            onClick={handleDownloadPDF}
            disabled={isDownloading}
            className="flex items-center gap-2 bg-black text-white border-4 border-black px-6 py-2.5 font-black uppercase text-sm hover:bg-gray-800 transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] active:shadow-none active:translate-x-1 active:translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={16} />
            {isDownloading ? 'Generating…' : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* PDF Target */}
      <div id="resume-pdf-container" className="mx-auto w-fit shadow-[16px_16px_0px_0px_rgba(0,0,0,0.08)]">
        <ResumePreview data={selectedResume} />
      </div>

    </div>
  );
}