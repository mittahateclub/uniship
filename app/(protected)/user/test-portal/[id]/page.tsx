'use client';

import { useState, useEffect, ReactNode, use } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

interface Question {
  question: string;
  options: string[];
  correctAnswer: number;
}

interface TestData {
  title: string;
  questions: Question[];
  duration: number;
}

export default function TakeTest({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  
  const [test, setTest] = useState<TestData | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTestData() {
      try {
        const docRef = doc(db, 'tests', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setTest(docSnap.data() as TestData);
        }
      } catch (error) {
        console.error("Error fetching test details:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchTestData();
  }, [id]);

  const handleNext = () => {
    if (test && currentQuestion < test.questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    }
  };

  const handleSubmit = async () => {
    if (!test || !user) return;

    try {
      let score = 0;
      test.questions.forEach((q, index) => {
        if (answers[index] === q.correctAnswer) score++;
      });

      // Save result to Firestore
      await addDoc(collection(db, 'test_results'), {
        testId: id,
        userId: user.uid,
        userEmail: user.email,
        score: score,
        totalQuestions: test.questions.length,
        submittedAt: serverTimestamp()
      });

      router.push('/user/results');
    } catch (error) {
      console.error("Error submitting test:", error);
    }
  };

  if (loading) return <div className="p-8 text-black">Loading test questions...</div>;
  if (!test) return <div className="p-8 text-black">Test not found.</div>;

  const q = test.questions[currentQuestion];

  return (
    <div className="min-h-screen bg-white p-8 text-black">
      <div className="max-w-3xl mx-auto border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <h1 className="text-3xl font-black uppercase mb-8 border-b-4 border-black pb-4">
          {test.title}
        </h1>

        <div className="mb-8">
          <p className="font-bold text-gray-500 mb-2">Question {currentQuestion + 1} of {test.questions.length}</p>
          <h2 className="text-xl font-bold">{q.question}</h2>
        </div>

        <div className="space-y-4 mb-8">
          {q.options.map((option, index) => (
            <button
              key={index}
              onClick={() => setAnswers({ ...answers, [currentQuestion]: index })}
              className={`w-full text-left p-4 border-2 font-bold transition-all ${
                answers[currentQuestion] === index 
                  ? 'bg-black text-white border-black' 
                  : 'bg-white text-black border-gray-200 hover:border-black'
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        <div className="flex justify-between border-t-4 border-black pt-6">
          <button 
            disabled={currentQuestion === 0}
            onClick={() => setCurrentQuestion(prev => prev - 1)}
            className="px-6 py-2 border-2 border-black font-bold disabled:opacity-30"
          >
            Previous
          </button>
          
          {currentQuestion === test.questions.length - 1 ? (
            <button 
              onClick={handleSubmit}
              className="px-6 py-2 bg-black text-white font-bold hover:bg-gray-800"
            >
              Submit Test
            </button>
          ) : (
            <button 
              onClick={handleNext}
              className="px-6 py-2 bg-black text-white font-bold hover:bg-gray-800"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}