'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, FormEvent } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export default function CreateStudentPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [adminUnivId, setAdminUnivId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '', email: '', password: '', studentId: '', phone: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    async function getAdminProfile() {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) setAdminUnivId(userDoc.data().universityId);
      }
    }
    getAdminProfile();
  }, [user]);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!adminUnivId) { setError('Profile Error: University ID not found.'); return; }
    setSubmitting(true); setError(''); setSuccess('');
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        name: formData.name, email: formData.email, role: 'student',
        universityId: adminUnivId, studentId: formData.studentId,
        phone: formData.phone, createdAt: new Date(), createdBy: user?.uid,
      });
      setSuccess(`Account created for ${formData.email}`);
      setFormData({ name: '', email: '', password: '', studentId: '', phone: '' });
    } catch (err: any) {
      setError(err.message === "Missing or insufficient permissions."
        ? "Permission Denied: Ensure your role is university_admin in Firestore."
        : err.message);
    } finally { setSubmitting(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="loading-dots"><span /><span /><span /></div>
    </div>
  );

  const fields = [
    { name: 'name', label: 'Full Name', type: 'text', required: true },
    { name: 'studentId', label: 'Student ID', type: 'text', required: true },
    { name: 'email', label: 'Email Address', type: 'email', required: true },
    { name: 'password', label: 'Temporary Password', type: 'password', required: true },
    { name: 'phone', label: 'Phone Number', type: 'tel', required: false },
  ];

  return (
    <div className="max-w-lg mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-[-0.02em]">Register Student</h1>
        <p className="text-[var(--text-tertiary)] text-[13px] mt-1">
          University ID: <span className="font-mono text-[#F54E00]">{adminUnivId || 'Loading...'}</span>
        </p>
      </div>

      <div className="window p-6">
        {error && (
          <div className="mb-4 p-3 rounded bg-[#F54E00]/10 text-[#F54E00] border border-[#F54E00]/20 text-[13px] font-medium">{error}</div>
        )}
        {success && (
          <div className="mb-4 p-3 rounded bg-[#4CAF50]/10 text-[#4CAF50] border border-[#4CAF50]/20 text-[13px] font-medium">{success}</div>
        )}

        <form id="form" onSubmit={handleSubmit} className="space-y-4">
          {fields.map((f) => (
            <div key={f.name}>
              <label className="block text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1.5">{f.label} {f.required && '*'}</label>
              <input
                type={f.type} name={f.name} required={f.required}
                value={formData[f.name as keyof typeof formData]}
                onChange={handleChange} disabled={submitting}
                className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-faint)] text-[13px] focus:outline-none focus:border-[#5E6AD2] transition-all duration-150 disabled:opacity-50"
              />
            </div>
          ))}
          <button type="submit" disabled={submitting || !adminUnivId} className="btn-primary w-full mt-2">
            {submitting ? 'Registering...' : 'Complete Registration'}
          </button>
        </form>
      </div>
    </div>
  );
}