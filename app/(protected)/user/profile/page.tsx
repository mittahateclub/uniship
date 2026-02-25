// app/(protected)/user/profile/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { app } from '@/lib/firebase';

// Field names match exactly what is stored in Firebase
interface UserProfile {
  photoURL?: string;
  name?: string;
  phone?: string;      // Added Phone
  email?: string;      // Added Email
  title?: string;
  bio?: string;
  rollNumber?: string;
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

export default function StudentProfile() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  }, [user, authLoading]);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const storage = getStorage(app);
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
          <p className="text-gray-600 font-bold mt-2 uppercase text-sm">
            Manage your academic identity, portfolio, and resume details.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="border-4 border-black p-6 bg-black text-white shadow-[8px_8px_0px_0px_rgba(200,200,200,1)] sticky top-8">

              {/* Clickable avatar */}
              <div
                className="relative w-32 h-32 mx-auto mb-4 group cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                {profile?.photoURL ? (
                  <img
                    src={profile.photoURL}
                    alt="Profile"
                    className="w-32 h-32 rounded-full border-4 border-white object-cover"
                  />
                ) : (
                  <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center text-black text-5xl font-black">
                    {user?.email?.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="absolute inset-0 rounded-full bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-white text-[10px] font-bold uppercase mt-1">Change</span>
                </div>
                {uploadProgress !== null && (
                  <div className="absolute inset-0 rounded-full bg-black/70 flex items-center justify-center">
                    <span className="text-white font-black text-lg">{uploadProgress}%</span>
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />

              <p className="text-center text-[10px] text-gray-400 uppercase font-bold mb-3">
                Click photo to change
              </p>

              <h2 className="text-center font-black uppercase truncate text-xl">
                {profile?.name || user?.email?.split('@')[0]}
              </h2>
              <p className="text-center text-sm text-gray-400 mt-2 font-bold uppercase">
                {profile?.title || 'Student Account'}
              </p>

              {profile?.rollNumber && (
                <div className="mt-4 border-t-2 border-gray-700 pt-4 text-center">
                  <p className="text-xs text-gray-400 uppercase font-bold">Roll No</p>
                  <p className="font-black tracking-widest">{profile.rollNumber}</p>
                </div>
              )}

              {/* ✅ Clickable LinkedIn & GitHub links with logos in sidebar */}
              {(profile?.linkedinUrl || profile?.githubUrl) && (
                <div className="mt-4 border-t-2 border-gray-700 pt-4 flex justify-center gap-4">
                  {profile?.linkedinUrl && (
                    <a
                      href={profile.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="LinkedIn Profile"
                      className="text-[#0A66C2] bg-white rounded-full p-2 hover:scale-110 transition-transform"
                    >
                      <LinkedInIcon />
                    </a>
                  )}
                  {profile?.githubUrl && (
                    <a
                      href={profile.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="GitHub Profile"
                      className="text-gray-900 bg-white rounded-full p-2 hover:scale-110 transition-transform"
                    >
                      <GitHubIcon />
                    </a>
                  )}
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
                  <div>
                    <label className="block text-xs font-black uppercase mb-2">Full Name</label>
                    <input
                      type="text"
                      name="name"
                      value={profile?.name || ''}
                      onChange={handleChange}
                      className="w-full border-2 border-black p-3 font-bold focus:bg-gray-50 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase mb-2">Roll Number</label>
                    <input
                      type="text"
                      name="rollNumber"
                      value={profile?.rollNumber || ''}
                      onChange={handleChange}
                      className="w-full border-2 border-black p-3 font-bold focus:bg-gray-50 outline-none"
                    />
                  </div>

                  {/* Added Phone & Email Fields */}
                  <div>
                    <label className="block text-xs font-black uppercase mb-2">Phone Number</label>
                    <input
                      type="tel"
                      name="phone"
                      value={profile?.phone || ''}
                      onChange={handleChange}
                      className="w-full border-2 border-black p-3 font-bold focus:bg-gray-50 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase mb-2">Contact Email</label>
                    <input
                      type="email"
                      name="email"
                      value={profile?.email || ''}
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

              {/* ✅ Web Presence — input + clickable logo button side by side */}
              <div className="border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white">
                <h3 className="text-2xl font-black uppercase mb-6 underline decoration-4 underline-offset-4">Web Presence</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                  {/* LinkedIn */}
                  <div>
                    <label className="block text-xs font-black uppercase mb-2 flex items-center gap-2">
                      <span className="text-[#0A66C2]"><LinkedInIcon /></span>
                      LinkedIn URL
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        name="linkedinUrl"
                        value={profile?.linkedinUrl || ''}
                        onChange={handleChange}
                        placeholder="https://linkedin.com/in/yourname"
                        className="flex-1 border-2 border-black p-3 font-bold focus:bg-gray-50 outline-none"
                      />
                      {profile?.linkedinUrl && (
                        <a
                          href={profile.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open LinkedIn"
                          className="flex-shrink-0 bg-[#0A66C2] text-white p-3 border-2 border-black hover:bg-[#004182] transition-colors shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1"
                        >
                          <LinkedInIcon />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* GitHub */}
                  <div>
                    <label className="block text-xs font-black uppercase mb-2 flex items-center gap-2">
                      <span className="text-gray-900"><GitHubIcon /></span>
                      GitHub URL
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        name="githubUrl"
                        value={profile?.githubUrl || ''}
                        onChange={handleChange}
                        placeholder="https://github.com/yourusername"
                        className="flex-1 border-2 border-black p-3 font-bold focus:bg-gray-50 outline-none"
                      />
                      {profile?.githubUrl && (
                        <a
                          href={profile.githubUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open GitHub"
                          className="flex-shrink-0 bg-gray-900 text-white p-3 border-2 border-black hover:bg-gray-700 transition-colors shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1"
                        >
                          <GitHubIcon />
                        </a>
                      )}
                    </div>
                  </div>

                </div>
              </div>

              {/* Portfolio & Experience */}
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