'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, FormEvent } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { CreateAccountView, type CreateAccountFormData } from './create-account.view';

export default function CreateStudentPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [adminUnivId, setAdminUnivId] = useState<string | null>(null);
  const [adminUnivName, setAdminUnivName] = useState<string | null>(null);

  const [formData, setFormData] = useState<CreateAccountFormData>({
    name: '', email: '', password: '', studentId: '', phone: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    async function getAdminProfile() {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setAdminUnivId(userDoc.data().universityId || null);
          setAdminUnivName(userDoc.data().universityName || null);
        }
      }
    }
    getAdminProfile();
  }, [user]);

  useEffect(() => {
    if (!loading && !user) router.push('/');
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
        universityName: adminUnivName || '', verified: false,
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

  return (
    <CreateAccountView
      loading={loading}
      adminUnivId={adminUnivId}
      formData={formData}
      submitting={submitting}
      error={error}
      success={success}
      onChange={handleChange}
      onSubmit={handleSubmit}
    />
  );
}
