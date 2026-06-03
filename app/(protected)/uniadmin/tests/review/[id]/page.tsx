'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { TestReviewView } from './test-review.view';

export default function ReviewGeneratedQuestions() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { id } = useParams();
  const [testData, setTestData] = useState<any>(null);
  const [fetching, setFetching] = useState(true);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  useEffect(() => {
    async function fetchTestData() {
      if (!id) return;
      try {
        const testDoc = await getDoc(doc(db, 'tests', id as string));
        if (testDoc.exists()) setTestData(testDoc.data());
      } catch (error) {
        console.error("Error fetching test:", error);
      } finally {
        setFetching(false);
      }
    }
    fetchTestData();
  }, [id]);

  const handlePublish = async () => {
    if (!id || !window.confirm("Are you sure you want to publish this test?")) return;
    setPublishing(true);
    try {
      await updateDoc(doc(db, 'tests', id as string), {
        approved: true,
        published: true,
        publishedAt: new Date().toISOString(),
        publishedBy: user?.uid,
      });
      alert("Test published successfully!");
      router.push('/uniadmin/create-test');
    } catch (error) {
      console.error("Error publishing test:", error);
      alert("Failed to publish test.");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <TestReviewView
      loading={loading || fetching}
      testData={testData}
      publishing={publishing}
      onPublish={handlePublish}
    />
  );
}
