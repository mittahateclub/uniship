'use client';

import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Fetch the role from Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const role = userData.role;

        // Redirect based on the updated role strings
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
    } catch (err: any) {
      setError("Invalid email or password.");
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="max-w-md w-full bg-black p-8 rounded-xl shadow-2xl">
        <h1 className="text-3xl font-bold text-white mb-6 text-center">Login to Uniship</h1>
        {error && <p className="bg-red-500 text-white p-3 rounded mb-4 text-center">{error}</p>}
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            className="w-full p-3 rounded bg-white text-black"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full p-3 rounded bg-white text-black"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" className="w-full bg-white text-black font-bold py-3 rounded hover:bg-gray-200 transition">
            Login
          </button>
        </form>
      </div>
    </div>
  );
}