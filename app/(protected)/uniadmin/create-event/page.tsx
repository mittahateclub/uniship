'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';

export default function CreateEventPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [adminUnivId, setAdminUnivId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    location: '',
    type: 'Workshop',
  });

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // 1. Fetch the Admin's actual University ID from Firestore
  useEffect(() => {
    async function getAdminProfile() {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setAdminUnivId(userDoc.data().universityId);
        }
      }
    }
    getAdminProfile();
  }, [user]);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUnivId) {
      setMessage({ type: 'error', text: 'Profile error: University ID not found.' });
      return;
    }

    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      await addDoc(collection(db, 'events'), {
        ...formData,
        universityId: adminUnivId, // Use the ID from the profile, not a placeholder
        createdBy: user?.uid,
        createdAt: serverTimestamp(),
        attendees: [],
      });

      setMessage({ type: 'success', text: 'Event created successfully!' });
      setFormData({ title: '', description: '', date: '', location: '', type: 'Workshop' });
      setTimeout(() => router.push('/uniadmin/dashboard'), 2000);
    } catch (error: any) {
      console.error("Firebase Error:", error.code, error.message);
      setMessage({ type: 'error', text: `Permission Denied: ${error.message}` });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-white">Loading...</div>;

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <Link href="/uniadmin/dashboard" className="text-black hover:text-gray-600 mb-4 inline-block">← Back</Link>
          <h1 className="text-4xl font-bold text-black mb-2">Create University Event</h1>
        </div>

        <div className="bg-black text-white p-8 rounded-lg shadow-2xl">
          {message.text && (
            <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <input name="title" type="text" required placeholder="Event Title" value={formData.title} onChange={handleChange} className="w-full px-4 py-3 bg-white text-black rounded-lg" />
            <select name="type" value={formData.type} onChange={handleChange} className="w-full px-4 py-3 bg-white text-black rounded-lg">
              <option value="Workshop">Workshop</option>
              <option value="Seminar">Seminar</option>
            </select>
            <input name="date" type="datetime-local" required value={formData.date} onChange={handleChange} className="w-full px-4 py-3 bg-white text-black rounded-lg" />
            <input name="location" type="text" required placeholder="Location" value={formData.location} onChange={handleChange} className="w-full px-4 py-3 bg-white text-black rounded-lg" />
            <textarea name="description" required rows={4} placeholder="Description" value={formData.description} onChange={handleChange} className="w-full px-4 py-3 bg-white text-black rounded-lg"></textarea>
            
            <button type="submit" disabled={submitting || !adminUnivId} className="w-full bg-white text-black py-3 rounded-lg font-bold hover:bg-gray-200 disabled:opacity-50 transition">
              {submitting ? 'Posting...' : 'Post Event'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}