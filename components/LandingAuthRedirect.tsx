'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { hasAuthSessionHint, setAuthSessionHint } from '@/lib/auth-session';

export default function LandingAuthRedirect() {
  const router = useRouter();
  useEffect(() => {
    if (!hasAuthSessionHint()) return;

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    let timeoutId: number | undefined;
    let idleId: number | undefined;

    const checkSession = async () => {
      const [
        { getAuth, onAuthStateChanged },
        { doc, getDoc, getFirestore },
        { firebaseApp },
      ] = await Promise.all([
        import('firebase/auth'),
        import('firebase/firestore'),
        import('@/lib/firebase-app'),
      ]);
      if (cancelled) return;

      const auth = getAuth(firebaseApp);
      const db = getFirestore(firebaseApp);
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (cancelled) return;
        if (!user) {
          setAuthSessionHint(false);
          return;
        }

        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (cancelled) return;
        const role = userDoc.exists() ? userDoc.data().role : 'user';
        if (role === 'super_admin') router.replace('/superadmin/dashboard');
        else if (role === 'university_admin') router.replace('/uniadmin/dashboard');
        else router.replace('/user/dashboard');
      });
    };

    const runSessionCheck = () => {
      void checkSession().catch(() => setAuthSessionHint(false));
    };

    const idleApi = window as unknown as {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (idleApi.requestIdleCallback) {
      idleId = idleApi.requestIdleCallback(runSessionCheck, { timeout: 1500 });
    } else {
      timeoutId = window.setTimeout(runSessionCheck, 600);
    }

    return () => {
      cancelled = true;
      unsubscribe?.();
      if (idleId !== undefined) idleApi.cancelIdleCallback?.(idleId);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [router]);

  return null;
}
