// app/(protected)/user/resume/download/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { FileText, ArrowLeft, Download, Pencil, X, Save } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── ResumePreview ────────────────────────────────────────────────────────────

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
      const desc  = pipeIdx > -1 ? line.slice(0, pipeIdx).trim() : line.trim();
      const date  = pipeIdx > -1 ? line.slice(pipeIdx + 1).trim() : '';
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
      <h2 className="text-[12px] font-bold tracking-widest uppercase" style={{ fontVariant: 'small-caps' }}>
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
      style={{ width: '210mm', minHeight: '297mm', padding: '18mm', fontSize: '11px', lineHeight: '1.4', boxSizing: 'border-box' }}
    >
      <div className="text-center mb-1">
        <h1 className="text-[28px] font-extrabold tracking-tight leading-tight">
          {data.fullName || 'Your Name'}
        </h1>
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

      {hasContent(data.education)       && <><SectionHeader title="Education" />{parseEducation(data.education)}</>}
      {hasContent(data.experience)      && <><SectionHeader title="Experience" />{parseExperience(data.experience)}</>}
      {hasContent(data.projects)        && <><SectionHeader title="Projects" />{parseProjects(data.projects)}</>}
      {hasContent(data.coursework)      && <><SectionHeader title="Relevant Coursework" /><p className="text-[11px] leading-relaxed">{data.coursework}</p></>}
      {hasContent(data.skills)          && <><SectionHeader title="Technical Skills" />{renderSkills(data.skills)}</>}
      {hasContent(data.extracurriculars)&& <><SectionHeader title="Extracurriculars / Activities" />{parseExtracurriculars(data.extracurriculars)}</>}
      {hasContent(data.achievements)    && <><SectionHeader title="Achievements & Certifications" />{parseAchievements(data.achievements)}</>}
    </div>
  );
}

// ─── Inline Editor Panel ──────────────────────────────────────────────────────

type EditKey = keyof Omit<ResumeData, 'id' | 'updatedAt'>;

const EDITOR_FIELDS: { key: EditKey; label: string; multiline?: boolean; rows?: number }[] = [
  { key: 'fullName',        label: 'Full Name' },
  { key: 'email',           label: 'Email' },
  { key: 'phone',           label: 'Phone' },
  { key: 'website',         label: 'Website' },
  { key: 'linkedin',        label: 'LinkedIn URL' },
  { key: 'github',          label: 'GitHub URL' },
  { key: 'education',       label: 'Education',        multiline: true, rows: 6 },
  { key: 'experience',      label: 'Experience',       multiline: true, rows: 8 },
  { key: 'projects',        label: 'Projects',         multiline: true, rows: 8 },
  { key: 'coursework',      label: 'Relevant Coursework' },
  { key: 'skills',          label: 'Technical Skills', multiline: true, rows: 4 },
  { key: 'extracurriculars',label: 'Extracurriculars', multiline: true, rows: 3 },
  { key: 'achievements',    label: 'Achievements',     multiline: true, rows: 3 },
  { key: 'targetCompany',   label: 'Target Company' },
];

interface EditorPanelProps {
  draft: ResumeData;
  saving: boolean;
  onChange: (key: EditKey, value: string) => void;
  onSave: () => void;
  onClose: () => void;
}

function EditorPanel({ draft, saving, onChange, onSave, onClose }: EditorPanelProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b-4 border-black bg-black text-white shrink-0">
        <span className="font-black uppercase tracking-widest text-sm">Edit Resume</span>
        <div className="flex items-center gap-2">
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-1.5 bg-white text-black px-4 py-1.5 text-xs font-black uppercase tracking-widest hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={13} />
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-700 transition rounded"
            title="Close editor"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Scrollable fields */}
      <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4 bg-white">
        {EDITOR_FIELDS.map(({ key, label, multiline, rows }) => (
          <div key={key}>
            <label className="block text-[10px] font-black uppercase tracking-widest mb-1 text-gray-500">
              {label}
            </label>
            {multiline ? (
              <textarea
                value={(draft as any)[key] || ''}
                onChange={e => onChange(key, e.target.value)}
                rows={rows || 4}
                className="w-full border-2 border-black p-2 text-xs font-mono outline-none resize-y focus:bg-gray-50"
              />
            ) : (
              <input
                type="text"
                value={(draft as any)[key] || ''}
                onChange={e => onChange(key, e.target.value)}
                className="w-full border-2 border-black p-2 text-xs font-mono outline-none focus:bg-gray-50"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DownloadResume() {
  const { user } = useAuth();
  const [loading, setLoading]               = useState(true);
  const [isDownloading, setIsDownloading]   = useState(false);
  const [isSaving, setIsSaving]             = useState(false);
  const [resumes, setResumes]               = useState<ResumeData[]>([]);
  const [selectedResume, setSelectedResume] = useState<ResumeData | null>(null);

  // Draft = live editable copy; selectedResume = original from Firestore
  const [draft, setDraft]       = useState<ResumeData | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    async function fetchResumes() {
      if (!user) return;
      try {
        const q = query(collection(db, 'resumes'), where('userEmail', '==', user.email));
        const snap = await getDocs(q);
        const fetched = snap.docs.map(docSnap => ({
          id: docSnap.id,
          fullName: '', phone: '', email: '', website: '',
          github: '', linkedin: '', education: '', experience: '',
          skills: '', projects: '', coursework: '', extracurriculars: '', achievements: '',
          ...docSnap.data(),
        })) as ResumeData[];

        fetched.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
        setResumes(fetched);
      } catch (err) {
        console.error('Error fetching resumes:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchResumes();
  }, [user]);

  // When a resume is selected, initialise the draft
  const handleSelect = (resume: ResumeData) => {
    setSelectedResume(resume);
    setDraft({ ...resume });
    setEditOpen(false);
  };

  const handleDraftChange = (key: EditKey, value: string) => {
    setDraft(prev => prev ? { ...prev, [key]: value } : prev);
  };

  const handleSaveDraft = async () => {
    if (!draft?.id) return;
    setIsSaving(true);
    try {
      const { id, updatedAt, ...fields } = draft;
      await updateDoc(doc(db, 'resumes', id), {
        ...fields,
        updatedAt: serverTimestamp(),
      });
      // Sync selectedResume so closing the editor keeps the saved state
      setSelectedResume({ ...draft });
      // Also update the list card
      setResumes(prev => prev.map(r => r.id === draft.id ? { ...draft } : r));
      alert('Changes saved!');
    } catch (err) {
      console.error('Error saving:', err);
      alert('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadPDF = async () => {
    const element = document.getElementById('resume-pdf-container');
    if (!element || !draft) return;
    setIsDownloading(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const fileName = `${draft.fullName?.replace(/\s+/g, '_') || 'My'}_Resume.pdf`;
      await html2pdf().set({
        margin: 0,
        filename: fileName,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
      }).from(element).save();
    } catch (err) {
      console.error('Error generating PDF:', err);
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

  // ── Empty ──
  if (resumes.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f4f4f4] text-black p-8">
        <h1 className="text-3xl font-black uppercase mb-4">No Resumes Found</h1>
        <p className="font-bold mb-8 text-gray-600">You haven't generated or saved any resumes yet.</p>
        <Link href="/user/resume"
          className="bg-black text-white px-8 py-3 font-black uppercase tracking-widest hover:bg-gray-800 transition-all shadow-[4px_4px_0px_0px_rgba(150,150,150,1)] active:translate-y-1 active:shadow-none">
          Go to Builder
        </Link>
      </div>
    );
  }

  // ── Resume List ──
  if (!selectedResume) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] p-8 text-black">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-end mb-10 border-b-8 border-black pb-6">
            <div>
              <h1 className="text-5xl font-black uppercase tracking-tighter">My Resumes</h1>
              <p className="text-gray-600 font-bold mt-2 uppercase text-sm">
                Select a resume to preview, edit, or download as PDF.
              </p>
            </div>
            <Link href="/user/resume"
              className="bg-black text-white px-6 py-3 font-black uppercase tracking-widest hover:bg-gray-800 transition-all shadow-[4px_4px_0px_0px_rgba(150,150,150,1)] active:translate-y-1 active:shadow-none hidden md:block">
              + Create New
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {resumes.map((resume, idx) => (
              <div key={resume.id}
                className="bg-white border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-2 hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] transition-all flex flex-col justify-between">
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
                        {resume.updatedAt ? new Date(resume.updatedAt.seconds * 1000).toLocaleDateString() : 'Draft'}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-gray-700 mb-6 line-clamp-3">
                    <span className="text-black uppercase text-xs">For: </span>
                    {resume.targetCompany || 'General Resume'}
                    {resume.fullName ? ` · ${resume.fullName}` : ''}
                  </p>
                </div>
                <button onClick={() => handleSelect(resume)}
                  className="w-full bg-white border-4 border-black text-black py-3 font-black uppercase tracking-widest hover:bg-black hover:text-white transition-colors">
                  View & Export
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Selected Resume: Preview + optional inline editor ──
  return (
    <div className="min-h-screen bg-[#f4f4f4] text-black">

      {/* ── Top Toolbar ── */}
      <div className="sticky top-0 z-30 bg-[#f4f4f4] border-b-4 border-black px-6 py-3 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button onClick={() => { setSelectedResume(null); setEditOpen(false); }}
            className="flex items-center gap-2 text-sm font-black uppercase tracking-wider hover:underline">
            <ArrowLeft size={16} /> Back
          </button>
          <span className="font-black uppercase tracking-tighter text-lg hidden sm:block">
            {draft?.targetCompany || 'Export Resume'}
          </span>
        </div>

        <div className="flex gap-2">
          {/* Toggle editor */}
          <button
            onClick={() => setEditOpen(o => !o)}
            className={`flex items-center gap-1.5 border-4 border-black px-4 py-2 text-xs font-black uppercase tracking-widest transition-colors shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[3px] active:translate-y-[3px] ${editOpen ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-100'}`}
          >
            <Pencil size={13} />
            {editOpen ? 'Close Editor' : 'Edit Content'}
          </button>

          {/* Download */}
          <button onClick={handleDownloadPDF} disabled={isDownloading}
            className="flex items-center gap-1.5 bg-black text-white border-4 border-black px-4 py-2 text-xs font-black uppercase tracking-widest hover:bg-gray-800 transition shadow-[3px_3px_0px_0px_rgba(0,0,0,0.3)] active:shadow-none active:translate-x-[3px] active:translate-y-[3px] disabled:opacity-50 disabled:cursor-not-allowed">
            <Download size={13} />
            {isDownloading ? 'Generating…' : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* ── Body: side-by-side when editor is open ── */}
      <div className={`flex ${editOpen ? 'flex-row' : 'flex-col items-center'} gap-0 min-h-[calc(100vh-57px)]`}>

        {/* Editor Panel */}
        {editOpen && draft && (
          <div className="w-[360px] shrink-0 border-r-4 border-black h-[calc(100vh-57px)] sticky top-[57px] overflow-hidden flex flex-col bg-white shadow-[4px_0px_0px_0px_rgba(0,0,0,0.05)]">
            <EditorPanel
              draft={draft}
              saving={isSaving}
              onChange={handleDraftChange}
              onSave={handleSaveDraft}
              onClose={() => setEditOpen(false)}
            />
          </div>
        )}

        {/* Preview */}
        <div className={`flex-1 py-8 ${editOpen ? 'overflow-y-auto px-6' : 'flex justify-center px-4'}`}>
          <div id="resume-pdf-container" className="shadow-[16px_16px_0px_0px_rgba(0,0,0,0.08)] mx-auto w-fit">
            {/* Always render the live draft so edits are reflected instantly */}
            <ResumePreview data={draft ?? selectedResume} />
          </div>
        </div>

      </div>
    </div>
  );
}