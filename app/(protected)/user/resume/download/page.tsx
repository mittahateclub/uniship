// app/(protected)/user/resume/download/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp, addDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import Link from 'next/link';
import { FileText, ArrowLeft, Download, Pencil, X, Save, Upload, ExternalLink, Trash2 } from 'lucide-react';
import ATSScorePanel from '../ats-score';

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
  uploadedFileUrl?: string;
  uploadedFileName?: string;
  uploadedFileType?: string;
  keywords?: string[];
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
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] shrink-0">
        <span className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)]">Edit Resume</span>
        <div className="flex items-center gap-2">
          <button
            onClick={onSave}
            disabled={saving}
            className="btn-primary flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={13} />
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[var(--border-subtle)] transition rounded"
            title="Close editor"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Scrollable fields */}
      <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4 bg-[var(--bg-surface)]">
        {EDITOR_FIELDS.map(({ key, label, multiline, rows }) => (
          <div key={key}>
            <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1.5 block">
              {label}
            </label>
            {multiline ? (
              <textarea
                value={(draft as any)[key] || ''}
                onChange={e => onChange(key, e.target.value)}
                rows={rows || 4}
                className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded px-3 py-2 text-xs text-[var(--text-primary)] font-mono outline-none resize-y focus:border-[#5E6AD2] transition-colors"
              />
            ) : (
              <input
                type="text"
                value={(draft as any)[key] || ''}
                onChange={e => onChange(key, e.target.value)}
                className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded px-3 py-2 text-xs text-[var(--text-primary)] font-mono outline-none focus:border-[#5E6AD2] transition-colors"
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
  const [isUploading, setIsUploading]       = useState(false);
  const [isDeleting, setIsDeleting]         = useState<string | null>(null);
  const [isDragOver, setIsDragOver]         = useState(false);
  const [uploadError, setUploadError]       = useState('');
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

  const handleUploadPreviousResume = async (file: File) => {
    if (!user || !user.email) return;

    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (!allowedTypes.includes(file.type)) {
      setUploadError('Only PDF, DOC, and DOCX files are allowed.');
      return;
    }

    if (file.size > 6 * 1024 * 1024) {
      setUploadError('File size must be under 6MB.');
      return;
    }

    setUploadError('');
    setIsUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `uploaded_resumes/${user.uid}/${Date.now()}-${safeName}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      const emptyResume: Omit<ResumeData, 'id'> = {
        fullName: '',
        phone: '',
        email: user.email,
        website: '',
        github: '',
        linkedin: '',
        education: '',
        experience: '',
        skills: '',
        projects: '',
        coursework: '',
        extracurriculars: '',
        achievements: '',
        targetCompany: 'Uploaded Resume',
        uploadedFileUrl: url,
        uploadedFileName: file.name,
        uploadedFileType: file.type,
      };

      const created = await addDoc(collection(db, 'resumes'), {
        ...emptyResume,
        userId: user.uid,
        userEmail: user.email,
        updatedAt: serverTimestamp(),
      });

      const newItem: ResumeData = {
        ...emptyResume,
        id: created.id,
        updatedAt: { seconds: Math.floor(Date.now() / 1000) },
      };

      setResumes(prev => [newItem, ...prev]);
    } catch (err) {
      console.error('Upload failed:', err);
      const code = (err as any)?.code ? String((err as any).code) : '';
      if (code.includes('permission-denied') || code.includes('unauthorized')) {
        setUploadError(`Upload blocked by Firebase rules (${code || 'unknown'}).`);
      } else {
        setUploadError(`Failed to upload resume${code ? ` (${code})` : ''}. Please try again.`);
      }
    } finally {
      setIsUploading(false);
      setIsDragOver(false);
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

  const handleDeleteResume = async (resume: ResumeData) => {
    if (!resume.id) return;

    const confirmed = window.confirm('Delete this resume permanently? This action cannot be undone.');
    if (!confirmed) return;

    setIsDeleting(resume.id);
    try {
      let storageDeleteWarning = '';

      if (resume.uploadedFileUrl) {
        try {
          await deleteObject(ref(storage, resume.uploadedFileUrl));
        } catch (storageErr: any) {
          const code = String(storageErr?.code || '');
          // Never block resume deletion because of storage cleanup failures.
          if (!code.includes('object-not-found')) {
            storageDeleteWarning = code || 'storage-delete-failed';
            console.warn('Storage cleanup warning:', storageErr);
          }
        }
      }

      await deleteDoc(doc(db, 'resumes', resume.id));
      setResumes(prev => prev.filter(r => r.id !== resume.id));

      if (selectedResume?.id === resume.id) {
        setSelectedResume(null);
        setDraft(null);
        setEditOpen(false);
      }

      if (storageDeleteWarning) {
        alert(`Resume deleted, but file cleanup in storage failed (${storageDeleteWarning}).`);
      }
    } catch (err) {
      console.error('Error deleting resume:', err);
      const code = String((err as any)?.code || '');
      alert(`Failed to delete resume${code ? ` (${code})` : ''}. Please try again.`);
    } finally {
      setIsDeleting(null);
    }
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="loading-dots"><span /><span /><span /></div>
      </div>
    );
  }

  // ── Resume List ──
  if (!selectedResume) {
    return (
      <div className="animate-fade-in">
        <div className="max-w-6xl mx-auto">
          <div className="window p-6 mb-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Easy upload resumes manually</h2>
              <p className="text-[var(--text-tertiary)] text-sm mt-1">One click OR drag and drop candidate&apos;s resumes.</p>
            </div>

            <label
              htmlFor="previous-resume-upload"
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleUploadPreviousResume(file);
              }}
              className={`block rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
                isDragOver ? 'border-[#5E6AD2] bg-[#5E6AD2]/10' : 'border-[#5E6AD2]/40 bg-[var(--bg-elevated)]'
              }`}
            >
              <input
                id="previous-resume-upload"
                type="file"
                accept=".pdf,.doc,.docx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadPreviousResume(file);
                  e.currentTarget.value = '';
                }}
              />
              <div className="mx-auto w-16 h-16 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-center mb-3">
                <Upload size={22} className="text-[var(--text-secondary)]" />
              </div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                {isUploading ? 'Uploading...' : 'Drop your resume here or click to upload'}
              </p>
              <p className="text-xs text-[var(--text-faint)] mt-1">Accepted formats: PDF, DOC, DOCX (max 6MB)</p>
            </label>

            {uploadError && (
              <p className="text-xs text-[#F54E00] mt-3">{uploadError}</p>
            )}
          </div>

          <div className="flex justify-between items-end mb-8 border-b border-[var(--border-subtle)] pb-5">
            <div>
              <h1 className="text-2xl font-semibold tracking-[-0.02em]">My Resumes</h1>
              <p className="text-[var(--text-tertiary)] text-sm mt-1">
                Select a resume to preview, edit, or download as PDF.
              </p>
            </div>
            <Link href="/user/resume"
              className="btn-primary px-5 py-2.5 text-xs font-semibold hidden md:block">
              + Create New
            </Link>
          </div>

          {resumes.length === 0 && (
            <div className="window p-8 text-center mb-6">
              <h3 className="text-lg font-semibold mb-2">No resumes found yet</h3>
              <p className="text-[var(--text-tertiary)] text-sm mb-5">Upload your previous resume above or create a new one from the builder.</p>
              <Link href="/user/resume" className="btn-primary px-5 py-2.5 text-sm font-semibold inline-block">
                Go to Builder
              </Link>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {resumes.map((resume, idx) => (
              <div key={resume.id}
                className="window p-5 hover:border-[var(--border-active)] transition-colors flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-[#F54E00]/15 p-2.5 rounded text-[#F54E00]">
                      <FileText size={20} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm truncate">
                        {resume.targetCompany || `Resume Variant ${resumes.length - idx}`}
                      </h3>
                      <p className="text-[11px] text-[var(--text-muted)] tabular-nums">
                        {resume.updatedAt ? new Date(resume.updatedAt.seconds * 1000).toLocaleDateString() : 'Draft'}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-[var(--text-tertiary)] mb-5 line-clamp-3">
                    <span className="text-[var(--text-muted)] uppercase text-[10px]">For: </span>
                    {resume.targetCompany || 'General Resume'}
                    {resume.fullName ? ` · ${resume.fullName}` : ''}
                    {!resume.fullName && resume.uploadedFileName ? ` · ${resume.uploadedFileName}` : ''}
                  </p>
                </div>
                {resume.uploadedFileUrl && !resume.fullName ? (
                  <div className="flex gap-2">
                    <a
                      href={resume.uploadedFileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary w-full py-2.5 text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                    >
                      <ExternalLink size={13} /> Open Uploaded File
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDeleteResume(resume)}
                      disabled={isDeleting === resume.id}
                      className="btn-secondary px-3 py-2.5 text-xs font-semibold text-[#F54E00] border-[#F54E00]/30 disabled:opacity-50"
                      title="Delete resume"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => handleSelect(resume)}
                      className="btn-secondary w-full py-2.5 text-xs font-semibold">
                      View & Export
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteResume(resume)}
                      disabled={isDeleting === resume.id}
                      className="btn-secondary px-3 py-2.5 text-xs font-semibold text-[#F54E00] border-[#F54E00]/30 disabled:opacity-50"
                      title="Delete resume"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Selected Resume: Preview + optional inline editor ──
  return (
    <div className="animate-fade-in">

      {/* ── Top Toolbar ── */}
      <div className="sticky top-0 z-30 bg-[var(--bg-primary)] border-b border-[var(--border-subtle)] px-5 py-3 flex justify-between items-center -mx-6 -mt-6 mb-5">
        <div className="flex items-center gap-4">
          <button onClick={() => { setSelectedResume(null); setEditOpen(false); }}
            className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
            <ArrowLeft size={14} /> Back
          </button>
          <span className="text-sm font-semibold hidden sm:block">
            {draft?.targetCompany || 'Export Resume'}
          </span>
        </div>

        <div className="flex gap-2">
          {/* Delete selected */}
          {selectedResume && (
            <button
              onClick={() => handleDeleteResume(selectedResume)}
              disabled={isDeleting === selectedResume.id}
              className="btn-secondary flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#F54E00] border-[#F54E00]/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 size={13} />
              {isDeleting === selectedResume.id ? 'Deleting…' : 'Delete Resume'}
            </button>
          )}

          {/* Toggle editor */}
          <button
            onClick={() => setEditOpen(o => !o)}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded border transition-colors ${editOpen ? 'bg-[#F54E00] text-black border-[#F54E00]' : 'btn-secondary'}`}
          >
            <Pencil size={13} />
            {editOpen ? 'Close Editor' : 'Edit Content'}
          </button>

          {/* Download */}
          <button onClick={handleDownloadPDF} disabled={isDownloading}
            className="btn-primary flex items-center gap-1.5 px-4 py-2 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
            <Download size={13} />
            {isDownloading ? 'Generating…' : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* ── Body: side-by-side when editor is open ── */}
      <div className={`flex ${editOpen ? 'flex-row' : 'flex-col items-center'} gap-0 min-h-[calc(100vh-160px)]`}>

        {/* Editor Panel */}
        {editOpen && draft && (
          <div className="w-[360px] shrink-0 border-r border-[var(--border-subtle)] h-[calc(100vh-160px)] sticky top-[57px] overflow-hidden flex flex-col window rounded-r-none">
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
        <div className={`flex-1 py-6 ${editOpen ? 'overflow-y-auto px-6' : 'flex flex-col items-center px-4'}`}>
          <div className={`${editOpen ? 'max-w-[210mm] mx-auto' : 'w-fit'} mb-4`}>
            <ATSScorePanel data={draft ?? selectedResume} keywords={(draft ?? selectedResume).keywords} compact />
          </div>
          <div id="resume-pdf-container" className="mx-auto w-fit shadow-lg">
            {/* Always render the live draft so edits are reflected instantly */}
            <ResumePreview data={draft ?? selectedResume} />
          </div>
        </div>

      </div>
    </div>
  );
}