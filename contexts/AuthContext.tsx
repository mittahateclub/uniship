'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
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

interface UserMeta {
  role: string | null;
  universityId: string | null;
  universityName: string | null;
  userName: string | null;
  userPhotoURL: string | null;
}

const EMPTY_META: UserMeta = { role: null, universityId: null, universityName: null, userName: null, userPhotoURL: null };
const DEFAULT_META: UserMeta = { role: 'user', universityId: null, universityName: null, userName: null, userPhotoURL: null };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [meta, setMeta] = useState<UserMeta>(EMPTY_META);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setMeta({
              role: data.role || 'user',
              universityId: data.universityId || null,
              universityName: data.universityName || null,
              userName: data.name || null,
              userPhotoURL: data.photoURL || null,
            });
          } else {
            setMeta(DEFAULT_META);
          }
        } catch {
          setMeta(DEFAULT_META);
        }
      } else {
        setMeta(EMPTY_META);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    user,
    ...meta,
    loading,
    logout,
  }), [user, meta, loading, logout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}