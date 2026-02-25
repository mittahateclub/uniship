'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface UserProfile {
  profilePhotoUrl?: string;
  displayName?: string;
  title?: string;
  bio?: string;
  rollNo?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  technicalSkills?: string;
  experience?: string;
  education?: string;
  projects?: string;
  achievements?: string;
  positions?: string;
  relevantCoursework?: string;
  extracurriculars?: string;
}

export default function StudentProfile() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function fetchProfile() {
      if (!user) return;
      try {
        // --- DEBUGGING LOGS ADDED HERE ---
        console.log("Looking for Document ID:", user.uid); 
        
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        
        console.log("Did we find the document?:", docSnap.exists()); 

        if (docSnap.exists()) {
          console.log("Document Data found:", docSnap.data()); 
          setProfile(docSnap.data() as UserProfile);
        } else {
          console.warn("No document found in the 'users' collection with that exact UID.");
        }
        // ---------------------------------
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading) {
      fetchProfile();
    }
  }, [user, authLoading]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    setUpdating(true);
    setMessage('');

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        ...profile,
        updatedAt: new Date(),
      });
      setMessage('Profile updated successfully!');
    } catch (error) {
      console.error("Error updating profile:", error);
      setMessage('Failed to update profile.');
    } finally {
      setUpdating(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfile(prev => prev ? { ...prev, [name]: value } : { [name]: value });
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-black font-black uppercase">
        Loading Profile Context...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-8 text-black">
      <div className="max-w-5xl mx-auto">
        <div className="mb-10 border-b-8 border-black pb-6">
          <h1 className="text-5xl font-black uppercase tracking-tighter">Student Profile</h1>
          <p className="text-gray-600 font-bold mt-2 uppercase text-sm">Manage your academic identity, portfolio, and resume details.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
          {/* Sidebar Info */}
          <div className="lg:col-span-1">
            <div className="border-4 border-black p-6 bg-black text-white shadow-[8px_8px_0px_0px_rgba(200,200,200,1)] sticky top-8">
              {profile?.profilePhotoUrl ? (
                <img 
                  src={profile.profilePhotoUrl} 
                  alt="Profile" 
                  className="w-32 h-32 rounded-full mb-4 mx-auto border-4 border-white object-cover"
                />
              ) : (
                <div className="w-32 h-32 bg-white rounded-full mb-4 mx-auto flex items-center justify-center text-black text-5xl font-black">
                  {user?.email?.charAt(0).toUpperCase()}
                </div>
              )}
              <h2 className="text-center font-black uppercase truncate text-xl">
                {profile?.displayName || user?.email?.split('@')[0]}
              </h2>
              <p className="text-center text-sm text-gray-400 mt-2 font-bold uppercase">
                {profile?.title || 'Student Account'}
              </p>
              {profile?.rollNo && (
                <div className="mt-4 border-t-2 border-gray-700 pt-4 text-center">
                  <p className="text-xs text-gray-400 uppercase font-bold">Roll No</p>
                  <p className="font-black tracking-widest">{profile.rollNo}</p>
                </div>
              )}
            </div>
          </div>

          {/* Edit Form */}
          <div className="lg:col-span-3">
            <form onSubmit={handleUpdate} className="space-y-8">
              
              {/* Personal Details */}
              <div className="border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white">
                <h3 className="text-2xl font-black uppercase mb-6 underline decoration-4 underline-offset-4">Personal Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-black uppercase mb-2">Profile Photo URL</label>
                    <input
                      type="text"
                      name="profilePhotoUrl"
                      placeholder="https://example.com/photo.jpg"
                      value={profile?.profilePhotoUrl || ''}
                      onChange={handleChange}
                      className="w-full border-2 border-black p-3 font-bold focus:bg-gray-50 outline-none placeholder-gray-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase mb-2">Full Name</label>
                    <input
                      type="text"
                      name="displayName"
                      value={profile?.displayName || ''}
                      onChange={handleChange}
                      className="w-full border-2 border-black p-3 font-bold focus:bg-gray-50 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase mb-2">Roll Number</label>
                    <input
                      type="text"
                      name="rollNo"
                      value={profile?.rollNo || ''}
                      onChange={handleChange}
                      className="w-full border-2 border-black p-3 font-bold focus:bg-gray-50 outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-black uppercase mb-2">Professional Title</label>
                    <input
                      type="text"
                      name="title"
                      placeholder="e.g. Computer Science Student | Aspiring SDE"
                      value={profile?.title || ''}
                      onChange={handleChange}
                      className="w-full border-2 border-black p-3 font-bold focus:bg-gray-50 outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-black uppercase mb-2">Bio</label>
                    <textarea
                      name="bio"
                      rows={3}
                      value={profile?.bio || ''}
                      onChange={handleChange}
                      className="w-full border-2 border-black p-3 font-bold focus:bg-gray-50 outline-none resize-y"
                    />
                  </div>
                </div>
              </div>

              {/* Links */}
              <div className="border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white">
                <h3 className="text-2xl font-black uppercase mb-6 underline decoration-4 underline-offset-4">Web Presence</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-black uppercase mb-2">LinkedIn URL</label>
                    <input
                      type="url"
                      name="linkedinUrl"
                      value={profile?.linkedinUrl || ''}
                      onChange={handleChange}
                      className="w-full border-2 border-black p-3 font-bold focus:bg-gray-50 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase mb-2">GitHub URL</label>
                    <input
                      type="url"
                      name="githubUrl"
                      value={profile?.githubUrl || ''}
                      onChange={handleChange}
                      className="w-full border-2 border-black p-3 font-bold focus:bg-gray-50 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Resume Details */}
              <div className="border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white">
                <h3 className="text-2xl font-black uppercase mb-6 underline decoration-4 underline-offset-4">Portfolio & Experience</h3>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-black uppercase mb-2">Technical Skills (Comma separated)</label>
                    <textarea
                      name="technicalSkills"
                      rows={2}
                      placeholder="e.g. React, Next.js, TypeScript, Python"
                      value={profile?.technicalSkills || ''}
                      onChange={handleChange}
                      className="w-full border-2 border-black p-3 font-bold focus:bg-gray-50 outline-none resize-y"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase mb-2">Education</label>
                    <textarea
                      name="education"
                      rows={3}
                      value={profile?.education || ''}
                      onChange={handleChange}
                      className="w-full border-2 border-black p-3 font-bold focus:bg-gray-50 outline-none resize-y"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase mb-2">Experience</label>
                    <textarea
                      name="experience"
                      rows={4}
                      value={profile?.experience || ''}
                      onChange={handleChange}
                      className="w-full border-2 border-black p-3 font-bold focus:bg-gray-50 outline-none resize-y"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase mb-2">Projects</label>
                    <textarea
                      name="projects"
                      rows={4}
                      value={profile?.projects || ''}
                      onChange={handleChange}
                      className="w-full border-2 border-black p-3 font-bold focus:bg-gray-50 outline-none resize-y"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase mb-2">Achievements</label>
                    <textarea
                      name="achievements"
                      rows={3}
                      value={profile?.achievements || ''}
                      onChange={handleChange}
                      className="w-full border-2 border-black p-3 font-bold focus:bg-gray-50 outline-none resize-y"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase mb-2">Positions of Responsibility</label>
                    <textarea
                      name="positions"
                      rows={2}
                      value={profile?.positions || ''}
                      onChange={handleChange}
                      className="w-full border-2 border-black p-3 font-bold focus:bg-gray-50 outline-none resize-y"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase mb-2">Relevant Coursework</label>
                    <textarea
                      name="relevantCoursework"
                      rows={2}
                      value={profile?.relevantCoursework || ''}
                      onChange={handleChange}
                      className="w-full border-2 border-black p-3 font-bold focus:bg-gray-50 outline-none resize-y"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase mb-2">Extracurriculars</label>
                    <textarea
                      name="extracurriculars"
                      rows={2}
                      value={profile?.extracurriculars || ''}
                      onChange={handleChange}
                      className="w-full border-2 border-black p-3 font-bold focus:bg-gray-50 outline-none resize-y"
                    />
                  </div>
                </div>
              </div>

              {/* Status Message */}
              {message && (
                <div className={`p-4 border-4 font-black uppercase text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${message.includes('success') ? 'border-green-500 bg-green-400 text-black' : 'border-red-500 bg-red-400 text-black'}`}>
                  {message}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={updating}
                className="w-full bg-black text-white py-5 text-2xl font-black uppercase tracking-widest hover:bg-gray-800 transition-all shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-2 active:translate-y-2"
              >
                {updating ? 'Saving Protocol...' : 'Save Profile Changes'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}