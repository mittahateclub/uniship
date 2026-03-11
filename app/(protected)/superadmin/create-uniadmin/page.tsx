'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, FormEvent } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export default function CreateUniadminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: '', email: '', password: '', universityName: '', universityId: '', phone: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(''); setSuccess(''); setSubmitting(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        name: formData.name, email: formData.email, role: 'university_admin',
        universityName: formData.universityName, universityId: formData.universityId,
        phone: formData.phone, createdAt: new Date(), createdBy: user?.uid,
      });
      setSuccess(`University Admin account created for ${formData.email}`);
      setFormData({ name: '', email: '', password: '', universityName: '', universityId: '', phone: '' });
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') setError('This email is already registered.');
      else if (err.code === 'auth/weak-password') setError('Password should be at least 6 characters.');
      else setError('Failed to create account. Please try again.');
    } finally { setSubmitting(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="loading-dots"><span /><span /><span /></div>
    </div>
  );
  if (!user) return null;

  const fields = [
    { name: 'name', label: 'Full Name', type: 'text', placeholder: "Enter admin's full name", required: true },
    { name: 'email', label: 'Email Address', type: 'email', placeholder: 'admin@university.edu', required: true },
    { name: 'password', label: 'Password', type: 'password', placeholder: 'Min 6 characters', required: true },
    { name: 'universityName', label: 'University Name', type: 'text', placeholder: 'e.g., Harvard University', required: true },
    { name: 'universityId', label: 'University ID', type: 'text', placeholder: 'e.g., HARV-001', required: true },
    { name: 'phone', label: 'Phone Number', type: 'tel', placeholder: '+1 (555) 123-4567', required: false },
  ];

  return (
    <div className="max-w-lg mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-[-0.02em]">Create University Admin</h1>
        <p className="text-[var(--text-tertiary)] text-[13px] mt-1">Add a new university administrator account</p>
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
                type={f.type} name={f.name} placeholder={f.placeholder} required={f.required}
                value={formData[f.name as keyof typeof formData]}
                onChange={handleChange} disabled={submitting}
                className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-faint)] text-[13px] focus:outline-none focus:border-[#5E6AD2] transition-all duration-150 disabled:opacity-50"
              />
            </div>
          ))}
          <button type="submit" disabled={submitting} className="btn-primary w-full mt-2">
            {submitting ? 'Creating Account...' : 'Create University Admin'}
          </button>
        </form>
      </div>
    </div>
  );
}