'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, getDocs, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Event {
  id: string;
  title: string;
  date: any;
  type: 'test' | 'deadline' | 'event';
  description: string;
  location?: string;
}

export default function CalendarPage() {
  const { user, loading: authLoading } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEvents() {
      if (!user) return;
      try {
        // Querying for future events
        const now = new Date();
        const q = query(
          collection(db, 'events'),
          where('date', '>=', now),
          orderBy('date', 'asc')
        );
        
        const querySnapshot = await getDocs(q);
        const fetchedEvents = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Event[];
        setEvents(fetchedEvents);
      } catch (error) {
        console.error("Error fetching events:", error);
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading) {
      fetchEvents();
    }
  }, [user, authLoading]);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-black font-black uppercase">
        Syncing Schedule...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-8 text-black">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12 border-b-8 border-black pb-6">
          <h1 className="text-5xl font-black uppercase tracking-tighter">Academic Calendar</h1>
          <p className="text-gray-600 font-bold mt-2">Stay updated with upcoming tests and deadlines.</p>
        </div>

        {events.length === 0 ? (
          <div className="text-center py-20 border-4 border-black border-dashed">
            <p className="text-xl font-bold uppercase text-gray-400">No upcoming events scheduled.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {events.map((event) => {
              const eventDate = event.date?.toDate();
              return (
                <div 
                  key={event.id} 
                  className="flex flex-col md:flex-row border-4 border-black overflow-hidden shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
                >
                  <div className="bg-black text-white p-6 md:w-48 flex flex-col items-center justify-center">
                    <span className="text-4xl font-black">{eventDate?.getDate()}</span>
                    <span className="text-xl font-bold uppercase">
                      {eventDate?.toLocaleString('default', { month: 'short' })}
                    </span>
                  </div>
                  
                  <div className="p-6 flex-1 flex flex-col justify-center">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-3 py-1 text-xs font-black uppercase border-2 border-black ${
                        event.type === 'test' ? 'bg-red-500 text-white' : 
                        event.type === 'deadline' ? 'bg-yellow-400 text-black' : 
                        'bg-blue-500 text-white'
                      }`}>
                        {event.type}
                      </span>
                      {event.location && (
                        <span className="text-sm font-bold text-gray-500 uppercase">📍 {event.location}</span>
                      )}
                    </div>
                    <h2 className="text-2xl font-black uppercase mb-2">{event.title}</h2>
                    <p className="text-gray-600 font-medium">{event.description}</p>
                  </div>

                  <div className="p-6 bg-gray-50 border-t-2 md:border-t-0 md:border-l-2 border-black flex items-center">
                    <span className="font-mono font-bold text-lg">
                      {eventDate?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}