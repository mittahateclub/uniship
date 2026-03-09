'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, getDocs, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Calendar, MapPin, Clock } from 'lucide-react';

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

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'test': return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'deadline': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      default: return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-dots"><span /><span /><span /></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-10">
      <div className="max-w-5xl mx-auto animate-fade-in">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-violet-500/10 rounded-xl flex items-center justify-center">
              <Calendar size={20} className="text-violet-400" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-100">Academic Calendar</h1>
          </div>
          <p className="text-zinc-500">Stay updated with upcoming tests and deadlines.</p>
        </div>

        {events.length === 0 ? (
          <div className="text-center py-16 bg-zinc-900 border border-zinc-800 border-dashed rounded-2xl">
            <Calendar size={40} className="mx-auto text-zinc-600 mb-3" />
            <p className="text-zinc-400 font-medium">No upcoming events scheduled.</p>
            <p className="text-zinc-600 text-sm mt-1">New events will appear here automatically.</p>
          </div>
        ) : (
          <div className="space-y-3 stagger-children">
            {events.map((event) => {
              const eventDate = event.date?.toDate();
              return (
                <div 
                  key={event.id} 
                  className="bg-zinc-900 rounded-xl border border-zinc-800 card-hover flex overflow-hidden"
                >
                  {/* Date sidebar */}
                  <div className="bg-zinc-800 text-zinc-100 px-5 py-5 flex flex-col items-center justify-center min-w-[80px]">
                    <span className="text-2xl font-bold leading-none">{eventDate?.getDate()}</span>
                    <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mt-0.5">
                      {eventDate?.toLocaleString('default', { month: 'short' })}
                    </span>
                  </div>
                  
                  {/* Content */}
                  <div className="p-5 flex-1 flex flex-col justify-center">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border capitalize ${getTypeBadge(event.type)}`}>
                        {event.type}
                      </span>
                      {event.location && (
                        <span className="flex items-center gap-1 text-xs text-zinc-500">
                          <MapPin size={11} />
                          {event.location}
                        </span>
                      )}
                    </div>
                    <h2 className="text-lg font-bold text-zinc-100 mb-0.5">{event.title}</h2>
                    <p className="text-sm text-zinc-500 line-clamp-1">{event.description}</p>
                  </div>

                  {/* Time */}
                  <div className="px-5 flex items-center border-l border-zinc-800">
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-zinc-400">
                      <Clock size={14} className="text-zinc-500" />
                      {eventDate?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
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