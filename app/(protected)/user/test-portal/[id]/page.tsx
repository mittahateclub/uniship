'use client';

import { useState, useEffect, use } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

interface Problem {
  questionDescription: string;
  difficulty?: string;
  sampleTestCases?: Array<{
    input: string;
    output: string;
  }>;
  constraints?: string[];
  hints?: string[];
}

interface TestData {
  sourceFileName: string;
  problems: Problem[];
  universityId: string;
  published: boolean;
  createdAt: string;
}

export default function TakeTest({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  
  const [test, setTest] = useState<TestData | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTestData() {
      try {
        const docRef = doc(db, 'tests', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data() as TestData;
          
          // Check if test is published
          if (!data.published) {
            console.error("This test has not been published yet.");
          }
          
          setTest(data);
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
    if (test && currentQuestion < test.problems.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!test || !user) return;

    try {
      // Count how many problems have been attempted
      const attemptedCount = Object.keys(answers).length;

      // Save result to Firestore
      await addDoc(collection(db, 'test_results'), {
        testId: id,
        testTitle: test.sourceFileName,
        userId: user.uid,
        userEmail: user.email,
        answers: answers,
        attemptedQuestions: attemptedCount,
        totalQuestions: test.problems.length,
        submittedAt: serverTimestamp(),
        universityId: test.universityId
      });

      alert("Test submitted successfully!");
      router.push('/user/dashboard');
    } catch (error) {
      console.error("Error submitting test:", error);
      alert("Error submitting test. Please try again.");
    }
  };

  if (loading) return <div className="p-8 text-black">Loading test questions...</div>;
  if (!test) return <div className="p-8 text-black">Test not found.</div>;
  if (!test.problems || test.problems.length === 0) {
    return <div className="p-8 text-black">No problems found in this test.</div>;
  }

  const problem = test.problems[currentQuestion];

  return (
    <div className="min-h-screen bg-white p-8 text-black">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-black uppercase mb-2">
            {test.sourceFileName}
          </h1>
          <p className="text-gray-500">
            Question {currentQuestion + 1} of {test.problems.length}
          </p>
        </div>

        <div className="bg-black text-white p-8 rounded-3xl shadow-xl mb-6">
          <div className="flex justify-between items-start mb-6">
            <span className="bg-white text-black px-3 py-1 rounded-full text-xs font-black uppercase">
              {problem.difficulty || 'Problem'} {currentQuestion + 1}
            </span>
          </div>
          
          <h2 className="text-xl font-medium mb-6 leading-relaxed">
            {problem.questionDescription}
          </h2>
          
          {problem.sampleTestCases && problem.sampleTestCases.length > 0 && (
            <div className="mt-6 space-y-2">
              <p className="text-xs font-bold text-gray-400 uppercase">Sample Test Case:</p>
              <pre className="bg-gray-900 p-4 rounded-lg text-sm text-green-400 overflow-x-auto">
                <div className="mb-2">
                  <span className="text-gray-500">Input:</span> {problem.sampleTestCases[0].input}
                </div>
                <div>
                  <span className="text-gray-500">Output:</span> {problem.sampleTestCases[0].output}
                </div>
              </pre>
            </div>
          )}

          {problem.constraints && problem.constraints.length > 0 && (
            <div className="mt-6">
              <p className="text-xs font-bold text-gray-400 uppercase mb-2">Constraints:</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                {problem.constraints.map((constraint, idx) => (
                  <li key={idx} className="text-gray-300">{constraint}</li>
                ))}
              </ul>
            </div>
          )}

          {problem.hints && problem.hints.length > 0 && (
            <div className="mt-6">
              <p className="text-xs font-bold text-gray-400 uppercase mb-2">Hints:</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                {problem.hints.map((hint, idx) => (
                  <li key={idx} className="text-gray-300">{hint}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Answer Input Section */}
        <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-6 mb-6">
          <label className="block mb-2 font-bold text-black">Your Solution:</label>
          <textarea
            value={answers[currentQuestion] || ''}
            onChange={(e) => setAnswers({ ...answers, [currentQuestion]: e.target.value })}
            placeholder="Write your solution code here..."
            className="w-full h-64 p-4 border-2 border-gray-300 rounded-lg font-mono text-sm focus:border-black focus:outline-none"
          />
          <p className="text-xs text-gray-500 mt-2">
            {answers[currentQuestion] ? 'Answer saved' : 'No answer provided yet'}
          </p>
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between border-t-4 border-black pt-6">
          <button 
            disabled={currentQuestion === 0}
            onClick={handlePrevious}
            className="px-6 py-3 border-2 border-black font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
          >
            ← Previous
          </button>
          
          <div className="flex gap-4">
            {currentQuestion === test.problems.length - 1 ? (
              <button 
                onClick={handleSubmit}
                className="px-8 py-3 bg-black text-white font-bold hover:bg-gray-800 transition-colors rounded-lg"
              >
                Submit Test
              </button>
            ) : (
              <button 
                onClick={handleNext}
                className="px-8 py-3 bg-black text-white font-bold hover:bg-gray-800 transition-colors rounded-lg"
              >
                Next →
              </button>
            )}
          </div>
        </div>

        {/* Progress Indicator */}
        <div className="mt-8">
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span>Progress</span>
            <span>{currentQuestion + 1} / {test.problems.length}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-black h-2 rounded-full transition-all"
              style={{ width: `${((currentQuestion + 1) / test.problems.length) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Answered Questions Overview */}
        <div className="mt-8 p-6 bg-gray-50 rounded-xl border-2 border-gray-200">
          <h3 className="font-bold mb-4">Question Status:</h3>
          <div className="flex flex-wrap gap-2">
            {test.problems.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentQuestion(idx)}
                className={`w-10 h-10 rounded-lg font-bold transition-all ${
                  idx === currentQuestion
                    ? 'bg-black text-white'
                    : answers[idx]
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
              >
                {idx + 1}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-4">
            Answered: {Object.keys(answers).length} / {test.problems.length}
          </p>
        </div>
      </div>
    </div>
  );
}