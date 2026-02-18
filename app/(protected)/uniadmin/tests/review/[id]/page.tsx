// app/(protected)/uniadmin/tests/review/[id]/page.tsx
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';

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
        if (testDoc.exists()) {
          setTestData(testDoc.data());
        }
      } catch (error) {
        console.error("Error fetching test:", error);
      } finally {
        setFetching(false);
      }
    }
    fetchTestData();
  }, [id]);

  const handlePublish = async () => {
    if (!id || !window.confirm("Are you sure you want to publish this test? It will be made available to students.")) {
      return;
    }

    setPublishing(true);
    try {
      await updateDoc(doc(db, 'tests', id as string), {
        published: true,
        publishedAt: new Date().toISOString(),
        publishedBy: user?.uid
      });

      alert("Test published successfully!");
      router.push('/uniadmin/tests');
    } catch (error) {
      console.error("Error publishing test:", error);
      alert("Failed to publish test. Please try again.");
    } finally {
      setPublishing(false);
    }
  };

  if (loading || fetching) return <div className="p-10 text-black">Loading...</div>;
  if (!testData) return <div className="p-10 text-red-500">Test not found.</div>;

  return (
    <div className="min-h-screen bg-white text-black p-8">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8">
          <Link href="/uniadmin/tests" className="text-gray-500 hover:text-black mb-4 inline-block font-bold">
            ← BACK TO TESTS
          </Link>
          <h1 className="text-4xl font-bold">{testData.sourceFileName}</h1>
          {testData.published && (
            <span className="inline-block mt-2 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold">
              ✓ PUBLISHED
            </span>
          )}
        </header>

        <div className="space-y-6">
          {testData.problems?.map((q: any, index: number) => (
            <div key={index} className="bg-black text-white p-8 rounded-3xl shadow-xl">
              <div className="flex justify-between items-start mb-4">
                <span className="bg-white text-black px-3 py-1 rounded-full text-xs font-black uppercase">
                  {q.difficulty || 'Question'} {index + 1}
                </span>
              </div>
              
              <h3 className="text-xl font-medium mb-6">{q.questionDescription}</h3>
              
              {/* Optional: Add logic to display sample test cases if available */}
              {q.sampleTestCases && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-bold text-gray-400 uppercase">Sample Case:</p>
                  <pre className="bg-gray-900 p-3 rounded-lg text-sm text-green-400">
                    Input: {q.sampleTestCases[0]?.input}
                    {"\n"}
                    Output: {q.sampleTestCases[0]?.output}
                  </pre>
                </div>
              )}
            </div>
          ))}
          
          <div className="pt-10 flex justify-center">
            <button 
              onClick={handlePublish}
              disabled={publishing || testData.published}
              className="bg-black text-white px-10 py-4 rounded-full font-bold hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {publishing ? 'PUBLISHING...' : testData.published ? 'ALREADY PUBLISHED' : 'APPROVE & PUBLISH TEST'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}