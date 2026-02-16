'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';

interface UniadminData {
  id: string;
  name: string;
  email: string;
  universityName: string;
  universityId: string;
  phone: string;
  createdAt: any;
}

export default function ManageUniadminsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [uniadmins, setUniadmins] = useState<UniadminData[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    async function fetchUniadmins() {
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'uniadmin'));
        const querySnapshot = await getDocs(q);
        
        const admins: UniadminData[] = [];
        querySnapshot.forEach((doc) => {
          admins.push({
            id: doc.id,
            ...doc.data(),
          } as UniadminData);
        });

        setUniadmins(admins);
      } catch (error) {
        console.error('Error fetching uniadmins:', error);
      } finally {
        setLoadingData(false);
      }
    }

    if (user) {
      fetchUniadmins();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-black text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <Link 
              href="/superadmin/dashboard" 
              className="text-black hover:text-gray-600 mb-4 inline-block"
            >
              ← Back to Dashboard
            </Link>
            <h1 className="text-4xl font-bold text-black mb-2">Manage University Admins</h1>
            <p className="text-gray-600">View and manage all university administrators</p>
          </div>
          <Link
            href="/superadmin/create-uniadmin"
            className="bg-black text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors"
          >
            + Create New Admin
          </Link>
        </div>

        {/* Content */}
        {loadingData ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading administrators...</p>
          </div>
        ) : uniadmins.length === 0 ? (
          <div className="bg-black text-white p-12 rounded-lg text-center">
            <p className="text-xl mb-4">No university admins found</p>
            <Link
              href="/superadmin/create-uniadmin"
              className="inline-block bg-white text-black px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
            >
              Create First Admin
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {uniadmins.map((admin) => (
              <div key={admin.id} className="bg-black text-white p-6 rounded-lg shadow-lg">
                <div className="flex items-start justify-between mb-4">
                  <div className="text-3xl">👤</div>
                  <span className="text-xs bg-white text-black px-2 py-1 rounded">
                    Uni Admin
                  </span>
                </div>
                
                <h3 className="text-xl font-bold mb-2">{admin.name}</h3>
                
                <div className="space-y-2 text-sm">
                  <div className="border-t border-gray-700 pt-2">
                    <p className="text-gray-400">Email</p>
                    <p className="font-medium">{admin.email}</p>
                  </div>
                  
                  <div className="border-t border-gray-700 pt-2">
                    <p className="text-gray-400">University</p>
                    <p className="font-medium">{admin.universityName}</p>
                  </div>
                  
                  <div className="border-t border-gray-700 pt-2">
                    <p className="text-gray-400">University ID</p>
                    <p className="font-medium">{admin.universityId}</p>
                  </div>
                  
                  {admin.phone && (
                    <div className="border-t border-gray-700 pt-2">
                      <p className="text-gray-400">Phone</p>
                      <p className="font-medium">{admin.phone}</p>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-700 flex gap-2">
                  <button className="flex-1 bg-white text-black py-2 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors">
                    View Details
                  </button>
                  <button className="flex-1 bg-gray-800 text-white py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors">
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}