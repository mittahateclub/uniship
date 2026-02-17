'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';

export default function ReviewTestsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [testUploads, setTestUploads] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  async function loadTests() {
    if (!user) return;
    try {
      const adminDoc = await getDoc(doc(db, 'users', user.uid));
      const univId = adminDoc.data()?.universityId;

      if (univId) {
        const q = query(collection(db, 'pdf_uploads'), where('universityId', '==', univId));
        const snapshot = await getDocs(q);
        setTestUploads(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    } catch (err) {
      console.error("Failed to load tests:", err);
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => {
    loadTests();
  }, [user]);

  const handleDelete = async (testId: string) => {
    if (!window.confirm("Are you sure you want to delete this test? This action cannot be undone.")) {
      return;
    }

    setDeletingId(testId);
    try {
      await deleteDoc(doc(db, 'pdf_uploads', testId));
      setTestUploads(prev => prev.filter(test => test.id !== testId));
      alert("Test deleted successfully.");
    } catch (error) {
      console.error("Error deleting test:", error);
      alert("Failed to delete test. Check your permissions.");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading || fetching) return <div className="p-10">Loading test records...</div>;

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-6xl mx-auto">
        <Link href="/uniadmin/dashboard" className="text-gray-500 mb-4 inline-block">← Back</Link>
        <h1 className="text-4xl font-bold mb-8 text-black">Review Generated Tests</h1>

        {testUploads.length === 0 ? (
          <div className="p-20 text-center border-2 border-dashed rounded-xl">
            <p className="text-gray-500">No tests found. Try uploading a PDF first.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {testUploads.map((test) => (
              <div key={test.id} className="border p-6 rounded-xl flex justify-between items-center bg-gray-50">
                <div>
                  <h3 className="text-xl font-bold text-black">{test.title}</h3>
                  <p className="text-sm text-gray-500 italic">{test.fileName}</p>
                  <span className={`mt-2 inline-block px-3 py-1 rounded-full text-xs font-bold ${
                    test.status === 'generated' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {test.status}
                  </span>
                </div>
                <div className="flex gap-3">
                  <Link 
                    href={`/uniadmin/tests/review/${test.id}`}
                    className="bg-black text-white px-6 py-2 rounded-lg font-bold hover:bg-gray-800 transition-colors"
                  >
                    Review Questions
                  </Link>
                  <button
                    onClick={() => handleDelete(test.id)}
                    disabled={deletingId === test.id}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {deletingId === test.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}