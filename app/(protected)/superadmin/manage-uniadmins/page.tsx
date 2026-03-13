'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { UserPlus, Mail, Building2, Hash, Phone, CheckCircle, XCircle, Shield, X, Save } from 'lucide-react';

interface UniadminData {
  id: string;
  name: string;
  email: string;
  universityName: string;
  universityId: string;
  phone: string;
  verified: boolean;
  createdAt: any;
}

interface University {
  id: string;
  name: string;
  code: string;
  verified: boolean;
}

export default function ManageUniadminsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [uniadmins, setUniadmins] = useState<UniadminData[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [viewingAdmin, setViewingAdmin] = useState<UniadminData | null>(null);
  const [editingAdmin, setEditingAdmin] = useState<UniadminData | null>(null);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    universityId: '',
    verified: false,
  });
  const [editError, setEditError] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    async function fetchUniadmins() {
      try {
        const [adminSnap, uniSnap] = await Promise.all([
          getDocs(query(collection(db, 'users'), where('role', '==', 'university_admin'))),
          getDocs(collection(db, 'universities')),
        ]);
        const admins: UniadminData[] = [];
        adminSnap.forEach((d) => {
          admins.push({ id: d.id, ...d.data() } as UniadminData);
        });
        const unis: University[] = uniSnap.docs.map((d) => ({ id: d.id, ...d.data() } as University));
        setUniadmins(admins);
        setUniversities(unis);
      } catch (error) {
        console.error('Error fetching uniadmins:', error);
      } finally {
        setLoadingData(false);
      }
    }
    if (user) fetchUniadmins();
  }, [user]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="loading-dots"><span /><span /><span /></div>
    </div>
  );
  if (!user) return null;

  const formatDate = (value: any) => {
    try {
      if (!value) return 'N/A';
      if (typeof value?.toDate === 'function') return value.toDate().toLocaleString();
      return new Date(value).toLocaleString();
    } catch {
      return 'N/A';
    }
  };

  const openEdit = (admin: UniadminData) => {
    setEditError('');
    setEditingAdmin(admin);
    setEditForm({
      name: admin.name || '',
      phone: admin.phone || '',
      universityId: admin.universityId || '',
      verified: !!admin.verified,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingAdmin) return;
    const selectedUniversity = universities.find((u) => u.code === editForm.universityId);
    if (!selectedUniversity) {
      setEditError('Please select a valid university.');
      return;
    }

    setSaving(true);
    setEditError('');
    try {
      const updates = {
        name: editForm.name.trim(),
        phone: editForm.phone.trim(),
        universityId: selectedUniversity.code,
        universityName: selectedUniversity.name,
        verified: editForm.verified,
        updatedAt: new Date(),
      };
      await updateDoc(doc(db, 'users', editingAdmin.id), updates);
      setUniadmins((prev) => prev.map((admin) => (
        admin.id === editingAdmin.id ? { ...admin, ...updates } : admin
      )));
      setEditingAdmin(null);
    } catch (error) {
      console.error('Error updating admin:', error);
      setEditError('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickVerifyToggle = async (admin: UniadminData) => {
    const nextVerified = !admin.verified;
    try {
      await updateDoc(doc(db, 'users', admin.id), { verified: nextVerified, updatedAt: new Date() });
      setUniadmins((prev) => prev.map((a) => (a.id === admin.id ? { ...a, verified: nextVerified } : a)));
      setViewingAdmin((prev) => (prev && prev.id === admin.id ? { ...prev, verified: nextVerified } : prev));
    } catch (error) {
      console.error('Error toggling verification:', error);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-[-0.02em]">Manage University Admins</h1>
          <p className="text-[var(--text-tertiary)] text-[13px] mt-1">View and manage all university administrators</p>
        </div>
        <Link href="/superadmin/create-uniadmin" className="btn-primary inline-flex items-center gap-2">
          <UserPlus size={14} /> Create New Admin
        </Link>
      </div>

      {loadingData ? (
        <div className="flex items-center justify-center py-12">
          <div className="loading-dots"><span /><span /><span /></div>
        </div>
      ) : uniadmins.length === 0 ? (
        <div className="window p-12 text-center">
          <p className="text-[var(--text-tertiary)] mb-4">No university admins found</p>
          <Link href="/superadmin/create-uniadmin" className="btn-primary inline-flex items-center gap-2">
            <UserPlus size={14} /> Create First Admin
          </Link>
        </div>
      ) : (
        <div id="admin-list" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {uniadmins.map((admin) => (
            <div key={admin.id} className="window p-5 group hover:border-[var(--border-active)] transition-colors duration-150">
              <div className="flex items-center justify-between mb-3">
                <div className="w-8 h-8 rounded bg-[#F54E00]/10 flex items-center justify-center text-[#F54E00] text-sm font-bold">
                  {admin.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div className="flex items-center gap-1.5">
                  {admin.verified ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#4CAF50] bg-[#4CAF50]/10 border border-[#4CAF50]/20 px-1.5 py-0.5 rounded">
                      <CheckCircle size={9} /> Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#F1A82C] bg-[#F1A82C]/10 border border-[#F1A82C]/20 px-1.5 py-0.5 rounded">
                      <XCircle size={9} /> Pending
                    </span>
                  )}
                </div>
              </div>

              <h3 className="text-[15px] font-bold text-[var(--text-primary)] mb-3">{admin.name}</h3>

              <div className="space-y-2 text-[13px]">
                <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
                  <Mail size={12} className="text-[var(--text-faint)] shrink-0" />
                  <span className="truncate">{admin.email}</span>
                </div>
                <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
                  <Building2 size={12} className="text-[var(--text-faint)] shrink-0" />
                  <span className="truncate">{admin.universityName}</span>
                </div>
                <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
                  <Hash size={12} className="text-[var(--text-faint)] shrink-0" />
                  <span>{admin.universityId}</span>
                </div>
                {admin.phone && (
                  <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
                    <Phone size={12} className="text-[var(--text-faint)] shrink-0" />
                    <span>{admin.phone}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] flex gap-2">
                <button
                  onClick={() => setViewingAdmin(admin)}
                  className="btn-primary flex-1 text-[12px] py-1.5"
                >
                  View Details
                </button>
                <button
                  onClick={() => openEdit(admin)}
                  className="btn-secondary flex-1 text-[12px] py-1.5"
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewingAdmin && (
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4" onClick={() => setViewingAdmin(null)}>
          <div className="window w-full max-w-md p-6 animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-bold text-[var(--text-primary)]">Admin Details</h2>
              <button onClick={() => setViewingAdmin(null)} className="text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-[13px]">
              <div className="flex items-start gap-2 text-[var(--text-tertiary)]">
                <Mail size={13} className="text-[var(--text-faint)] mt-0.5" />
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-[var(--text-faint)]">Email</p>
                  <p className="text-[var(--text-primary)]">{viewingAdmin.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-2 text-[var(--text-tertiary)]">
                <Building2 size={13} className="text-[var(--text-faint)] mt-0.5" />
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-[var(--text-faint)]">University</p>
                  <p className="text-[var(--text-primary)]">{viewingAdmin.universityName}</p>
                </div>
              </div>
              <div className="flex items-start gap-2 text-[var(--text-tertiary)]">
                <Hash size={13} className="text-[var(--text-faint)] mt-0.5" />
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-[var(--text-faint)]">University ID</p>
                  <p className="text-[var(--text-primary)] font-mono">{viewingAdmin.universityId}</p>
                </div>
              </div>
              <div className="flex items-start gap-2 text-[var(--text-tertiary)]">
                <Phone size={13} className="text-[var(--text-faint)] mt-0.5" />
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-[var(--text-faint)]">Phone</p>
                  <p className="text-[var(--text-primary)]">{viewingAdmin.phone || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-start gap-2 text-[var(--text-tertiary)]">
                <Shield size={13} className="text-[var(--text-faint)] mt-0.5" />
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-[var(--text-faint)]">Status</p>
                  <p className={viewingAdmin.verified ? 'text-[#4CAF50] font-semibold' : 'text-[#F1A82C] font-semibold'}>
                    {viewingAdmin.verified ? 'Verified' : 'Pending Verification'}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[var(--text-faint)]">Created At</p>
                <p className="text-[var(--text-primary)]">{formatDate(viewingAdmin.createdAt)}</p>
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => handleQuickVerifyToggle(viewingAdmin)}
                className={`flex-1 py-2 text-[12px] rounded border transition-colors ${
                  viewingAdmin.verified
                    ? 'text-[#F1A82C] border-[#F1A82C]/30 hover:bg-[#F1A82C]/10'
                    : 'text-[#4CAF50] border-[#4CAF50]/30 hover:bg-[#4CAF50]/10'
                }`}
              >
                {viewingAdmin.verified ? 'Mark as Pending' : 'Verify Admin'}
              </button>
              <button
                onClick={() => {
                  openEdit(viewingAdmin);
                  setViewingAdmin(null);
                }}
                className="btn-primary flex-1 py-2 text-[12px]"
              >
                Edit Details
              </button>
            </div>
          </div>
        </div>
      )}

      {editingAdmin && (
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4" onClick={() => setEditingAdmin(null)}>
          <div className="window w-full max-w-md p-6 animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-bold text-[var(--text-primary)]">Edit University Admin</h2>
              <button onClick={() => setEditingAdmin(null)} className="text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors">
                <X size={16} />
              </button>
            </div>

            {editError && (
              <div className="mb-3 p-2 rounded bg-[#F54E00]/10 text-[#F54E00] border border-[#F54E00]/20 text-[12px]">
                {editError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[#5E6AD2]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1.5">Phone</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[#5E6AD2]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1.5">University</label>
                <select
                  value={editForm.universityId}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, universityId: e.target.value }))}
                  className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[#5E6AD2]"
                >
                  <option value="">Select university</option>
                  {universities.map((uni) => (
                    <option key={uni.id} value={uni.code}>{uni.name} ({uni.code})</option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 text-[13px] text-[var(--text-primary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.verified}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, verified: e.target.checked }))}
                />
                Mark admin as verified
              </label>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setEditingAdmin(null)} className="btn-secondary flex-1 py-2 text-[12px]">Cancel</button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="btn-primary flex-1 py-2 text-[12px] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save size={12} />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}