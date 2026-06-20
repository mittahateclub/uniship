'use client';
import { useTransitionRouter } from 'next-view-transitions';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState, FormEvent } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, getDocs } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { CreateUniadminView, type University, type CreateUniadminFormData } from './create-uniadmin.view';

export default function CreateUniadminPage() {
  const { user, loading } = useAuth();
  const router = useTransitionRouter();

  const [universities, setUniversities] = useState<University[]>([]);
  const [loadingUnis, setLoadingUnis] = useState(true);
  const [selectedUni, setSelectedUni] = useState<University | null>(null);
  const [uniDropdownOpen, setUniDropdownOpen] = useState(false);
  const [uniSearch, setUniSearch] = useState('');

  const [formData, setFormData] = useState<CreateUniadminFormData>({
    name: '', email: '', password: '', phone: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  useEffect(() => {
    async function fetchUniversities() {
      try {
        const snapshot = await getDocs(collection(db, 'universities'));
        setUniversities(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as University)));
      } catch (err) {
        console.error('Error fetching universities:', err);
      } finally {
        setLoadingUnis(false);
      }
    }
    fetchUniversities();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedUni) { setError('Please select a university.'); return; }
    if (!selectedUni.verified) { setError('Selected university is not verified. Verify it first from the Universities page.'); return; }
    setError(''); setSuccess(''); setSubmitting(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        name: formData.name, email: formData.email, role: 'university_admin',
        universityName: selectedUni.name, universityId: selectedUni.code,
        phone: formData.phone, createdAt: new Date(), createdBy: user?.uid,
        verified: true,
      });
      setSuccess(`University Admin account created for ${formData.email} → ${selectedUni.name}`);
      setFormData({ name: '', email: '', password: '', phone: '' });
      setSelectedUni(null);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/email-already-in-use') setError('This email is already registered.');
      else if (code === 'auth/weak-password') setError('Password should be at least 6 characters.');
      else setError('Failed to create account. Please try again.');
    } finally { setSubmitting(false); }
  };

  if (!loading && !user) return null;

  return (
    <CreateUniadminView
      loading={loading}
      loadingUnis={loadingUnis}
      universities={universities}
      selectedUni={selectedUni}
      uniDropdownOpen={uniDropdownOpen}
      uniSearch={uniSearch}
      formData={formData}
      submitting={submitting}
      error={error}
      success={success}
      onToggleDropdown={() => setUniDropdownOpen(!uniDropdownOpen)}
      onSelectUni={(uni) => { setSelectedUni(uni); setUniDropdownOpen(false); setUniSearch(''); }}
      onUniSearchChange={setUniSearch}
      onChange={handleChange}
      onSubmit={handleSubmit}
    />
  );
}
