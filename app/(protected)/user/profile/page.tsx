'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface UserProfile {
  displayName?: string;
  phoneNumber?: string;
  universityName?: string;
  studentId?: string;
  major?: string;
  yearOfStudy?: string;
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
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        }
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

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-black font-black uppercase">
        Loading Profile Context...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-8 text-black">
      <div className="max-w-4xl mx-auto">
        <div className="mb-10 border-b-8 border-black pb-6">
          <h1 className="text-5xl font-black uppercase tracking-tighter">Student Profile</h1>
          <p className="text-gray-600 font-bold mt-2">Manage your academic identity and contact details.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Sidebar Info */}
          <div className="lg:col-span-1">
            <div className="border-4 border-black p-6 bg-black text-white shadow-[8px_8px_0px_0px_rgba(200,200,200,1)]">
              <div className="w-24 h-24 bg-white rounded-full mb-4 mx-auto flex items-center justify-center text-black text-4xl font-black">
                {user?.email?.charAt(0).toUpperCase()}
              </div>
              <h2 className="text-center font-black uppercase truncate">{user?.email}</h2>
              <p className="text-center text-xs text-gray-400 mt-2 font-bold uppercase">Student Account</p>
            </div>
          </div>

          {/* Edit Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleUpdate} className="space-y-6">
              <div className="border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                <h3 className="text-xl font-black uppercase mb-6 underline decoration-4">Account Information</h3>
                
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="block text-xs font-black uppercase mb-2">Full Name</label>
                    <input
                      type="text"
                      value={profile?.displayName || ''}
                      onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
                      className="w-full border-2 border-black p-3 font-bold focus:bg-gray-50 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase mb-2">Phone Number</label>
                    <input
                      type="text"
                      value={profile?.phoneNumber || ''}
                      onChange={(e) => setProfile({ ...profile, phoneNumber: e.target.value })}
                      className="w-full border-2 border-black p-3 font-bold focus:bg-gray-50 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                <h3 className="text-xl font-black uppercase mb-6 underline decoration-4">Academic Details</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-black uppercase mb-2">University</label>
                    <input
                      type="text"
                      value={profile?.universityName || ''}
                      className="w-full border-2 border-black p-3 font-bold bg-gray-100 cursor-not-allowed outline-none"
                      disabled
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase mb-2">Student ID</label>
                    <input
                      type="text"
                      value={profile?.studentId || ''}
                      onChange={(e) => setProfile({ ...profile, studentId: e.target.value })}
                      className="w-full border-2 border-black p-3 font-bold focus:bg-gray-50 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase mb-2">Major</label>
                    <input
                      type="text"
                      value={profile?.major || ''}
                      onChange={(e) => setProfile({ ...profile, major: e.target.value })}
                      className="w-full border-2 border-black p-3 font-bold focus:bg-gray-50 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase mb-2">Year of Study</label>
                    <select
                      value={profile?.yearOfStudy || ''}
                      onChange={(e) => setProfile({ ...profile, yearOfStudy: e.target.value })}
                      className="w-full border-2 border-black p-3 font-bold focus:bg-gray-50 outline-none"
                    >
                      <option value="">Select Year</option>
                      <option value="1">1st Year</option>
                      <option value="2">2nd Year</option>
                      <option value="3">3rd Year</option>
                      <option value="4">4th Year</option>
                    </select>
                  </div>
                </div>
              </div>

              {message && (
                <div className={`p-4 border-4 font-black uppercase text-center ${message.includes('success') ? 'border-green-500 bg-green-50 text-green-700' : 'border-red-500 bg-red-50 text-red-700'}`}>
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={updating}
                className="w-full bg-black text-white py-4 text-xl font-black uppercase tracking-widest hover:bg-gray-800 transition-all shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1"
              >
                {updating ? 'Updating...' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}