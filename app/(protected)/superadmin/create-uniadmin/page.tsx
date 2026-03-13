'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, FormEvent } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Building2, ChevronDown, Search, CheckCircle, XCircle } from 'lucide-react';

interface University {
  id: string;
  name: string;
  code: string;
  domain: string;
  verified: boolean;
}

export default function CreateUniadminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [universities, setUniversities] = useState<University[]>([]);
  const [loadingUnis, setLoadingUnis] = useState(true);
  const [selectedUni, setSelectedUni] = useState<University | null>(null);
  const [uniDropdownOpen, setUniDropdownOpen] = useState(false);
  const [uniSearch, setUniSearch] = useState('');

  const [formData, setFormData] = useState({
    name: '', email: '', password: '', phone: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push('/login');
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

  const filteredUnis = uniSearch
    ? universities.filter(u =>
        u.name.toLowerCase().includes(uniSearch.toLowerCase()) ||
        u.code.toLowerCase().includes(uniSearch.toLowerCase())
      )
    : universities;

  const fields = [
    { name: 'name', label: 'Full Name', type: 'text', placeholder: "Enter admin's full name", required: true },
    { name: 'email', label: 'Email Address', type: 'email', placeholder: 'admin@university.edu', required: true },
    { name: 'password', label: 'Password', type: 'password', placeholder: 'Min 6 characters', required: true },
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
          {/* University Selector */}
          <div>
            <label className="block text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1.5">University *</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setUniDropdownOpen(!uniDropdownOpen)}
                className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded text-[13px] text-left focus:outline-none focus:border-[#5E6AD2] transition-all duration-150 flex items-center justify-between"
              >
                {selectedUni ? (
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 size={13} className="text-[#F54E00] shrink-0" />
                    <span className="text-[var(--text-primary)] truncate">{selectedUni.name}</span>
                    <span className="text-[11px] font-mono text-[var(--text-faint)] shrink-0">{selectedUni.code}</span>
                    {selectedUni.verified ? (
                      <CheckCircle size={12} className="text-[#4CAF50] shrink-0" />
                    ) : (
                      <XCircle size={12} className="text-[#F1A82C] shrink-0" />
                    )}
                  </div>
                ) : (
                  <span className="text-[var(--text-faint)]">
                    {loadingUnis ? 'Loading universities...' : 'Select a university'}
                  </span>
                )}
                <ChevronDown size={14} className={`text-[var(--text-faint)] transition-transform ${uniDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {uniDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg shadow-lg z-50 overflow-hidden">
                  <div className="p-2 border-b border-[var(--border-subtle)]">
                    <div className="relative">
                      <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
                      <input
                        type="text" placeholder="Search universities..."
                        value={uniSearch} onChange={e => setUniSearch(e.target.value)}
                        className="w-full pl-7 pr-2 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[#5E6AD2]"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {filteredUnis.length === 0 ? (
                      <div className="px-3 py-4 text-center text-[12px] text-[var(--text-faint)]">
                        {loadingUnis ? 'Loading...' : 'No universities found. Create one first.'}
                      </div>
                    ) : (
                      filteredUnis.map(uni => (
                        <button
                          key={uni.id} type="button"
                          onClick={() => { setSelectedUni(uni); setUniDropdownOpen(false); setUniSearch(''); }}
                          className={`w-full px-3 py-2.5 text-left hover:bg-[var(--bg-elevated)] transition-colors flex items-center gap-2 ${
                            selectedUni?.id === uni.id ? 'bg-[#5E6AD2]/5' : ''
                          }`}
                        >
                          <Building2 size={13} className="text-[var(--text-faint)] shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[13px] font-medium text-[var(--text-primary)] truncate">{uni.name}</span>
                              {uni.verified ? (
                                <CheckCircle size={11} className="text-[#4CAF50] shrink-0" />
                              ) : (
                                <XCircle size={11} className="text-[#F1A82C] shrink-0" />
                              )}
                            </div>
                            <span className="text-[11px] font-mono text-[var(--text-faint)]">{uni.code}</span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            {!selectedUni && universities.length === 0 && !loadingUnis && (
              <p className="text-[11px] text-[#F1A82C] mt-1.5">
                No universities registered. <a href="/superadmin/universities" className="underline">Create one first →</a>
              </p>
            )}
          </div>

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
          <button type="submit" disabled={submitting || !selectedUni} className="btn-primary w-full mt-2 disabled:opacity-50">
            {submitting ? 'Creating Account...' : 'Create University Admin'}
          </button>
        </form>
      </div>
    </div>
  );
}