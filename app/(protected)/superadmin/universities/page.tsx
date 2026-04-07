'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Building2, Plus, Search, CheckCircle, XCircle, Trash2, Shield, Users, X } from 'lucide-react';

interface University {
  id: string;
  name: string;
  code: string;
  domain: string;
  verified: boolean;
  createdAt: any;
  adminCount?: number;
  studentCount?: number;
}

export default function ManageUniversitiesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [universities, setUniversities] = useState<University[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUni, setNewUni] = useState({ name: '', code: '', domain: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  async function fetchUniversities() {
    try {
      const snapshot = await getDocs(collection(db, 'universities'));
      const unis: University[] = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as University));

      // Fetch admin & student counts per university
      const usersSnap = await getDocs(collection(db, 'users'));
      const adminCounts: Record<string, number> = {};
      const studentCounts: Record<string, number> = {};
      usersSnap.forEach(d => {
        const data = d.data();
        const uid = data.universityId;
        if (!uid) return;
        if (data.role === 'university_admin') adminCounts[uid] = (adminCounts[uid] || 0) + 1;
        if (data.role === 'student') studentCounts[uid] = (studentCounts[uid] || 0) + 1;
      });

      unis.forEach(u => {
        u.adminCount = adminCounts[u.code] || 0;
        u.studentCount = studentCounts[u.code] || 0;
      });

      setUniversities(unis);
    } catch (err) {
      console.error('Error fetching universities:', err);
    } finally {
      setLoadingData(false);
    }
  }

  useEffect(() => { if (user) fetchUniversities(); }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!newUni.name.trim() || !newUni.code.trim()) {
      setError('Name and code are required.');
      return;
    }
    // Check duplicate code
    if (universities.some(u => u.code.toLowerCase() === newUni.code.trim().toLowerCase())) {
      setError('A university with this code already exists.');
      return;
    }
    setCreating(true);
    try {
      const docRef = await addDoc(collection(db, 'universities'), {
        name: newUni.name.trim(),
        code: newUni.code.trim().toUpperCase(),
        domain: newUni.domain.trim(),
        verified: false,
        createdAt: serverTimestamp(),
        createdBy: user?.uid,
      });
      setUniversities(prev => [...prev, {
        id: docRef.id, name: newUni.name.trim(), code: newUni.code.trim().toUpperCase(),
        domain: newUni.domain.trim(), verified: false, createdAt: new Date(),
        adminCount: 0, studentCount: 0,
      }]);
      setNewUni({ name: '', code: '', domain: '' });
      setShowCreate(false);
    } catch (err) {
      console.error('Error creating university:', err);
      setError('Failed to create university.');
    } finally {
      setCreating(false);
    }
  };

  const toggleVerification = async (uni: University) => {
    try {
      await updateDoc(doc(db, 'universities', uni.id), { verified: !uni.verified });
      setUniversities(prev => prev.map(u => u.id === uni.id ? { ...u, verified: !u.verified } : u));
    } catch (err) {
      console.error('Error toggling verification:', err);
    }
  };

  const handleDelete = async (uni: University) => {
    if (!window.confirm(`Delete "${uni.name}"? This won't remove associated admins or students.`)) return;
    try {
      await deleteDoc(doc(db, 'universities', uni.id));
      setUniversities(prev => prev.filter(u => u.id !== uni.id));
    } catch (err) {
      console.error('Error deleting university:', err);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="loading-dots"><span /><span /><span /></div>
    </div>
  );
  if (!user) return null;

  const filtered = searchTerm
    ? universities.filter(u =>
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.domain.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : universities;

  return (
    <div className="max-w-[900px] mx-auto animate-fade-in">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-[-0.02em]">Manage Universities</h1>
          <p className="text-[var(--text-tertiary)] text-[13px] mt-1">{universities.length} registered universit{universities.length !== 1 ? 'ies' : 'y'}</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary inline-flex items-center gap-2">
          <Plus size={14} /> Add University
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
        <input
          type="text" placeholder="Search universities..."
          value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[#4B8BBE] transition-all duration-150"
        />
      </div>

      {/* University list */}
      {loadingData ? (
        <div className="flex items-center justify-center py-12">
          <div className="loading-dots"><span /><span /><span /></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="window p-12 text-center">
          <Building2 size={32} className="mx-auto text-[var(--text-faint)] mb-3" />
          <p className="text-[var(--text-tertiary)] text-[13px]">
            {searchTerm ? 'No universities match your search.' : 'No universities registered yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(uni => (
            <div key={uni.id} className="window p-4 hover:border-[var(--border-active)] transition-colors duration-150">
              <div className="flex items-center gap-4">
                {/* Icon */}
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  uni.verified ? 'bg-[#4CAF50]/10' : 'bg-[var(--bg-surface)]'
                }`}>
                  <Building2 size={18} className={uni.verified ? 'text-[#4CAF50]' : 'text-[var(--text-faint)]'} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[14px] font-bold text-[var(--text-primary)] truncate">{uni.name}</h3>
                    {uni.verified ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#4CAF50]/10 text-[#4CAF50] border border-[#4CAF50]/20">
                        <CheckCircle size={10} /> Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#F1A82C]/10 text-[#F1A82C] border border-[#F1A82C]/20">
                        <XCircle size={10} /> Pending
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[12px] text-[var(--text-tertiary)]">
                    <span className="font-mono text-[#00A8E1]">{uni.code}</span>
                    {uni.domain && <span>· {uni.domain}</span>}
                    <span className="flex items-center gap-1"><Shield size={10} /> {uni.adminCount} admin{uni.adminCount !== 1 ? 's' : ''}</span>
                    <span className="flex items-center gap-1"><Users size={10} /> {uni.studentCount} student{uni.studentCount !== 1 ? 's' : ''}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => toggleVerification(uni)}
                    className={`px-2.5 py-1.5 rounded text-[11px] font-semibold transition-colors duration-150 ${
                      uni.verified
                        ? 'text-[#F1A82C] hover:bg-[#F1A82C]/10'
                        : 'text-[#4CAF50] hover:bg-[#4CAF50]/10'
                    }`}
                  >
                    {uni.verified ? 'Revoke' : 'Verify'}
                  </button>
                  <button
                    onClick={() => handleDelete(uni)}
                    className="p-1.5 rounded text-[var(--text-faint)] hover:text-[#00A8E1] hover:bg-[#00A8E1]/10 transition-colors duration-150"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="window w-full max-w-md p-6 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-[#4B8BBE]" />
                <h2 className="text-[15px] font-bold text-[var(--text-primary)]">Register University</h2>
              </div>
              <button onClick={() => setShowCreate(false)} className="text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors">
                <X size={16} />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded bg-[#00A8E1]/10 text-[#00A8E1] border border-[#00A8E1]/20 text-[13px] font-medium">{error}</div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1.5">University Name *</label>
                <input
                  type="text" required value={newUni.name}
                  onChange={e => setNewUni(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g., Harvard University"
                  className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-faint)] text-[13px] focus:outline-none focus:border-[#4B8BBE] transition-all duration-150"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1.5">University Code *</label>
                <input
                  type="text" required value={newUni.code}
                  onChange={e => setNewUni(p => ({ ...p, code: e.target.value }))}
                  placeholder="e.g., HARV-001"
                  className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-faint)] text-[13px] focus:outline-none focus:border-[#4B8BBE] transition-all duration-150 uppercase"
                />
                <p className="text-[10px] text-[var(--text-faint)] mt-1">Unique identifier. Used to link admins & students.</p>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1.5">Domain</label>
                <input
                  type="text" value={newUni.domain}
                  onChange={e => setNewUni(p => ({ ...p, domain: e.target.value }))}
                  placeholder="e.g., harvard.edu"
                  className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-faint)] text-[13px] focus:outline-none focus:border-[#4B8BBE] transition-all duration-150"
                />
              </div>
              <button type="submit" disabled={creating} className="btn-primary w-full mt-2">
                {creating ? 'Registering...' : 'Register University'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
