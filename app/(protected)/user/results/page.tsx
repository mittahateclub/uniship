'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  collection, query, where, getDocs, limit, doc, getDoc, documentId,
  orderBy, startAfter, type DocumentData, type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getCache, setCache } from '@/lib/page-cache';
import { ResultsView, type TestResult, type AnalysisDetails } from './results.view';

interface Problem {
  questionDescription?: string;
  correctAnswer?: string;
  expectedOutput?: string;
  sampleTestCases?: Array<{ input: string; output: string }>;
}

export default function ResultsPage() {
  const { user, loading: authLoading } = useAuth();
  const cacheKey = user ? `results:${user.uid}` : '';
  const [results, setResults] = useState<TestResult[]>(() => (cacheKey ? getCache<TestResult[]>(cacheKey) : undefined) ?? []);
  const [loading, setLoading] = useState(() => !(cacheKey && getCache<TestResult[]>(cacheKey)));
  const [activeResult, setActiveResult] = useState<TestResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [currentCursor, setCurrentCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [legacyCursor, setLegacyCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisDetails | null>(null);

  const toMillis = (value: unknown) => {
    if (!value) return 0;
    if (typeof (value as { toMillis?: unknown }).toMillis === 'function') return (value as { toMillis: () => number }).toMillis();
    if (typeof (value as { toDate?: unknown }).toDate === 'function') return (value as { toDate: () => Date }).toDate().getTime();
    const parsed = new Date(value as string | number | Date).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const getScore = (result: TestResult) => (
    typeof result.score === 'number' ? result.score : (result.attemptedQuestions || 0)
  );

  const getPercentage = (result: TestResult) => {
    if (typeof result.percentage === 'number') return result.percentage;
    const score = getScore(result);
    return result.totalQuestions > 0 ? (score / result.totalQuestions) * 100 : 0;
  };

  const getExpectedAnswer = (problem: Problem) => (
    (problem.correctAnswer || '').trim() ||
    (problem.expectedOutput || '').trim() ||
    (problem.sampleTestCases?.[0]?.output || '').trim()
  );

  const normalize = (value: string) => (
    value.trim().replace(/\r\n/g, '\n').replace(/\s+/g, ' ').toLowerCase()
  );

  const loadAnalysis = async (result: TestResult) => {
    if (!user) return;

    setActiveResult(result);
    setAnalysis(null);
    setAnalysisError('');
    setAnalysisLoading(true);

    try {
      if (!result.testId) {
        throw new Error('This result record is missing test reference.');
      }

      const [peersSnapshot, testSnap] = await Promise.all([
        getDocs(query(collection(db, 'test_results'), where('testId', '==', result.testId), limit(1000))),
        getDoc(doc(db, 'tests', result.testId)),
      ]);

      const peersRaw = peersSnapshot.docs.map((d) => ({ id: d.id, ...d.data() } as TestResult));
      const peers = peersRaw.filter((r) => r.universityId && r.universityId === result.universityId);
      const scopedPeers = peers.length > 0 ? peers : peersRaw;

      const ranked = [...scopedPeers].sort((a, b) => {
        const pctDelta = getPercentage(b) - getPercentage(a);
        if (pctDelta !== 0) return pctDelta;

        const scoreDelta = getScore(b) - getScore(a);
        if (scoreDelta !== 0) return scoreDelta;

        return toMillis(a.submittedAt) - toMillis(b.submittedAt);
      });

      const myIndex = ranked.findIndex((r) => r.id === result.id || (r.userId && r.userId === user.uid));
      const rank = myIndex >= 0 ? myIndex + 1 : ranked.length;
      const totalParticipants = ranked.length;
      const percentile = totalParticipants > 0
        ? Math.max(0, Math.round(((totalParticipants - rank) / totalParticipants) * 1000) / 10)
        : 0;

      const averagePercentage = totalParticipants > 0
        ? ranked.reduce((sum, r) => sum + getPercentage(r), 0) / totalParticipants
        : 0;
      const topPercentage = totalParticipants > 0 ? getPercentage(ranked[0]) : 0;

      let anonCounter = 1;
      const board = ranked.map((r) => {
        const isYou = r.userId === user.uid || r.id === result.id;
        const label = isYou ? 'You' : `Anonymous ${anonCounter++}`;

        return {
          label,
          score: getScore(r),
          percentage: getPercentage(r),
          isYou,
        };
      });

      let questionStats: AnalysisDetails['questionStats'] = null;
      if (result.testId) {
        const problems = (testSnap.data()?.problems || []) as Problem[];

        if (problems.length > 0) {
          let correct = 0;
          let incorrect = 0;
          let ungraded = 0;
          let unanswered = 0;

          const hasQuestionEvaluations = Array.isArray(result.questionEvaluations) && result.questionEvaluations.length > 0;

          if (hasQuestionEvaluations) {
            const byIndex = new Map(result.questionEvaluations!.map((entry) => [entry.index, entry]));

            for (let index = 0; index < problems.length; index += 1) {
              const entry = byIndex.get(index);
              const verdict = entry?.verdict || 'UNANSWERED';

              if (verdict === 'UNANSWERED') {
                unanswered += 1;
              } else if (verdict === 'UNGRADED') {
                ungraded += 1;
              } else if (verdict === 'AC') {
                correct += 1;
              } else {
                incorrect += 1;
              }
            }

            questionStats = { correct, incorrect, ungraded, unanswered };
          } else {
            problems.forEach((problem, index) => {
              const answer = (result.answers?.[String(index)] || '').trim();
              const expected = getExpectedAnswer(problem);

              if (!answer) {
                unanswered += 1;
                return;
              }
              if (!expected) {
                ungraded += 1;
                return;
              }
              if (normalize(answer) === normalize(expected)) {
                correct += 1;
              } else {
                incorrect += 1;
              }
            });

            questionStats = { correct, incorrect, ungraded, unanswered };
          }
        }
      }

      setAnalysis({
        rank,
        totalParticipants,
        percentile,
        averagePercentage,
        topPercentage,
        board,
        questionStats,
      });
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : 'Failed to load detailed analysis.');
    } finally {
      setAnalysisLoading(false);
    }
  };

  const closeAnalysis = () => {
    setActiveResult(null);
    setAnalysis(null);
    setAnalysisError('');
  };

  useEffect(() => {
    async function fetchResults() {
      if (!user) return;
      try {
        const currentResultsQ = query(
          collection(db, 'test_results'),
          where('userId', '==', user.uid),
          orderBy(documentId()),
          limit(50),
        );

        const legacyResultsQ = query(
          collection(db, 'testResults'),
          where('userId', '==', user.uid),
          orderBy(documentId()),
          limit(50),
        );

        const [currentSnapshot, legacySnapshot] = await Promise.all([
          getDocs(currentResultsQ),
          getDocs(legacyResultsQ),
        ]);

        const combined = [
          ...currentSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as TestResult)),
          ...legacySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as TestResult)),
        ];

        combined.sort((a, b) => toMillis(b.submittedAt) - toMillis(a.submittedAt));
        setResults(combined);
        setCurrentCursor(currentSnapshot.docs.at(-1) ?? null);
        setLegacyCursor(legacySnapshot.docs.at(-1) ?? null);
        setHasMore(currentSnapshot.size === 50 || legacySnapshot.size === 50);
        if (cacheKey) setCache<TestResult[]>(cacheKey, combined);
      } catch (error) {
        console.error("Error fetching results:", error);
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading) {
      fetchResults();
    }
  }, [user, authLoading, cacheKey]);

  const loadMore = async () => {
    if (!user || loadingMore) return;
    setLoadingMore(true);
    try {
      const [currentSnapshot, legacySnapshot] = await Promise.all([
        currentCursor
          ? getDocs(query(collection(db, 'test_results'), where('userId', '==', user.uid), orderBy(documentId()), startAfter(currentCursor), limit(50)))
          : Promise.resolve(null),
        legacyCursor
          ? getDocs(query(collection(db, 'testResults'), where('userId', '==', user.uid), orderBy(documentId()), startAfter(legacyCursor), limit(50)))
          : Promise.resolve(null),
      ]);
      const added = [
        ...(currentSnapshot?.docs ?? []).map((resultDoc) => ({ id: resultDoc.id, ...resultDoc.data() } as TestResult)),
        ...(legacySnapshot?.docs ?? []).map((resultDoc) => ({ id: resultDoc.id, ...resultDoc.data() } as TestResult)),
      ];
      setResults((previous) => {
        const merged = new Map(previous.map((result) => [result.id, result]));
        added.forEach((result) => merged.set(result.id, result));
        return Array.from(merged.values()).sort((a, b) => toMillis(b.submittedAt) - toMillis(a.submittedAt));
      });
      setCurrentCursor(currentSnapshot?.docs.at(-1) ?? null);
      setLegacyCursor(legacySnapshot?.docs.at(-1) ?? null);
      setHasMore((currentSnapshot?.size ?? 0) === 50 || (legacySnapshot?.size ?? 0) === 50);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <ResultsView
      loading={loading || authLoading}
      results={results}
      activeResult={activeResult}
      analysis={analysis}
      analysisLoading={analysisLoading}
      analysisError={analysisError}
      getScore={getScore}
      getPercentage={getPercentage}
      onViewAnalysis={loadAnalysis}
      onCloseAnalysis={closeAnalysis}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadMore={loadMore}
    />
  );
}
