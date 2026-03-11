'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Pencil, X } from 'lucide-react';

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

  if (loading || !profileData) return (
    <div className="flex items-center justify-center h-64">
      <div className="loading-dots"><span /><span /><span /></div>
    </div>
  );

  return (
    <div className="max-w-lg mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-[-0.02em]">Admin Profile</h1>
        <p className="text-[var(--text-tertiary)] text-[13px] mt-1">Your account details</p>
      </div>

      {message && (
        <div className="mb-4 p-3 rounded bg-[#4CAF50]/10 text-[#4CAF50] border border-[#4CAF50]/20 text-[13px] font-medium">{message}</div>
      )}

      <div id="account-details" className="window p-6">
        <div className="flex justify-between items-center mb-5 pb-4 border-b border-[var(--border-subtle)]">
          <h2 className="text-[14px] font-bold text-[var(--text-primary)]">Account Details</h2>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="btn-secondary inline-flex items-center gap-1.5 text-[12px] px-3 py-1"
          >
            {isEditing ? <><X size={12} /> Cancel</> : <><Pencil size={12} /> Edit</>}
          </button>
        </div>

        <form onSubmit={handleUpdate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1.5">Email</label>
              <p className="text-[13px] text-[var(--text-tertiary)]">{profileData.email}</p>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1.5">University ID</label>
              <p className="text-[13px] font-mono text-[#F54E00]">{profileData.universityId}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1.5">Full Name</label>
              {isEditing ? (
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] text-[13px] focus:outline-none focus:border-[#5E6AD2] transition-all duration-150"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              ) : (
                <p className="text-[13px] text-[var(--text-primary)]">{profileData.name || 'Not set'}</p>
              )}
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1.5">Phone</label>
              {isEditing ? (
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] text-[13px] focus:outline-none focus:border-[#5E6AD2] transition-all duration-150"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                />
              ) : (
                <p className="text-[13px] text-[var(--text-primary)]">{profileData.phone || 'Not set'}</p>
              )}
            </div>
          </div>

          {isEditing && (
            <button type="submit" className="btn-primary w-full mt-2">Save Changes</button>
          )}
        </form>
      </div>
    </div>
  );
}