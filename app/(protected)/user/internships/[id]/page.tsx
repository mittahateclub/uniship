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

  if (loading) return <div className="flex items-center justify-center py-24"><div className="loading-dots"><span /><span /><span /></div></div>;
  if (!internship) return <div className="flex items-center justify-center py-24 text-[var(--text-tertiary)]">Internship not found.</div>;

  return (
    <div className="animate-fade-in">
      <div className="max-w-4xl mx-auto">

        <div className="window p-6 sm:p-8">
          <div className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4 border-b border-[var(--border-subtle)] pb-6">
            <div>
              <span className="inline-block bg-[#F54E00] text-black px-2.5 py-0.5 text-[11px] font-bold uppercase rounded mb-2">
                {internship.companyName}
              </span>
              <h1 className="text-2xl font-semibold tracking-[-0.02em]">{internship.role}</h1>
              <p className="text-[var(--text-tertiary)] mt-1 text-sm">{internship.location}</p>
            </div>
            
            <div className="text-right">
              <p className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Deadline</p>
              <p className="text-lg font-semibold tabular-nums">{internship.deadline?.toDate().toLocaleDateString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-4">
              <p className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1">Stipend</p>
              <p className="text-sm font-medium">{internship.stipend}</p>
            </div>
            <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-4">
              <p className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1">Duration</p>
              <p className="text-sm font-medium">{internship.duration}</p>
            </div>
          </div>

          <div className="space-y-6">
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wide mb-3">About the Role</h3>
              <p className="leading-relaxed text-[var(--text-secondary)] text-sm whitespace-pre-wrap">{internship.description}</p>
            </section>

            {internship.requirements && (
              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wide mb-3">Requirements</h3>
                <ul className="list-disc list-inside space-y-1.5">
                  {internship.requirements.map((req, i) => (
                    <li key={i} className="text-[var(--text-secondary)] text-sm">{req}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <div className="mt-8 border-t border-[var(--border-subtle)] pt-6">
            {hasApplied ? (
              <div className="window p-5 text-center border-[#4CAF50]">
                <p className="text-[#4CAF50] font-semibold">Application Submitted</p>
                <p className="text-[var(--text-tertiary)] text-xs mt-1">You applied for this position on {new Date().toLocaleDateString()}</p>
              </div>
            ) : (
              <button
                onClick={handleApply}
                disabled={isApplying}
                className="btn-primary w-full py-3 text-sm font-semibold"
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