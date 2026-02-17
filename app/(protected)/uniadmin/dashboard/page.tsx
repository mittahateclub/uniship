'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import Link from 'next/link';

export default function UniAdminDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [adminData, setAdminData] = useState<any>(null);
  const [stats, setStats] = useState({
    activeTests: 0,
    totalStudents: 0,
    upcomingEvents: 0
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    async function fetchDashboardData() {
      if (user) {
        // Fetch Admin Profile
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setAdminData(data);

          // Fetch Stats based on University ID
          const univId = data.universityId;
          if (univId) {
            const studentsQuery = query(collection(db, 'users'), where('universityId', '==', univId), where('role', '==', 'student'));
            const testsQuery = query(collection(db, 'pdf_uploads'), where('universityId', '==', univId));
            const eventsQuery = query(collection(db, 'events'), where('universityId', '==', univId));

            const [studentSnap, testSnap, eventSnap] = await Promise.all([
              getDocs(studentsQuery),
              getDocs(testsQuery),
              getDocs(eventsQuery)
            ]);

            setStats({
              totalStudents: studentSnap.size,
              activeTests: testSnap.size,
              upcomingEvents: eventSnap.size
            });
          }
        }
      }
    }
    fetchDashboardData();
  }, [user]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-white text-black">Loading Dashboard...</div>;

  return (
    <div className="min-h-screen bg-white text-black p-6 md:p-12">
      <div className="max-w-7xl mx-auto">
        <header className="mb-10">
          <h1 className="text-4xl font-bold tracking-tight">University Admin Dashboard</h1>
          <p className="text-gray-500 mt-2">Welcome back, {user?.email}</p>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-black text-white p-8 rounded-2xl shadow-xl">
            <p className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-1">Active Tests</p>
            <h2 className="text-5xl font-bold">{stats.activeTests}</h2>
          </div>
          <div className="bg-black text-white p-8 rounded-2xl shadow-xl">
            <p className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-1">Total Students</p>
            <h2 className="text-5xl font-bold">{stats.totalStudents}</h2>
          </div>
          <div className="bg-black text-white p-8 rounded-2xl shadow-xl">
            <p className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-1">Upcoming Events</p>
            <h2 className="text-5xl font-bold">{stats.upcomingEvents}</h2>
          </div>
        </div>

        {/* Quick Actions Grid */}
        <h2 className="text-2xl font-bold mb-6">Management Tools</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          
          <Link href="/uniadmin/create-test">
            <div className="group border-2 border-black p-6 rounded-2xl hover:bg-black hover:text-white transition-all cursor-pointer h-full">
              <span className="text-3xl mb-4 block">📝</span>
              <h3 className="text-xl font-bold mb-2">Create AI Test</h3>
              <p className="text-sm opacity-70">Upload PDFs to generate new practice questions.</p>
            </div>
          </Link>

          {/* THIS IS THE LINK YOU WERE MISSING */}
          <Link href="/uniadmin/tests">
            <div className="group border-2 border-black p-6 rounded-2xl hover:bg-black hover:text-white transition-all cursor-pointer h-full">
              <span className="text-3xl mb-4 block">📋</span>
              <h3 className="text-xl font-bold mb-2">Review & Manage Tests</h3>
              <p className="text-sm opacity-70">View upload status and approve AI-generated tests.</p>
            </div>
          </Link>

          <Link href="/uniadmin/create-account">
            <div className="group border-2 border-black p-6 rounded-2xl hover:bg-black hover:text-white transition-all cursor-pointer h-full">
              <span className="text-3xl mb-4 block">👤</span>
              <h3 className="text-xl font-bold mb-2">Create Account</h3>
              <p className="text-sm opacity-70">Register new student profiles to your university.</p>
            </div>
          </Link>

          <Link href="/uniadmin/create-event">
            <div className="group border-2 border-black p-6 rounded-2xl hover:bg-black hover:text-white transition-all cursor-pointer h-full">
              <span className="text-3xl mb-4 block">📅</span>
              <h3 className="text-xl font-bold mb-2">Create Event</h3>
              <p className="text-sm opacity-70">Post workshops, seminars, or placement talks.</p>
            </div>
          </Link>

          <Link href="/uniadmin/student-database">
            <div className="group border-2 border-black p-6 rounded-2xl hover:bg-black hover:text-white transition-all cursor-pointer h-full">
              <span className="text-3xl mb-4 block">🗄️</span>
              <h3 className="text-xl font-bold mb-2">Student Database</h3>
              <p className="text-sm opacity-70">View and manage all registered students.</p>
            </div>
          </Link>

          <Link href="/uniadmin/analysis">
            <div className="group border-2 border-black p-6 rounded-2xl hover:bg-black hover:text-white transition-all cursor-pointer h-full">
              <span className="text-3xl mb-4 block">📊</span>
              <h3 className="text-xl font-bold mb-2">Student Analysis</h3>
              <p className="text-sm opacity-70">Detailed reports on test performance and progress.</p>
            </div>
          </Link>

          <Link href="/uniadmin/profile">
            <div className="group border-2 border-black p-6 rounded-2xl hover:bg-black hover:text-white transition-all cursor-pointer h-full">
              <span className="text-3xl mb-4 block">⚙️</span>
              <h3 className="text-xl font-bold mb-2">Admin Profile</h3>
              <p className="text-sm opacity-70">Manage your university settings and credentials.</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}