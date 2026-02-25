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
  github: string;
  linkedin: string;
  education: string;
  experience: string;
  skills: string;
  projects: string;
}

export default function ResumeBuilder() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  // AI Chat Inputs
  const [companyName, setCompanyName] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [baseProfileData, setBaseProfileData] = useState<any>(null);

  const [formData, setFormData] = useState<ResumeData>({
    fullName: '',
    phone: '',
    github: '',
    linkedin: '',
    education: '',
    experience: '',
    skills: '',
    projects: '',
  });

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      try {
        // Fetch existing legacy resume data (if any) to pre-fill the form
        const resumeRef = doc(db, 'resumes', user.uid);
        const resumeSnap = await getDoc(resumeRef);
        if (resumeSnap.exists()) {
          setFormData(resumeSnap.data() as ResumeData);
        }

        // Fetch base profile data to feed the AI
        const profileRef = doc(db, 'users', user.uid);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          setBaseProfileData(profileSnap.data());
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user]);

  const handleGenerateAI = async () => {
    if (!companyName || !jobDescription) {
      alert("Please enter both the company name and job description.");
      return;
    }
    if (!baseProfileData) {
      alert("No profile data found. Please fill out your Student Profile first.");
      return;
    }

    setGenerating(true);
    try {
      // Fix for Firebase Timestamps crashing Next.js Server Actions
      const plainProfileData = JSON.parse(JSON.stringify(baseProfileData));

      const generatedResume = await generateTailoredResume(
        plainProfileData, 
        companyName, 
        jobDescription
      );
      
      setFormData(prev => ({
        ...prev,
        ...generatedResume,
        phone: generatedResume.phone || prev.phone
      }));
      
    } catch (error) {
      console.error(error);
      alert("Failed to generate AI resume. Check console for details.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    try {
      // Use addDoc to create a new, unique document for each tailored resume
      await addDoc(collection(db, 'resumes'), {
        ...formData,
        targetCompany: companyName || 'General Resume', // Tags the resume for the grid
        updatedAt: serverTimestamp(),
        userEmail: user.email
      });
      alert("New Resume Variant saved successfully! You can view it in the Export page.");
    } catch (error) {
      console.error("Error saving resume:", error);
      alert("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-white text-black font-bold uppercase">Loading Resume Builder...</div>;

  return (
    <div className="min-h-screen bg-white p-8 text-black">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="border-b-8 border-black pb-6">
          <h1 className="text-5xl font-black uppercase tracking-tighter">AI Resume Builder</h1>
          <p className="text-gray-600 font-bold mt-2 italic">Tailor your profile dynamically for specific roles.</p>
        </div>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          
          {/* LEFT COLUMN: Editor Form */}
          <div className="space-y-12">
            
            {/* AI Generation Chat Box Section */}
            <section className="border-4 border-black p-8 bg-[#f4f4f4] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <h2 className="text-2xl font-black uppercase mb-4 bg-black text-white inline-block px-4 py-1">Auto-Tailor via AI</h2>
              <p className="text-sm font-bold uppercase mb-6 text-gray-600">Enter target job details to rewrite your profile data instantly.</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-black uppercase mb-2">Target Company Name</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full border-2 border-black p-3 focus:bg-white outline-none font-bold"
                    placeholder="e.g. Google, Vercel, Stripe..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-black uppercase mb-2">Job Description</label>
                  <textarea
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    className="w-full border-2 border-black p-4 h-32 focus:bg-white outline-none font-medium resize-y"
                    placeholder="Paste the job requirements and responsibilities here..."
                  />
                </div>
                <button
                  type="button"
                  onClick={handleGenerateAI}
                  disabled={generating}
                  className="bg-black text-white px-8 py-3 text-lg font-black uppercase tracking-widest hover:bg-gray-800 transition-all shadow-[4px_4px_0px_0px_rgba(150,150,150,1)] active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed w-full"
                >
                  {generating ? 'Synthesizing Profile...' : 'Generate Tailored Resume'}
                </button>
              </div>
            </section>

            <form onSubmit={handleSave} className="space-y-12">
              {/* Personal Info Section */}
              <section className="border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white">
                <h2 className="text-2xl font-black uppercase mb-6 bg-black text-white inline-block px-4 py-1">01. Personal Info</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-black uppercase mb-2">Full Name</label>
                    <input
                      type="text"
                      value={formData.fullName}
                      onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                      className="w-full border-2 border-black p-3 focus:bg-gray-50 outline-none font-bold"
                      placeholder="Satya..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-black uppercase mb-2">Phone Number</label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      className="w-full border-2 border-black p-3 focus:bg-gray-50 outline-none font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-black uppercase mb-2">GitHub URL</label>
                    <input
                      type="url"
                      value={formData.github}
                      onChange={(e) => setFormData({...formData, github: e.target.value})}
                      className="w-full border-2 border-black p-3 focus:bg-gray-50 outline-none font-bold"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-black uppercase mb-2">LinkedIn URL</label>
                    <input
                      type="url"
                      value={formData.linkedin}
                      onChange={(e) => setFormData({...formData, linkedin: e.target.value})}
                      className="w-full border-2 border-black p-3 focus:bg-gray-50 outline-none font-bold"
                    />
                  </div>
                </div>
              </section>

              {/* Detailed Content Section */}
              <section className="border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white">
                <h2 className="text-2xl font-black uppercase mb-6 bg-black text-white inline-block px-4 py-1">02. Career Details</h2>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-black uppercase mb-2">Technical Skills</label>
                    <input
                      type="text"
                      value={formData.skills}
                      onChange={(e) => setFormData({...formData, skills: e.target.value})}
                      className="w-full border-2 border-black p-3 focus:bg-gray-50 outline-none font-bold"
                      placeholder="React, Next.js, Firebase, TypeScript..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-black uppercase mb-2">Education</label>
                    <textarea
                      value={formData.education}
                      onChange={(e) => setFormData({...formData, education: e.target.value})}
                      className="w-full border-2 border-black p-4 h-32 focus:bg-gray-50 outline-none font-medium"
                      placeholder="Degree, University, Graduation Year..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-black uppercase mb-2">Work Experience</label>
                    <textarea
                      value={formData.experience}
                      onChange={(e) => setFormData({...formData, experience: e.target.value})}
                      className="w-full border-2 border-black p-4 h-48 focus:bg-gray-50 outline-none font-medium"
                      placeholder="Describe your previous roles and responsibilities..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-black uppercase mb-2">Projects</label>
                    <textarea
                      value={formData.projects}
                      onChange={(e) => setFormData({...formData, projects: e.target.value})}
                      className="w-full border-2 border-black p-4 h-48 focus:bg-gray-50 outline-none font-medium"
                      placeholder="Describe your projects..."
                    />
                  </div>
                </div>
              </section>

              <div className="flex justify-end pb-8">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-black text-white px-12 py-4 text-xl font-black uppercase tracking-widest hover:bg-gray-800 transition-all shadow-[8px_8px_0px_0px_rgba(200,200,200,1)] active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed w-full"
                >
                  {saving ? 'Saving...' : 'Save Final Resume'}
                </button>
              </div>
            </form>
          </div>

          {/* RIGHT COLUMN: Live Preview */}
          <div className="lg:sticky lg:top-8 border-4 border-black bg-white shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] flex flex-col h-[calc(100vh-4rem)]">
            <div className="bg-black text-white p-4 flex justify-between items-center border-b-4 border-black">
              <h2 className="text-xl font-black uppercase tracking-widest">Live Preview</h2>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold uppercase bg-white text-black px-2 py-1">A4 Standard</span>
                {/* Export Button inside Header */}
                <Link 
                  href="/user/resume/download"
                  className="text-[10px] font-black uppercase bg-white text-black px-3 py-1 hover:bg-gray-200 transition-colors shadow-[2px_2px_0px_0px_rgba(255,255,255,0.5)] active:translate-y-[1px] active:shadow-none"
                >
                  View Saved Resumes
                </Link>
              </div>
            </div>
            
            {/* Scrollable Preview Area */}
            <div className="p-8 overflow-y-auto flex-1 font-sans text-sm text-gray-900 bg-[#fefefe]">
              
              {/* Header */}
              <div className="text-center border-b-2 border-gray-300 pb-4 mb-6">
                <h1 className="text-3xl font-black uppercase tracking-tight mb-2">
                  {formData.fullName || 'Your Name'}
                </h1>
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-gray-600 font-medium">
                  {formData.phone && <span>{formData.phone}</span>}
                  {formData.linkedin && <span>• <a href={formData.linkedin} target="_blank" rel="noreferrer" className="hover:underline text-blue-600">{formData.linkedin.replace('https://', '')}</a></span>}
                  {formData.github && <span>• <a href={formData.github} target="_blank" rel="noreferrer" className="hover:underline text-gray-800">{formData.github.replace('https://', '')}</a></span>}
                </div>
              </div>

              {/* Skills */}
              {(formData.skills || !formData.fullName) && (
                <div className="mb-6">
                  <h3 className="text-lg font-bold uppercase tracking-widest border-b border-black mb-2 pb-1">Technical Skills</h3>
                  <p className="whitespace-pre-wrap font-medium leading-relaxed">
                    {formData.skills || 'Your tailored skills will appear here...'}
                  </p>
                </div>
              )}

              {/* Experience */}
              {(formData.experience || !formData.fullName) && (
                <div className="mb-6">
                  <h3 className="text-lg font-bold uppercase tracking-widest border-b border-black mb-2 pb-1">Experience</h3>
                  <div className="whitespace-pre-wrap leading-relaxed">
                    {formData.experience || 'Your work experience and impact...'}
                  </div>
                </div>
              )}

              {/* Projects */}
              {(formData.projects || !formData.fullName) && (
                <div className="mb-6">
                  <h3 className="text-lg font-bold uppercase tracking-widest border-b border-black mb-2 pb-1">Projects</h3>
                  <div className="whitespace-pre-wrap leading-relaxed">
                    {formData.projects || 'Your notable projects and achievements...'}
                  </div>
                </div>
              )}

              {/* Education */}
              {(formData.education || !formData.fullName) && (
                <div className="mb-6">
                  <h3 className="text-lg font-bold uppercase tracking-widest border-b border-black mb-2 pb-1">Education</h3>
                  <div className="whitespace-pre-wrap leading-relaxed">
                    {formData.education || 'Your educational background...'}
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}