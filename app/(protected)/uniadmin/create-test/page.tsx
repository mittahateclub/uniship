'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import Link from 'next/link';

export default function CreateTestPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  // State for form and status
  const [file, setFile] = useState<File | null>(null);
  const [testTitle, setTestTitle] = useState('');
  const [universityId, setUniversityId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Fetch admin's universityId for multi-tenancy
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
      const selectedFile = e.target.files[0];
      if (selectedFile.type !== 'application/pdf') {
        setStatus({ type: 'error', message: 'Please upload a valid PDF file.' });
        return;
      }
      setFile(selectedFile);
      setStatus({ type: '', message: '' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !testTitle || !universityId) {
      setStatus({ type: 'error', message: 'Missing required information.' });
      return;
    }

    setSubmitting(true);
    setStatus({ type: 'info', message: 'Processing upload and initiating AI...' });

    try {
      // 1. In a production app, you would upload the actual file to Firebase Storage here.
      // 2. We create a record in 'pdf_uploads' to trigger the backend generation logic.
      await addDoc(collection(db, 'pdf_uploads'), {
        title: testTitle,
        adminId: user?.uid,
        universityId: universityId,
        fileName: file.name,
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      setStatus({ type: 'success', message: 'Success! AI is now generating your test questions.' });
      
      // Reset form
      setTestTitle('');
      setFile(null);
      
      // Redirect back to dashboard after a success message
      setTimeout(() => {
        router.push('/uniadmin/dashboard');
      }, 2500);

    } catch (error: any) {
      console.error("Error creating test:", error);
      setStatus({ type: 'error', message: 'Permission Denied: Ensure your role is university_admin.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-white">Loading...</div>;

  return (
    <div className="min-h-screen bg-white p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link href="/uniadmin/dashboard" className="text-gray-500 hover:text-black transition-colors">
            ← Back to Dashboard
          </Link>
        </div>

        <div className="flex flex-col lg:flex-row gap-12">
          <div className="lg:w-1/3">
            <h1 className="text-4xl font-bold text-black mb-4">Create AI Test</h1>
            <p className="text-gray-600">
              Upload study materials in PDF format. Our AI will analyze the content to generate 
              practice questions for your students.
            </p>
          </div>

          <div className="lg:w-2/3 bg-black rounded-2xl p-8 shadow-2xl">
            {status.message && (
              <div className={`mb-6 p-4 rounded-lg text-sm ${
                status.type === 'error' ? 'bg-red-500/10 border border-red-500 text-red-500' : 
                status.type === 'success' ? 'bg-green-500/10 border border-green-500 text-green-500' :
                'bg-blue-500/10 border border-blue-500 text-blue-400'
              }`}>
                {status.message}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Test Title</label>
                <input 
                  type="text" 
                  required 
                  value={testTitle} 
                  onChange={(e) => setTestTitle(e.target.value)}
                  placeholder="e.g., Computer Science Midterm Prep"
                  className="w-full p-3 bg-[#1a1a1a] border border-gray-800 rounded-lg text-white focus:outline-none focus:border-white transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Upload Material (PDF)</label>
                <div className="relative border-2 border-dashed border-gray-800 rounded-xl p-10 text-center hover:border-gray-600 transition-colors">
                  <input 
                    type="file" 
                    accept=".pdf" 
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="text-4xl mb-2">📄</div>
                  <p className="text-gray-400 text-sm">
                    {file ? file.name : "Drag and drop or click to upload PDF"}
                  </p>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={submitting || !file || !universityId}
                className="w-full bg-white text-black py-4 rounded-xl font-bold hover:bg-gray-200 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {submitting ? 'Generating Test...' : 'Start AI Generation'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}