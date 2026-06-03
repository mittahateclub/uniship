// app/(protected)/user/dashboard/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DashboardView, type CalendarEvent } from './dashboard.view';

function toDate(d: any): Date | null {
  if (!d) return null;
  if (typeof d.toDate === 'function') return d.toDate();
  if (d instanceof Date) return d;
  return new Date(d);
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function UserDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    async function fetchTodayEvents() {
      if (!user) return;
      try {
        const savedSnap = await getDocs(
          query(collection(db, 'savedEvents'), where('userId', '==', user.uid))
        );
        const today = new Date();
        const events: CalendarEvent[] = savedSnap.docs
          .map(d => {
            const data = d.data();
            return {
              id: d.id,
              title: data.title,
              date: toDate(data.date),
              type: data.type || 'event',
              description: data.description || '',
              location: data.location || undefined,
              company: data.companyName || undefined,
            };
          })
          .filter(e => e.date && sameDay(e.date, today));
        setTodayEvents(events);
      } catch (error) {
        console.error('Error fetching today events:', error);
      }
    }
    if (!loading && user) fetchTodayEvents();
  }, [user, loading]);

  if (!loading && !user) return null;

  return <DashboardView loading={loading} todayEvents={todayEvents} />;
}
