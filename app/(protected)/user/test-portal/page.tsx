'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, getDocs, limit, where, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { TestPortalView, type Test } from './test-portal.view';

export default function TestPortal() {
  const { user, loading: authLoading } = useAuth();
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTests() {
      if (!user) return;
      try {
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        const universityId = userSnap.data()?.universityId;
        if (!universityId) {
          setTests([]);
          return;
        }

        const [approvedSnapshot, publishedSnapshot] = await Promise.all([
          getDocs(query(
            collection(db, 'tests'),
            where('universityId', '==', universityId),
            where('approved', '==', true),
            limit(100),
          )).catch(() => ({ docs: [] })),
          getDocs(query(
            collection(db, 'tests'),
            where('universityId', '==', universityId),
            where('published', '==', true),
            limit(100),
          )).catch(() => ({ docs: [] })),
        ]);

        const merged = new Map<string, Test>();

        approvedSnapshot.docs.forEach((docSnap) => {
          merged.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as Test);
        });

        publishedSnapshot.docs.forEach((docSnap) => {
          merged.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as Test);
        });

        setTests(Array.from(merged.values()));
      } catch (error) {
        console.error("Error fetching tests:", error);
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading) {
      fetchTests();
    }
  }, [user, authLoading]);

  return <TestPortalView loading={loading || authLoading} tests={tests} />;
}
