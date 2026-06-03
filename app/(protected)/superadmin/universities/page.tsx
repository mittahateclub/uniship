'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UniversitiesView, type University } from './universities.view';

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

  if (!loading && !user) return null;

  const filtered = searchTerm
    ? universities.filter(u =>
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.domain.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : universities;

  return (
    <UniversitiesView
      loading={loading}
      loadingData={loadingData}
      universities={universities}
      filtered={filtered}
      searchTerm={searchTerm}
      showCreate={showCreate}
      creating={creating}
      newUni={newUni}
      error={error}
      onSearchTermChange={setSearchTerm}
      onShowCreate={() => setShowCreate(true)}
      onHideCreate={() => setShowCreate(false)}
      onNewUniChange={setNewUni}
      onCreate={handleCreate}
      onToggleVerification={toggleVerification}
      onDelete={handleDelete}
    />
  );
}
