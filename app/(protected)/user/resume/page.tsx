'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

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
    async function fetchResume() {
      if (!user) return;
      try {
        const docRef = doc(db, 'resumes', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setFormData(docSnap.data() as ResumeData);
        }
      } catch (error) {
        console.error("Error fetching resume:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchResume();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    try {
      await setDoc(doc(db, 'resumes', user.uid), {
        ...formData,
        updatedAt: serverTimestamp(),
        userEmail: user.email
      });
      alert("Resume data saved successfully!");
    } catch (error) {
      console.error("Error saving resume:", error);
      alert("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-white text-black font-bold uppercase">Loading Resume Profile...</div>;

  return (
    <div className="min-h-screen bg-white p-8 text-black">
      <div className="max-w-4xl mx-auto">
        <div className="mb-10 border-b-8 border-black pb-6">
          <h1 className="text-5xl font-black uppercase tracking-tighter">AI Resume Builder</h1>
          <p className="text-gray-600 font-bold mt-2 italic">Fill in your details to generate your professional profile.</p>
        </div>

        <form onSubmit={handleSave} className="space-y-12">
          {/* Personal Info Section */}
          <section className="border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="text-2xl font-black uppercase mb-6 bg-black text-white inline-block px-4 py-1">01. Personal Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
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
              <div>
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
          <section className="border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="text-2xl font-black uppercase mb-6 bg-black text-white inline-block px-4 py-1">02. Career Details</h2>
            <div className="space-y-6">
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
                <label className="block text-sm font-black uppercase mb-2">Technical Skills</label>
                <input
                  type="text"
                  value={formData.skills}
                  onChange={(e) => setFormData({...formData, skills: e.target.value})}
                  className="w-full border-2 border-black p-3 focus:bg-gray-50 outline-none font-bold"
                  placeholder="React, Next.js, Firebase, TypeScript..."
                />
              </div>
            </div>
          </section>

          <div className="sticky bottom-8 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="bg-black text-white px-12 py-4 text-xl font-black uppercase tracking-widest hover:bg-gray-800 transition-all shadow-[8px_8px_0px_0px_rgba(200,200,200,1)] active:translate-y-1 active:shadow-none"
            >
              {saving ? 'Saving...' : 'Save Resume Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}