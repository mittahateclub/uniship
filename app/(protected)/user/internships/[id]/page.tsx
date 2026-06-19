'use client';

import { useState, useEffect, use } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, collection, addDoc, serverTimestamp, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { InternshipDetailView, type Internship } from './internship-detail.view';

export default function InternshipDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();

  const [internship, setInternship] = useState<Internship | null>(null);
  const [loading, setLoading] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const docRef = doc(db, 'internships', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setInternship({ id: docSnap.id, ...docSnap.data() } as Internship);

          if (user) {
            const q = query(
              collection(db, 'applications'),
              where('internshipId', '==', id),
              where('userId', '==', user.uid),
              limit(1),
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

  return (
    <InternshipDetailView
      loading={loading}
      internship={internship}
      hasApplied={hasApplied}
      isApplying={isApplying}
      onApply={handleApply}
    />
  );
}
