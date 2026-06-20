'use client';
import { useTransitionRouter } from 'next-view-transitions';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getCache, setCache } from '@/lib/page-cache';
import { UniadminProfileView, type UniadminProfile } from './profile.view';

export default function UniadminProfilePage() {
  const { user, loading } = useAuth();
  const router = useTransitionRouter();
  const cacheKey = user ? `uniprofile:${user.uid}` : '';
  const cached = cacheKey ? getCache<UniadminProfile>(cacheKey) : undefined;
  const [profileData, setProfileData] = useState<UniadminProfile | null>(() => cached ?? null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ name: cached?.name || '', phone: cached?.phone || '' });
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push('/');
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
          if (cacheKey) setCache<UniadminProfile>(cacheKey, data);
        }
      }
    }
    fetchProfile();
  }, [user, cacheKey]);

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

  return (
    <UniadminProfileView
      loading={loading}
      profileData={profileData}
      isEditing={isEditing}
      formData={formData}
      message={message}
      onToggleEdit={() => setIsEditing(!isEditing)}
      onFormDataChange={setFormData}
      onSubmit={handleUpdate}
    />
  );
}
