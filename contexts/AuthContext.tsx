'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  role: string | null;
  universityId: string | null;
  universityName: string | null;
  userName: string | null;
  userPhotoURL: string | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  universityId: null,
  universityName: null,
  userName: null,
  userPhotoURL: null,
  loading: true,
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [universityId, setUniversityId] = useState<string | null>(null);
  const [universityName, setUniversityName] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userPhotoURL, setUserPhotoURL] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setRole(data.role || 'user');
            setUniversityId(data.universityId || null);
            setUniversityName(data.universityName || null);
            setUserName(data.name || null);
            setUserPhotoURL(data.photoURL || null);
          } else {
            setRole('user');
            setUniversityId(null);
            setUniversityName(null);
            setUserName(null);
            setUserPhotoURL(null);
          }
        } catch {
          setRole('user');
          setUniversityId(null);
          setUniversityName(null);
          setUserName(null);
          setUserPhotoURL(null);
        }
      } else {
        setRole(null);
        setUniversityId(null);
        setUniversityName(null);
        setUserName(null);
        setUserPhotoURL(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, role, universityId, universityName, userName, userPhotoURL, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}