'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, FormEvent } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import Link from 'next/link';

// Mandatory default export to fix the Next.js Runtime Error
export default function CreateStudentPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [adminUnivId, setAdminUnivId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    studentId: '',
    phone: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 1. Dynamic fetch to ensure the security rules match the university ID
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
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!adminUnivId) {
      setError('Profile Error: University ID not found in your account.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      // 2. Register the user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      // 3. Create student profile with role: 'student'
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        name: formData.name,
        email: formData.email,
        role: 'student',
        universityId: adminUnivId,
        studentId: formData.studentId,
        phone: formData.phone,
        createdAt: new Date(),
        createdBy: user?.uid,
      });

      setSuccess(`Success! Account created for ${formData.email}`);
      setFormData({ name: '', email: '', password: '', studentId: '', phone: '' });
    } catch (err: any) {
      console.error("Creation Error:", err.code, err.message);
      setError(err.message === "Missing or insufficient permissions." 
        ? "Permission Denied: Ensure your role is university_admin in Firestore." 
        : err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="animate-pulse text-black font-medium text-lg">Initializing Admin Session...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link 
            href="/uniadmin/dashboard" 
            className="text-sm font-medium text-gray-500 hover:text-black transition-colors flex items-center gap-2"
          >
            ← Back to Dashboard
          </Link>
        </div>

        <div className="flex flex-col lg:flex-row gap-12">
          {/* Info Section */}
          <div className="lg:w-1/3">
            <h1 className="text-4xl font-bold text-black mb-4 tracking-tight">Register Student</h1>
            <p className="text-gray-600 leading-relaxed">
              Create a unique student profile. This user will inherit your university ID: 
              <span className="block font-mono font-bold text-black mt-2 bg-gray-100 p-2 rounded">
                {adminUnivId || 'Fetching ID...'}
              </span>
            </p>
          </div>

          {/* Form Card */}
          <div className="lg:w-2/3 bg-black rounded-2xl p-8 shadow-2xl">
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500 text-red-500 rounded-lg text-sm font-medium">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-6 p-4 bg-green-500/10 border border-green-500 text-green-500 rounded-lg text-sm font-medium">
                {success}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Full Name</label>
                  <input 
                    name="name" 
                    required 
                    value={formData.name} 
                    onChange={handleChange} 
                    className="w-full p-3 bg-[#1a1a1a] border border-gray-800 rounded-lg text-white focus:outline-none focus:border-white transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Student ID</label>
                  <input 
                    name="studentId" 
                    required 
                    value={formData.studentId} 
                    onChange={handleChange} 
                    className="w-full p-3 bg-[#1a1a1a] border border-gray-800 rounded-lg text-white focus:outline-none focus:border-white transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Email Address</label>
                <input 
                  name="email" 
                  type="email" 
                  required 
                  value={formData.email} 
                  onChange={handleChange} 
                  className="w-full p-3 bg-[#1a1a1a] border border-gray-800 rounded-lg text-white focus:outline-none focus:border-white transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Temporary Password</label>
                <input 
                  name="password" 
                  type="password" 
                  required 
                  value={formData.password} 
                  onChange={handleChange} 
                  className="w-full p-3 bg-[#1a1a1a] border border-gray-800 rounded-lg text-white focus:outline-none focus:border-white transition-colors"
                />
              </div>

              <div className="pt-4">
                <button 
                  type="submit" 
                  disabled={submitting || !adminUnivId} 
                  className="w-full bg-white text-black py-4 rounded-xl font-bold hover:bg-gray-200 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {submitting ? 'Registering...' : 'Complete Registration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}