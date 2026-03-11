'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { FileText, Trash2, CheckCircle, XCircle, Clock, Tag } from 'lucide-react';

export default function ReviewTestsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [testUploads, setTestUploads] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  async function loadTests() {
    if (!user) return;
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const univId = userDoc.data()?.universityId;
      if (univId) {
        const q = query(collection(db, 'tests'), where('universityId', '==', univId));
        const snapshot = await getDocs(q);
        setTestUploads(snapshot.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            title: data.title || data.sourceFileName || 'Untitled Test',
            approved: data.approved ?? false,
          };
        }));
      }
    } catch (err) {
      console.error("Failed to load tests:", err);
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => { loadTests(); }, [user]);

  const handleDelete = async (testId: string) => {
    if (!window.confirm("Are you sure you want to delete this test?")) return;
    setDeletingId(testId);
    try {
      await deleteDoc(doc(db, 'tests', testId));
      setTestUploads(prev => prev.filter(test => test.id !== testId));
    } catch (error) {
      console.error("Error deleting test:", error);
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleApproval = async (testId: string, currentlyApproved: boolean) => {
    setTogglingId(testId);
    try {
      await updateDoc(doc(db, 'tests', testId), { approved: !currentlyApproved });
      setTestUploads(prev => prev.map(t => t.id === testId ? { ...t, approved: !currentlyApproved } : t));
    } catch (error) {
      console.error('Error toggling approval:', error);
    } finally {
      setTogglingId(null);
    }
  };

  if (loading || fetching) return (
    <div className="flex items-center justify-center h-64">
      <div className="loading-dots"><span /><span /><span /></div>
    </div>
  );

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-[-0.02em]">Manage Tests</h1>
        <p className="text-[var(--text-tertiary)] text-[13px] mt-1">{testUploads.length} test{testUploads.length !== 1 ? 's' : ''} available</p>
      </div>

      {testUploads.length === 0 ? (
        <div className="window p-12 text-center">
          <div className="divider-dashed mb-4" />
          <p className="text-[var(--text-muted)] text-[13px]">No tests found. Generate one from the Create Test page.</p>
          <div className="divider-dashed mt-4" />
        </div>
      ) : (
        <div className="space-y-2">
          {testUploads.map((test) => (
            <div key={test.id} className="window px-5 py-4 flex items-center justify-between group hover:border-[var(--border-active)] transition-colors duration-150">
              <div className="flex items-center gap-3 min-w-0">
                <FileText size={16} className="text-[#F54E00] shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-[14px] font-semibold text-[var(--text-primary)] truncate">{test.title}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-[var(--text-faint)]">{test.problems?.length || 0} Problems</span>
                    {test.category && (
                      <>
                        <span className="w-px h-3 bg-[var(--border-subtle)]" />
                        <span className="flex items-center gap-1 text-[11px] text-[var(--text-faint)]"><Tag size={9} />{test.category}</span>
                      </>
                    )}
                    {test.duration && (
                      <>
                        <span className="w-px h-3 bg-[var(--border-subtle)]" />
                        <span className="flex items-center gap-1 text-[11px] text-[var(--text-faint)]"><Clock size={9} />{test.duration}min</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleToggleApproval(test.id, test.approved)}
                  disabled={togglingId === test.id}
                  className={`flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                    test.approved
                      ? 'bg-[#4CAF50]/10 text-[#4CAF50] hover:bg-[#4CAF50]/20'
                      : 'bg-[var(--bg-elevated)] text-[var(--text-faint)] hover:text-[var(--text-secondary)] border border-[var(--border-subtle)]'
                  }`}
                  title={test.approved ? 'Click to unapprove' : 'Click to approve'}
                >
                  {test.approved ? <CheckCircle size={13} /> : <XCircle size={13} />}
                  {test.approved ? 'Approved' : 'Not Approved'}
                </button>
                <Link href={`/uniadmin/tests/review/${test.id}`} className="btn-primary text-[12px] px-4 py-1.5">Review</Link>
                <button
                  onClick={() => handleDelete(test.id)}
                  disabled={deletingId === test.id}
                  className="p-2 rounded text-[var(--text-faint)] hover:text-[#F54E00] hover:bg-[#F54E00]/10 transition-colors duration-150 disabled:opacity-50"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}