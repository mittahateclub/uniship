'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoginView } from './login.view';
import { setAuthSessionHint } from '@/lib/auth-session';
import './login.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const [
        { getAuth, signInWithEmailAndPassword },
        { doc, getDoc, getFirestore },
        { firebaseApp },
      ] = await Promise.all([
        import('firebase/auth'),
        import('firebase/firestore'),
        import('@/lib/firebase-app'),
      ]);
      const auth = getAuth(firebaseApp);
      const db = getFirestore(firebaseApp);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const userDoc = await getDoc(doc(db, 'users', user.uid));

      if (userDoc.exists()) {
        setAuthSessionHint(true);
        const userData = userDoc.data();
        const role = userData.role;

        if (role === 'super_admin') {
          router.push('/superadmin/dashboard');
        } else if (role === 'university_admin') {
          router.push('/uniadmin/dashboard');
        } else {
          router.push('/user/dashboard');
        }
      } else {
        setError("User profile not found.");
      }
    } catch {
      setError("Invalid email or password.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LoginView
      email={email}
      password={password}
      error={error}
      isLoading={isLoading}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onSubmit={handleLogin}
    />
  );
}
