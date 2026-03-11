'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { UserPlus, Mail, Building2, Hash, Phone } from 'lucide-react';

interface UniadminData {
  id: string;
  name: string;
  email: string;
  universityName: string;
  universityId: string;
  phone: string;
  createdAt: any;
}

export default function ManageUniadminsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [uniadmins, setUniadmins] = useState<UniadminData[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    async function fetchUniadmins() {
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'university_admin'));
        const querySnapshot = await getDocs(q);
        const admins: UniadminData[] = [];
        querySnapshot.forEach((doc) => {
          admins.push({ id: doc.id, ...doc.data() } as UniadminData);
        });
        setUniadmins(admins);
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
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] border border-[var(--border-subtle)] px-2 py-0.5 rounded">
                  Uni Admin
                </span>
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
                <button className="btn-primary flex-1 text-[12px] py-1.5">View Details</button>
                <button className="btn-secondary flex-1 text-[12px] py-1.5">Edit</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}