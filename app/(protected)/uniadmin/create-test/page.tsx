'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import Link from 'next/link';
import { processTestDocument } from '@/app/actions/process-test';

export default function CreateTestPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [file, setFile] = useState<File | null>(null);
  const [universityId, setUniversityId] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    async function fetchAdminProfile() {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUniversityId(userDoc.data().universityId);
        }
      }
    }
    fetchAdminProfile();
  }, [user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus({ type: '', message: '' });
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !user || !universityId) return;

    setIsParsing(true);
    setStatus({ type: 'info', message: 'LlamaParse is reading and Groq is thinking...' });

    try {
      const formData = new FormData();
      formData.append('file', file);

      const result = await processTestDocument(formData, user.uid, universityId);

      if (result.success) {
        setStatus({ type: 'success', message: 'Test generated and saved!' });
        setTimeout(() => router.push('/uniadmin/dashboard'), 2000);
      } else {
        setStatus({ type: 'error', message: result.error });
      }
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setIsParsing(false);
    }
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-white p-8 text-black">
      <div className="max-w-4xl mx-auto">
        <Link href="/uniadmin/dashboard" className="text-gray-500 mb-8 inline-block">← Back</Link>
        <div className="bg-black text-white p-8 rounded-2xl shadow-2xl">
          <h1 className="text-3xl font-bold mb-6">AI Test Generator</h1>
          {status.message && (
            <div className={`mb-6 p-4 rounded-lg ${status.type === 'error' ? 'bg-red-500' : 'bg-blue-600'}`}>
              {status.message}
            </div>
          )}
          <form onSubmit={handleGenerate} className="space-y-6">
            <div className="border-2 border-dashed border-gray-700 rounded-xl p-10 text-center bg-[#111]">
              <input type="file" accept=".pdf" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              <p className="text-gray-400">{file ? file.name : "Select study PDF"}</p>
            </div>
            <button 
              type="submit" 
              disabled={isParsing || !file || !universityId}
              className="w-full bg-white text-black py-4 rounded-xl font-bold hover:bg-gray-200 disabled:opacity-50"
            >
              {isParsing ? 'Processing...' : 'Generate & Save Test'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}