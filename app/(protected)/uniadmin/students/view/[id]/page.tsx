'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';

export default function ReviewGeneratedQuestions() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { id } = useParams();
  const [testMetadata, setTestMetadata] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    async function fetchTestData() {
      if (!id) return;
      try {
        // 1. Fetch the upload metadata (title, filename, etc.)
        const uploadDoc = await getDoc(doc(db, 'pdf_uploads', id as string));
        if (uploadDoc.exists()) {
          setTestMetadata(uploadDoc.data());
        }

        // 2. Fetch the generated questions linked to this upload ID
        const q = query(collection(db, 'generated_tests'), where('uploadId', '==', id));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          // Assuming questions are stored in a 'questions' array field within the doc
          const data = querySnapshot.docs[0].data();
          setQuestions(data.questions || []);
        }
      } catch (error) {
        console.error("Error fetching generated questions:", error);
      } finally {
        setFetching(false);
      }
    }
    fetchTestData();
  }, [id]);

  if (loading || fetching) return <div className="p-10 text-black">Loading generated questions...</div>;
  
  if (!testMetadata) return <div className="p-10 text-red-500">Test data not found.</div>;

  return (
    <div className="min-h-screen bg-white text-black p-8">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8">
          <Link href="/uniadmin/tests" className="text-gray-500 hover:text-black mb-4 inline-block font-bold">
            ← BACK TO TESTS
          </Link>
          <h1 className="text-4xl font-bold tracking-tight">{testMetadata.title}</h1>
          <p className="text-gray-500">Source: {testMetadata.fileName}</p>
        </header>

        {questions.length === 0 ? (
          <div className="p-20 text-center border-2 border-dashed rounded-3xl">
            <p className="text-gray-500">AI is still processing or no questions were generated.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {questions.map((q: any, index: number) => (
              <div key={index} className="bg-black text-white p-8 rounded-3xl shadow-xl">
                <div className="flex justify-between items-start mb-4">
                  <span className="bg-white text-black px-3 py-1 rounded-full text-xs font-black">
                    QUESTION {index + 1}
                  </span>
                </div>
                
                <h3 className="text-xl font-medium mb-6">{q.questionText}</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {q.options?.map((option: string, i: number) => (
                    <div 
                      key={i} 
                      className={`p-4 rounded-xl border ${
                        option === q.correctAnswer 
                          ? 'border-green-500 bg-green-500/10 text-green-400' 
                          : 'border-gray-800 bg-[#1a1a1a]'
                      }`}
                    >
                      <span className="font-bold mr-2">{String.fromCharCode(65 + i)}.</span>
                      {option}
                    </div>
                  ))}
                </div>
                
                <div className="mt-6 pt-6 border-t border-gray-800">
                  <p className="text-sm text-gray-400">
                    <span className="font-bold text-white uppercase mr-2 tracking-widest text-xs">Explanation:</span>
                    {q.explanation || 'No explanation provided.'}
                  </p>
                </div>
              </div>
            ))}
            
            <div className="pt-10 flex justify-center">
              <button className="bg-black text-white px-10 py-4 rounded-full font-bold hover:scale-105 transition-transform">
                APPROVE & PUBLISH TEST
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}