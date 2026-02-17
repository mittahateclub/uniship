'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';

export default function UniadminProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [profileData, setProfileData] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '' });
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    async function fetchProfile() {
      if (user) {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProfileData(data);
          setFormData({ name: data.name || '', phone: data.phone || '' });
        }
      }
    }
    fetchProfile();
  }, [user]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const userRef = doc(db, 'users', user!.uid);
      await updateDoc(userRef, formData);
      setProfileData({ ...profileData, ...formData });
      setIsEditing(false);
      setMessage('Profile updated successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error("Update error:", error);
      setMessage('Error updating profile.');
    }
  };

  if (loading || !profileData) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-white p-8 text-black">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <Link href="/uniadmin/dashboard" className="hover:text-gray-600 mb-4 inline-block">← Back to Dashboard</Link>
          <h1 className="text-4xl font-bold">Admin Profile</h1>
        </div>

        {message && <p className="mb-4 p-3 bg-black text-white rounded">{message}</p>}

        <div className="bg-black text-white p-8 rounded-xl shadow-2xl">
          <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
            <h2 className="text-xl font-semibold">Account Details</h2>
            <button 
              onClick={() => setIsEditing(!isEditing)}
              className="bg-white text-black px-4 py-1 rounded font-bold hover:bg-gray-200 transition"
            >
              {isEditing ? 'Cancel' : 'Edit Profile'}
            </button>
          </div>

          <form onSubmit={handleUpdate} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-gray-400 text-sm mb-1">Email Address</label>
                <p className="text-lg font-medium opacity-70">{profileData.email}</p>
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">University ID</label>
                <p className="text-lg font-medium text-blue-400">{profileData.universityId}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-gray-400 text-sm mb-2">Full Name</label>
                {isEditing ? (
                  <input 
                    type="text" 
                    className="w-full p-2 bg-gray-900 border border-gray-700 rounded text-white"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                ) : (
                  <p className="text-lg">{profileData.name || 'Not set'}</p>
                )}
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-2">Phone Number</label>
                {isEditing ? (
                  <input 
                    type="text" 
                    className="w-full p-2 bg-gray-900 border border-gray-700 rounded text-white"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  />
                ) : (
                  <p className="text-lg">{profileData.phone || 'Not set'}</p>
                )}
              </div>
            </div>

            {isEditing && (
              <button 
                type="submit"
                className="w-full bg-white text-black py-3 rounded-lg font-bold hover:bg-gray-200 transition"
              >
                Save Changes
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}