'use client';

import { useState, useEffect, use } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Internship {
  id: string;
  companyName: string;
  role: string;
  location: string;
  stipend: string;
  duration: string;
  deadline: any;
  description: string;
  requirements?: string[];
  responsibilities?: string[];
}

export default function InternshipDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  
  const [internship, setInternship] = useState<Internship | null>(null);
  const [loading, setLoading] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch Internship Details
        const docRef = doc(db, 'internships', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setInternship({ id: docSnap.id, ...docSnap.data() } as Internship);
          
          // Check if already applied
          if (user) {
            const q = query(
              collection(db, 'applications'),
              where('internshipId', '==', id),
              where('userId', '==', user.uid)
            );
            const appSnap = await getDocs(q);
            if (!appSnap.empty) setHasApplied(true);
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id, user]);

  const handleApply = async () => {
    if (!user || !internship) return;
    setIsApplying(true);

    try {
      await addDoc(collection(db, 'applications'), {
        internshipId: id,
        internshipRole: internship.role,
        companyName: internship.companyName,
        userId: user.uid,
        userEmail: user.email,
        status: 'pending',
        appliedAt: serverTimestamp(),
      });
      
      setHasApplied(true);
      alert("Application submitted successfully!");
    } catch (error) {
      console.error("Error applying:", error);
      alert("Failed to submit application.");
    } finally {
      setIsApplying(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-white text-black font-bold">Loading details...</div>;
  if (!internship) return <div className="min-h-screen flex items-center justify-center bg-white text-black font-bold">Internship not found.</div>;

  return (
    <div className="min-h-screen bg-white p-8 text-black">
      <div className="max-w-4xl mx-auto">
        <Link href="/user/internships" className="inline-block mb-8 font-bold hover:underline">
          ← Back to Listings
        </Link>

        <div className="border-4 border-black p-8 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4 border-b-4 border-black pb-6">
            <div>
              <span className="bg-black text-white px-3 py-1 text-xs font-black uppercase mb-2 inline-block">
                {internship.companyName}
              </span>
              <h1 className="text-4xl font-black uppercase leading-none">{internship.role}</h1>
              <p className="text-gray-500 mt-2 font-bold">{internship.location}</p>
            </div>
            
            <div className="text-right">
              <p className="text-sm font-bold text-gray-400 uppercase">Deadline</p>
              <p className="text-xl font-black">{internship.deadline?.toDate().toLocaleDateString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div className="bg-gray-50 p-6 border-2 border-black">
              <p className="text-xs font-black uppercase text-gray-400 mb-1">Stipend</p>
              <p className="text-lg font-bold">{internship.stipend}</p>
            </div>
            <div className="bg-gray-50 p-6 border-2 border-black">
              <p className="text-xs font-black uppercase text-gray-400 mb-1">Duration</p>
              <p className="text-lg font-bold">{internship.duration}</p>
            </div>
          </div>

          <div className="space-y-8">
            <section>
              <h3 className="text-xl font-black uppercase mb-4 decoration-4 underline">About the Role</h3>
              <p className="leading-relaxed text-gray-700 whitespace-pre-wrap">{internship.description}</p>
            </section>

            {internship.requirements && (
              <section>
                <h3 className="text-xl font-black uppercase mb-4 decoration-4 underline">Requirements</h3>
                <ul className="list-disc list-inside space-y-2">
                  {internship.requirements.map((req, i) => (
                    <li key={i} className="text-gray-700">{req}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <div className="mt-12 border-t-4 border-black pt-8">
            {hasApplied ? (
              <div className="bg-green-100 border-4 border-green-600 p-6 text-center">
                <p className="text-green-800 font-black uppercase text-xl">✓ Application Submitted</p>
                <p className="text-green-700 text-sm mt-1">You applied for this position on {new Date().toLocaleDateString()}</p>
              </div>
            ) : (
              <button
                onClick={handleApply}
                disabled={isApplying}
                className="w-full bg-black text-white py-5 text-2xl font-black uppercase tracking-widest hover:bg-gray-800 transition-all shadow-[8px_8px_0px_0px_rgba(200,200,200,1)] active:shadow-none active:translate-x-1 active:translate-y-1"
              >
                {isApplying ? 'Processing...' : 'Apply Now'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}