'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firestore';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkUserRole() {
      if (!loading) {
        if (!user) {
          router.push('/login');
        } else {
          // Get user role from Firestore
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          
          if (userDoc.exists()) {
            const role = userDoc.data().role;
            
            switch(role) {
              case 'super_admin':
                router.push('/superadmin/dashboard');
                break;
              case 'university_admin':
                router.push('/uniadmin/dashboard');
                break;
              case 'student':
                router.push('/user/dashboard');
                break;
              default:
                router.push('/user/dashboard');
            }
          } else {
            // Default to user dashboard if no role set
            router.push('/user/dashboard');
          }
        }
        setChecking(false);
      }
    }

    checkUserRole();
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
      <div className="loading-dots"><span /><span /><span /></div>
    </div>
  );
}