// app/(protected)/user/resume/download/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { FileText, ArrowLeft, Download } from 'lucide-react';

interface ResumeData {
  id: string;
  fullName: string;
  phone: string;
  github: string;
  linkedin: string;
  education: string;
  experience: string;
  skills: string;
  projects: string;
  targetCompany?: string;
  updatedAt?: any;
}

export default function DownloadResume() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [resumes, setResumes] = useState<ResumeData[]>([]);
  const [selectedResume, setSelectedResume] = useState<ResumeData | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchResumes() {
      if (!user) return;
      try {
        const q = query(
          collection(db, 'resumes'),
          where('userEmail', '==', user.email)
        );
        const querySnapshot = await getDocs(q);

        const fetchedResumes = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ResumeData[];

        fetchedResumes.sort((a, b) => {
          const timeA = a.updatedAt?.seconds || 0;
          const timeB = b.updatedAt?.seconds || 0;
          return timeB - timeA;
        });

        setResumes(fetchedResumes);
      } catch (error) {
        console.error("Error fetching resumes:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchResumes();
  }, [user]);

  const handleDownloadPDF = async () => {
    const element = document.getElementById('resume-pdf-container');
    if (!element || !selectedResume) {
      alert('Could not find resume container element.');
      return;
    }

    setIsDownloading(true);
    setPdfError(null);

    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        // onclone: strip modern CSS color functions that html2canvas can't parse
        onclone: (_doc: Document, el: HTMLElement) => {
          // Walk every element and replace any unsupported color values
          const allEls = el.querySelectorAll('*');
          allEls.forEach((node) => {
            const htmlNode = node as HTMLElement;
            const style = window.getComputedStyle(htmlNode);
            const problematic = ['color', 'backgroundColor', 'borderColor', 'borderTopColor', 'borderBottomColor', 'borderLeftColor', 'borderRightColor'];
            problematic.forEach((prop) => {
              const val: string = (style as any)[prop] || '';
              if (val.includes('oklch') || val.includes('lab(') || val.includes('oklab') || val.includes('color(')) {
                (htmlNode.style as any)[prop] = prop.toLowerCase().includes('background') ? '#ffffff' : '#000000';
              }
            });
          });
        },
      } as any);

      const imgData = canvas.toDataURL('image/jpeg', 0.98);

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const fileName = `${selectedResume.fullName?.replace(/\s+/g, '_') || 'My'}_Resume.pdf`;
      pdf.save(fileName);

    } catch (error: any) {
      const msg = error?.message || String(error);
      console.error('PDF generation error:', error);
      setPdfError(msg);
      alert(`Failed to generate PDF.\n\nError: ${msg}`);
    } finally {
      setIsDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f4f4] text-black font-black uppercase">
        Loading Your Resumes...
      </div>
    );
  }

  if (resumes.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f4f4f4] text-black p-8">
        <h1 className="text-3xl font-black uppercase mb-4">No Resumes Found</h1>
        <p className="font-bold mb-8 text-gray-600">You haven't generated or saved any resumes yet.</p>
        <Link
          href="/user/resume"
          className="bg-black text-white px-8 py-3 font-black uppercase tracking-widest hover:bg-gray-800 transition-all shadow-[4px_4px_0px_0px_rgba(150,150,150,1)] active:translate-y-1 active:shadow-none"
        >
          Go to Builder
        </Link>
      </div>
    );
  }

  if (!selectedResume) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] p-8 text-black">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-end mb-10 border-b-8 border-black pb-6">
            <div>
              <h1 className="text-5xl font-black uppercase tracking-tighter">My Resumes</h1>
              <p className="text-gray-600 font-bold mt-2 uppercase text-sm">Select a tailored resume to view or download as PDF.</p>
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
                      <h3 className="font-black uppercase text-xl truncate">{resume.targetCompany || `Resume Variant ${resumes.length - idx}`}</h3>
                      <p className="text-xs font-bold text-gray-500 uppercase">
                        {resume.updatedAt ? new Date(resume.updatedAt.seconds * 1000).toLocaleDateString() : 'Draft'}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-gray-700 mb-6 line-clamp-3">
                    <span className="text-black uppercase text-xs">Skills:</span> {resume.skills || 'Not specified'}
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

  return (
    <div className="min-h-screen bg-[#f4f4f4] py-10 text-black">

      <div className="max-w-4xl mx-auto mb-8 flex justify-between items-center px-8 lg:px-0">
        <div>
          <button
            onClick={() => setSelectedResume(null)}
            className="flex items-center gap-2 text-sm font-black uppercase tracking-wider hover:underline mb-2"
          >
            <ArrowLeft size={16} /> Back to List
          </button>
          <h1 className="text-3xl font-black uppercase tracking-tighter">Export Resume</h1>
        </div>
        <div className="flex gap-4">
          <Link
            href="/user/resume"
            className="border-4 border-black px-6 py-3 font-black uppercase hover:bg-gray-200 transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1 bg-white"
          >
            Edit Content
          </Link>
          <button
            onClick={handleDownloadPDF}
            disabled={isDownloading}
            className="flex items-center gap-2 bg-black text-white border-4 border-black px-8 py-3 font-black uppercase hover:bg-gray-800 transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] active:shadow-none active:translate-x-1 active:translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={18} />
            {isDownloading ? 'Generating...' : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* Show error details if any */}
      {pdfError && (
        <div className="max-w-4xl mx-auto mb-4 px-8 lg:px-0">
          <div className="bg-red-50 border-4 border-red-500 p-4 text-red-800 font-mono text-sm">
            <strong>PDF Error:</strong> {pdfError}
          </div>
        </div>
      )}

      {/* Target Container for PDF conversion */}
      <div
        id="resume-pdf-container"
        className="max-w-[210mm] min-h-[297mm] mx-auto bg-white p-12 shadow-[16px_16px_0px_0px_rgba(0,0,0,0.1)]"
      >
        <header className="text-center border-b-2 border-black pb-6 mb-8">
          <h1 className="text-4xl font-black uppercase tracking-tight mb-3 text-black">
            {selectedResume.fullName || 'Your Name'}
          </h1>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-gray-800 font-bold">
            {selectedResume.phone && <span>{selectedResume.phone}</span>}
            {selectedResume.linkedin && (
              <span>• <a href={selectedResume.linkedin} className="hover:underline text-blue-700">{selectedResume.linkedin.replace(/^https?:\/\/(www\.)?/, '')}</a></span>
            )}
            {selectedResume.github && (
              <span>• <a href={selectedResume.github} className="hover:underline text-black">{selectedResume.github.replace(/^https?:\/\/(www\.)?/, '')}</a></span>
            )}
          </div>
        </header>

        <div className="space-y-8 font-sans text-gray-900">
          {selectedResume.skills && (
            <section>
              <h2 className="text-lg font-black uppercase tracking-widest border-b-2 border-gray-300 mb-3 pb-1 text-black">
                Technical Skills
              </h2>
              <p className="font-medium leading-relaxed whitespace-pre-wrap">
                {selectedResume.skills}
              </p>
            </section>
          )}

          {selectedResume.experience && (
            <section>
              <h2 className="text-lg font-black uppercase tracking-widest border-b-2 border-gray-300 mb-3 pb-1 text-black">
                Experience
              </h2>
              <div className="font-medium leading-relaxed whitespace-pre-wrap">
                {selectedResume.experience}
              </div>
            </section>
          )}

          {selectedResume.projects && (
            <section>
              <h2 className="text-lg font-black uppercase tracking-widest border-b-2 border-gray-300 mb-3 pb-1 text-black">
                Projects
              </h2>
              <div className="font-medium leading-relaxed whitespace-pre-wrap">
                {selectedResume.projects}
              </div>
            </section>
          )}

          {selectedResume.education && (
            <section>
              <h2 className="text-lg font-black uppercase tracking-widest border-b-2 border-gray-300 mb-3 pb-1 text-black">
                Education
              </h2>
              <div className="font-medium leading-relaxed whitespace-pre-wrap">
                {selectedResume.education}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}