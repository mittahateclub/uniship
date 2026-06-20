'use client';
import { useTransitionRouter } from 'next-view-transitions';

import { useState, useEffect, use } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ResultReviewView, type ResultDoc } from './result-review.view';

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useTransitionRouter();
  const [result, setResult] = useState<ResultDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const snap = await getDoc(doc(db, 'test_results', id));
      if (!snap.exists()) { setLoading(false); return; }
      const data = snap.data() as ResultDoc;
      if (data.userId !== user.uid) { setLoading(false); return; }
      setResult(data);
      setLoading(false);
    })();
  }, [user, id]);

  return <ResultReviewView loading={loading} result={result} onBack={() => router.back()} />;
}
