'use client';
import { Link, useTransitionRouter } from 'next-view-transitions';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import {
  collection, query, where, getDocs, doc, updateDoc, documentId,
  limit as queryLimit, orderBy, startAfter, type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import UserPlus from '@/components/icons/UserPlus';
import Mail from '@/components/icons/Mail';
import Building2 from '@/components/icons/Building2';
import Hash from '@/components/icons/Hash';
import Phone from '@/components/icons/Phone';
import CheckCircle from '@/components/icons/CheckCircle';
import XCircle from '@/components/icons/XCircle';
import Shield from '@/components/icons/Shield';
import ShieldCheck from '@/components/icons/ShieldCheck';
import Save from '@/components/icons/Save';
import Pencil from '@/components/icons/Pencil';
import { StatBar } from '@/components/StatBar';
import { Modal, ModalHeader, ModalBody } from '@/components/Modal';
import { getCache, setCache } from '@/lib/page-cache';

interface UniadminData {
  id: string;
  name: string;
  email: string;
  universityName: string;
  universityId: string;
  phone: string;
  verified: boolean;
  createdAt: unknown;
}

interface University {
  id: string;
  name: string;
  code: string;
  verified: boolean;
}

type CachedUniadmins = { uniadmins: UniadminData[]; universities: University[] };

const ghostBtn = 'px-2.5 py-1.5 rounded-[8px] text-[11px] font-semibold border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-active)] hover:text-[var(--text-primary)] transition-colors';
const fieldLabel = 'block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.07em] mb-1.5';
const PAGE_SIZE = 50;

export default function ManageUniadminsPage() {
  const { user, loading } = useAuth();
  const router = useTransitionRouter();
  const cacheKey = user ? `superadmin-uniadmins:${user.uid}` : '';
  const [uniadmins, setUniadmins] = useState<UniadminData[]>(() => (cacheKey ? getCache<CachedUniadmins>(cacheKey)?.uniadmins : undefined) ?? []);
  const [universities, setUniversities] = useState<University[]>(() => (cacheKey ? getCache<CachedUniadmins>(cacheKey)?.universities : undefined) ?? []);
  const [loadingData, setLoadingData] = useState(() => !(cacheKey && getCache<CachedUniadmins>(cacheKey)));
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
  const [lastAdminDoc, setLastAdminDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  useEffect(() => {
    async function fetchUniadmins() {
      try {
        const [adminSnap, uniSnap] = await Promise.all([
          getDocs(query(collection(db, 'users'), where('role', '==', 'university_admin'), orderBy(documentId()), queryLimit(PAGE_SIZE))),
          getDocs(collection(db, 'universities')),
        ]);
        const admins: UniadminData[] = [];
        adminSnap.forEach((d) => {
          admins.push({ id: d.id, ...d.data() } as UniadminData);
        });
        const unis: University[] = uniSnap.docs.map((d) => ({ id: d.id, ...d.data() } as University));
        setUniadmins(admins);
        setLastAdminDoc(adminSnap.docs.at(-1) ?? null);
        setHasMore(adminSnap.size === PAGE_SIZE);
        setUniversities(unis);
        if (cacheKey) setCache<CachedUniadmins>(cacheKey, { uniadmins: admins, universities: unis });
      } catch (error) {
        console.error('Error fetching uniadmins:', error);
      } finally {
        setLoadingData(false);
      }
    }
    if (user) fetchUniadmins();
  }, [user, cacheKey]);

  const loadMore = async () => {
    if (!lastAdminDoc || loadingMore) return;
    setLoadingMore(true);
    try {
      const snapshot = await getDocs(query(
        collection(db, 'users'),
        where('role', '==', 'university_admin'),
        orderBy(documentId()),
        startAfter(lastAdminDoc),
        queryLimit(PAGE_SIZE),
      ));
      setUniadmins((prev) => [
        ...prev,
        ...snapshot.docs.map((adminDoc) => ({ id: adminDoc.id, ...adminDoc.data() } as UniadminData)),
      ]);
      setLastAdminDoc(snapshot.docs.at(-1) ?? lastAdminDoc);
      setHasMore(snapshot.size === PAGE_SIZE);
    } catch (error) {
      console.error('Error loading more admins:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="loading-dots"><span /><span /><span /></div>
    </div>
  );
  if (!user) return null;

  const formatDate = (value: unknown) => {
    try {
      if (!value) return 'N/A';
      if (typeof (value as { toDate?: unknown }).toDate === 'function') return (value as { toDate: () => Date }).toDate().toLocaleString();
      return new Date(value as string | number | Date).toLocaleString();
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

  const verifiedCount = uniadmins.filter((a) => a.verified).length;

  const detailRows = (a: UniadminData) => [
    { icon: Mail, label: 'Email', value: a.email },
    { icon: Building2, label: 'University', value: a.universityName },
    { icon: Hash, label: 'University ID', value: a.universityId, mono: true },
    { icon: Phone, label: 'Phone', value: a.phone || 'N/A' },
  ];

  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in">
      {/* ── Header ── */}
      <div className="pt-8 mb-7 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-semibold text-[var(--text-primary)] tracking-[-0.025em]">University Admins</h1>
          <p className="text-[var(--text-tertiary)] text-[13.5px] mt-1.5">View, verify and manage all university administrators.</p>
        </div>
        <Link href="/superadmin/create-uniadmin" className="btn-primary !rounded-[10px] inline-flex items-center gap-2 text-[12.5px] !px-3.5 !py-2">
          <UserPlus size={14} /> Create Admin
        </Link>
      </div>

      {/* ── Overview ── */}
      <StatBar
        className="mb-6"
        items={[
          { label: 'admins', value: uniadmins.length, icon: ShieldCheck },
          { label: 'verified', value: verifiedCount, icon: CheckCircle, accent: verifiedCount > 0 ? 'text-[var(--status-success)]' : undefined },
          { label: 'pending', value: uniadmins.length - verifiedCount, icon: XCircle, accent: uniadmins.length - verifiedCount > 0 ? 'text-[var(--status-warning)]' : undefined },
        ]}
      />

      {/* ── List ── */}
      {loadingData ? (
        <div className="flex items-center justify-center py-12"><div className="loading-dots"><span /><span /><span /></div></div>
      ) : uniadmins.length === 0 ? (
        <div className="text-center py-16 border border-[var(--border-subtle)] rounded-[var(--radius)] bg-[var(--bg-surface)]">
          <ShieldCheck size={26} className="mx-auto text-[var(--text-faint)] mb-3" />
          <p className="text-[var(--text-primary)] text-[13px] font-medium">No university admins yet.</p>
          <Link href="/superadmin/create-uniadmin" className="text-[12px] text-[var(--accent-orange)] hover:underline mt-1 inline-block">Create the first admin →</Link>
        </div>
      ) : (
        <div id="admin-list" className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
          {uniadmins.map((admin) => (
            <div key={admin.id} className="group flex items-center gap-3.5 px-4 sm:px-5 py-3.5 border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-elevated)] transition-colors">
              <span className="w-10 h-10 rounded-full bg-[var(--type-event)]/15 text-[var(--type-event)] flex items-center justify-center text-[15px] font-bold shrink-0 uppercase">
                {admin.name?.charAt(0)?.toUpperCase() || '?'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-[14px] font-semibold text-[var(--text-primary)] truncate">{admin.name || 'Unnamed Admin'}</h3>
                  {admin.verified ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--status-success)]/10 text-[var(--status-success)] shrink-0">
                      <CheckCircle size={10} /> Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--status-warning)]/10 text-[var(--status-warning)] shrink-0">
                      <XCircle size={10} /> Pending
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11.5px] text-[var(--text-tertiary)]">
                  <span className="inline-flex items-center gap-1 min-w-0"><Mail size={11} className="shrink-0" /><span className="truncate">{admin.email}</span></span>
                  <span className="inline-flex items-center gap-1"><Building2 size={11} /> {admin.universityName}</span>
                  <span className="font-mono text-[var(--accent-orange)]">{admin.universityId}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-within:opacity-100 transition-opacity">
                <button onClick={() => setViewingAdmin(admin)} className={ghostBtn}>View</button>
                <button onClick={() => openEdit(admin)} className={ghostBtn}>Edit</button>
              </div>
            </div>
          ))}
          {hasMore && (
            <div className="flex justify-center p-3 border-t border-[var(--border-subtle)]">
              <button type="button" onClick={loadMore} disabled={loadingMore} className="btn-secondary !rounded-[10px] text-[12px] disabled:opacity-50">
                {loadingMore ? 'Loading…' : 'Load more admins'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── View modal ── */}
      <Modal open={!!viewingAdmin} onClose={() => setViewingAdmin(null)} size="md">
        {viewingAdmin && (
          <>
            <ModalHeader
              icon={Shield}
              iconClass={viewingAdmin.verified ? 'text-[var(--status-success)]' : 'text-[var(--status-warning)]'}
              iconWrapClass={viewingAdmin.verified ? 'bg-[var(--status-success)]/10' : 'bg-[var(--status-warning)]/10'}
              title={viewingAdmin.name || 'Admin details'}
              subtitle={viewingAdmin.email}
              onClose={() => setViewingAdmin(null)}
            />
            <ModalBody className="space-y-3">
              {detailRows(viewingAdmin).map((row) => (
                <div key={row.label} className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-[8px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0 text-[var(--text-tertiary)]">
                    <row.icon size={15} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)]">{row.label}</p>
                    <p className={`text-[13px] text-[var(--text-primary)] truncate ${row.mono ? 'font-mono' : ''}`}>{row.value}</p>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between gap-2 pt-3 mt-1 border-t border-[var(--border-subtle)]">
                <span className="text-[11.5px] text-[var(--text-faint)]">Added {formatDate(viewingAdmin.createdAt)}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleQuickVerifyToggle(viewingAdmin)} className={ghostBtn}>
                    {viewingAdmin.verified ? 'Mark pending' : 'Verify'}
                  </button>
                  <button
                    onClick={() => { openEdit(viewingAdmin); setViewingAdmin(null); }}
                    className="px-2.5 py-1.5 rounded-[8px] text-[11px] font-semibold bg-[var(--accent-orange)] text-[var(--accent-ink)] hover:opacity-90 transition-opacity inline-flex items-center gap-1.5"
                  >
                    <Pencil size={11} /> Edit
                  </button>
                </div>
              </div>
            </ModalBody>
          </>
        )}
      </Modal>

      {/* ── Edit modal ── */}
      <Modal open={!!editingAdmin} onClose={() => setEditingAdmin(null)} size="md">
        {editingAdmin && (
          <>
            <ModalHeader
              icon={Pencil}
              title="Edit University Admin"
              subtitle={editingAdmin.email}
              onClose={() => setEditingAdmin(null)}
            />
            <ModalBody className="space-y-4">
              {editError && (
                <div className="p-3 rounded-[var(--radius)] bg-[var(--status-danger)]/10 text-[var(--status-danger)] border border-[var(--status-danger)]/20 text-[12.5px] font-medium">{editError}</div>
              )}
              <div>
                <label className={fieldLabel}>Full Name</label>
                <input type="text" value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} className="w-full px-3.5 py-2.5 text-[13px]" />
              </div>
              <div>
                <label className={fieldLabel}>Phone</label>
                <input type="text" value={editForm.phone} onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))} className="w-full px-3.5 py-2.5 text-[13px]" />
              </div>
              <div>
                <label className={fieldLabel}>University</label>
                <select value={editForm.universityId} onChange={(e) => setEditForm((p) => ({ ...p, universityId: e.target.value }))} className="w-full px-3.5 py-2.5 text-[13px]">
                  <option value="">Select university</option>
                  {universities.map((uni) => (
                    <option key={uni.id} value={uni.code}>{uni.name} ({uni.code})</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2.5 text-[13px] text-[var(--text-primary)] cursor-pointer">
                <input type="checkbox" checked={editForm.verified} onChange={(e) => setEditForm((p) => ({ ...p, verified: e.target.checked }))} className="w-4 h-4 accent-[var(--accent-orange)]" />
                Mark admin as verified
              </label>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setEditingAdmin(null)} className="btn-secondary !rounded-[10px] flex-1">Cancel</button>
                <button onClick={handleSaveEdit} disabled={saving} className="btn-primary !rounded-[10px] flex-1 inline-flex items-center justify-center gap-2 disabled:opacity-50">
                  <Save size={13} /> {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </ModalBody>
          </>
        )}
      </Modal>
    </div>
  );
}
