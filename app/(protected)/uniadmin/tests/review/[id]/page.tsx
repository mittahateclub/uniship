'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { TestReviewView, type TestDoc } from './test-review.view';

export default function ReviewGeneratedQuestions() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { id } = useParams();
  const testId = id as string;
  const [testData, setTestData] = useState<TestDoc | null>(null);
  const [fetching, setFetching] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [reassigning, setReassigning] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  useEffect(() => {
    async function fetchTestData() {
      if (!testId) return;
      try {
        const testDoc = await getDoc(doc(db, 'tests', testId));
        if (testDoc.exists()) setTestData({ id: testDoc.id, ...testDoc.data() });
      } catch (error) {
        console.error("Error fetching test:", error);
      } finally {
        setFetching(false);
      }
    }
    fetchTestData();
  }, [testId]);

  const handlePublish = async () => {
    if (!testId) return;
    setPublishing(true);
    try {
      const patch = { approved: true, published: true, publishedAt: new Date().toISOString(), publishedBy: user?.uid };
      await updateDoc(doc(db, 'tests', testId), patch);
      setTestData((prev) => ({ ...prev, ...patch }));
      flash('Test approved & published');
    } catch (error) {
      console.error("Error publishing test:", error);
      flash('Failed to publish test');
    } finally {
      setPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    if (!testId) return;
    setPublishing(true);
    try {
      const patch = { approved: false, published: false };
      await updateDoc(doc(db, 'tests', testId), patch);
      setTestData((prev) => ({ ...prev, ...patch }));
      flash('Test unpublished — students can no longer take it');
    } catch (error) {
      console.error('Error unpublishing test:', error);
      flash('Failed to unpublish test');
    } finally {
      setPublishing(false);
    }
  };

  const handleSaveSchedule = async (duration: number, examStart: string, examEnd: string) => {
    if (!testId) return;
    setSavingSchedule(true);
    try {
      const patch = { duration, examStart, examEnd };
      await updateDoc(doc(db, 'tests', testId), patch);
      setTestData((prev) => ({ ...prev, ...patch }));
      flash('Schedule updated');
    } catch (error) {
      console.error('Error saving schedule:', error);
      flash('Failed to update schedule');
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleToggleReattempts = async (value: boolean) => {
    if (!testId) return;
    setReassigning(true);
    try {
      await updateDoc(doc(db, 'tests', testId), { allowReattempts: value });
      // Propagate to existing submissions so prior attempts can (or can't) retake.
      const snap = await getDocs(query(collection(db, 'test_results'), where('testId', '==', testId)));
      await Promise.all(snap.docs.map(d => updateDoc(doc(db, 'test_results', d.id), { reattemptAllowed: value })));
      setTestData((prev) => prev ? { ...prev, allowReattempts: value } : prev);
      flash(value ? 'Reattempts enabled — students can retake' : 'Reattempts disabled');
    } catch (e) {
      console.error('Failed to update reattempts:', e);
      flash('Failed to update reattempts');
    } finally {
      setReassigning(false);
    }
  };

  const handleDelete = async () => {
    if (!testId || !window.confirm('Delete this test permanently? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'tests', testId));
      router.push('/uniadmin/create-test');
    } catch (error) {
      console.error('Error deleting test:', error);
      flash('Failed to delete test');
      setDeleting(false);
    }
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}/user/test-portal/${testId}`;
    navigator.clipboard.writeText(link);
    flash('Student link copied');
  };

  return (
    <TestReviewView
      loading={loading || fetching}
      testId={testId}
      testData={testData}
      publishing={publishing}
      deleting={deleting}
      savingSchedule={savingSchedule}
      reassigning={reassigning}
      toast={toast}
      onPublish={handlePublish}
      onUnpublish={handleUnpublish}
      onSaveSchedule={handleSaveSchedule}
      onToggleReattempts={handleToggleReattempts}
      onDelete={handleDelete}
      onCopyLink={handleCopyLink}
    />
  );
}
