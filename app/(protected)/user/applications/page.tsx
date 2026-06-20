'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  collection, query, where, getDocs, limit, orderBy, startAfter,
  type DocumentData, type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getCache, setCache } from '@/lib/page-cache';
import { ApplicationsView, type Application } from './applications.view';

export default function ApplicationsPage() {
  const { user, loading: authLoading } = useAuth();
  const cacheKey = user ? `applications:${user.uid}` : '';
  const [applications, setApplications] = useState<Application[]>(() => (cacheKey ? getCache<Application[]>(cacheKey) : undefined) ?? []);
  const [loading, setLoading] = useState(() => !(cacheKey && getCache<Application[]>(cacheKey)));
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    async function fetchApplications() {
      if (!user) return;
      try {
        const q = query(
          collection(db, 'applications'),
          where('userId', '==', user.uid),
          orderBy('appliedAt', 'desc'),
          limit(50),
        );
        const querySnapshot = await getDocs(q);
        const fetched = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Application[];
        setApplications(fetched);
        setLastDoc(querySnapshot.docs.at(-1) ?? null);
        setHasMore(querySnapshot.size === 50);
        if (cacheKey) setCache<Application[]>(cacheKey, fetched);
      } catch (error) {
        console.error("Error fetching applications:", error);
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading) {
      fetchApplications();
    }
  }, [user, authLoading, cacheKey]);

  const loadMore = async () => {
    if (!user || !lastDoc || loadingMore) return;
    setLoadingMore(true);
    try {
      const snapshot = await getDocs(query(
        collection(db, 'applications'),
        where('userId', '==', user.uid),
        orderBy('appliedAt', 'desc'),
        startAfter(lastDoc),
        limit(50),
      ));
      setApplications((previous) => [
        ...previous,
        ...snapshot.docs.map((applicationDoc) => ({ id: applicationDoc.id, ...applicationDoc.data() } as Application)),
      ]);
      setLastDoc(snapshot.docs.at(-1) ?? lastDoc);
      setHasMore(snapshot.size === 50);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <ApplicationsView
      loading={loading || authLoading}
      applications={applications}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadMore={loadMore}
    />
  );
}
