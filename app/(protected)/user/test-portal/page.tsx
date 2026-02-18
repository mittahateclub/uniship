'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';

interface Test {
  id: string;
  title: string;
  description: string;
  duration: number;
  totalQuestions: number;
  category: string;
}

export default function TestPortal() {
  const { user, loading: authLoading } = useAuth();
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTests() {
      if (!user) return;
      try {
        // Fetching all available tests
        const q = query(collection(db, 'tests'));
        const querySnapshot = await getDocs(q);
        const fetchedTests = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Test[];
        setTests(fetchedTests);
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

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-black">
        Loading tests...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-black mb-2">Available Tests</h1>
          <p className="text-gray-600">Select a test to begin your assessment.</p>
        </div>

        {tests.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-500">No tests available at the moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tests.map((test) => (
              <div key={test.id} className="border-2 border-black p-6 rounded-lg flex flex-col">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-black mb-2">{test.title}</h3>
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">{test.description}</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="bg-gray-100 text-black px-3 py-1 rounded-full text-xs font-medium">
                      {test.duration} Mins
                    </span>
                    <span className="bg-gray-100 text-black px-3 py-1 rounded-full text-xs font-medium">
                      {test.totalQuestions} Questions
                    </span>
                    <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium">
                      {test.category}
                    </span>
                  </div>
                </div>
                <Link
                  href={`/user/test-portal/${test.id}`}
                  className="block w-full text-center bg-black text-white py-3 rounded-md hover:bg-gray-800 transition-colors font-bold"
                >
                  Start Test
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}