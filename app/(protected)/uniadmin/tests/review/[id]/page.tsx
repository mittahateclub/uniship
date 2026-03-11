// app/(protected)/uniadmin/tests/review/[id]/page.tsx
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CheckCircle2 } from 'lucide-react';

export default function ReviewGeneratedQuestions() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { id } = useParams();
  const [testData, setTestData] = useState<any>(null);
  const [fetching, setFetching] = useState(true);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
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
        published: true, publishedAt: new Date().toISOString(), publishedBy: user?.uid
      });
      alert("Test published successfully!");
      router.push('/uniadmin/tests');
    } catch (error) {
      console.error("Error publishing test:", error);
      alert("Failed to publish test.");
    } finally {
      setPublishing(false);
    }
  };

  if (loading || fetching) return (
    <div className="flex items-center justify-center h-64">
      <div className="loading-dots"><span /><span /><span /></div>
    </div>
  );
  if (!testData) return (
    <div className="window p-12 text-center">
      <p className="text-[#F54E00] text-[13px]">Test not found.</p>
    </div>
  );

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-[-0.02em]">{testData.sourceFileName}</h1>
        {testData.published && (
          <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-bold uppercase tracking-widest text-[#4CAF50] bg-[#4CAF50]/10 px-2 py-0.5 rounded">
            <CheckCircle2 size={10} /> Published
          </span>
        )}
      </div>

      <div className="space-y-3">
        {testData.problems?.map((q: any, index: number) => (
          <div key={index} className="window p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#000000] bg-[#F54E00] px-2 py-0.5 rounded">
                {q.difficulty || 'Q'} {index + 1}
              </span>
            </div>
            <h3 className="text-[14px] font-medium text-[var(--text-primary)] mb-4">{q.questionDescription}</h3>
            {q.sampleTestCases && (
              <div className="mt-3 space-y-1">
                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Sample Case:</p>
                <pre className="bg-[var(--bg-elevated)] p-3 rounded text-[12px] text-[#4CAF50] font-mono">
Input: {q.sampleTestCases[0]?.input}
{"\n"}
Output: {q.sampleTestCases[0]?.output}
                </pre>
              </div>
            )}
          </div>
        ))}

        <div className="pt-6 flex justify-center">
          <button
            onClick={handlePublish}
            disabled={publishing || testData.published}
            className="btn-primary px-8 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {publishing ? 'Publishing...' : testData.published ? 'Already Published' : 'Approve & Publish Test'}
          </button>
        </div>
      </div>
    </div>
  );
}