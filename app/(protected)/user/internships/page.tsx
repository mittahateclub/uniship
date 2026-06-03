'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, getDocs, addDoc, deleteDoc, doc, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { InternshipsView, type CollegeEvent } from './internships.view';

function toDate(d: any): Date | null {
  if (!d) return null;
  if (typeof d.toDate === 'function') return d.toDate();
  if (d instanceof Date) return d;
  return new Date(d);
}

export default function CollegeSpacePage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<CollegeEvent[]>([]);
  const [savedIds, setSavedIds] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSaved, setShowSaved] = useState(false);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetchAll() {
      if (!user) return;
      try {
        const [eventsSnap, internshipsSnap, savedSnap] = await Promise.all([
          getDocs(query(collection(db, 'events'), orderBy('date', 'asc'))),
          getDocs(query(collection(db, 'internships'), orderBy('deadline', 'asc'))),
          getDocs(query(collection(db, 'savedEvents'), where('userId', '==', user.uid))),
        ]);

        const all: CollegeEvent[] = [];

        eventsSnap.docs.forEach(d => {
          const data = d.data();
          all.push({
            id: d.id, title: data.title, date: data.date, type: data.type || 'event',
            description: data.description || '', location: data.location, source: 'event',
          });
        });

        internshipsSnap.docs.forEach(d => {
          const data = d.data();
          all.push({
            id: d.id, title: data.role || data.title, date: data.deadline, type: 'internship',
            description: data.description || '', location: data.location, source: 'internship',
            companyName: data.companyName, role: data.role, stipend: data.stipend,
            duration: data.duration, deadline: data.deadline,
          });
        });

        all.sort((a, b) => {
          const da = toDate(a.date)?.getTime() || 0;
          const db_ = toDate(b.date)?.getTime() || 0;
          return da - db_;
        });

        setItems(all);

        const map = new Map<string, string>();
        savedSnap.docs.forEach(d => {
          const data = d.data();
          map.set(`${data.source}-${data.eventId}`, d.id);
        });
        setSavedIds(map);
      } catch (error) {
        console.error('Error fetching college space:', error);
      } finally {
        setLoading(false);
      }
    }
    if (!authLoading) fetchAll();
  }, [user, authLoading]);

  const toggleSave = async (item: CollegeEvent) => {
    if (!user) return;
    const key = `${item.source}-${item.id}`;
    setSavingIds(prev => new Set(prev).add(key));

    try {
      if (savedIds.has(key)) {
        const saveDocId = savedIds.get(key)!;
        await deleteDoc(doc(db, 'savedEvents', saveDocId));
        setSavedIds(prev => { const m = new Map(prev); m.delete(key); return m; });
      } else {
        const docRef = await addDoc(collection(db, 'savedEvents'), {
          userId: user.uid,
          eventId: item.id,
          source: item.source,
          title: item.title,
          date: item.date,
          type: item.type,
          description: item.description,
          location: item.location || null,
          companyName: item.companyName || null,
          savedAt: new Date(),
        });
        setSavedIds(prev => new Map(prev).set(key, docRef.id));
      }
    } catch (error) {
      console.error('Error toggling save:', error);
    } finally {
      setSavingIds(prev => { const s = new Set(prev); s.delete(key); return s; });
    }
  };

  const filtered = useMemo(() => {
    let list = items;
    if (showSaved) list = list.filter(i => savedIds.has(`${i.source}-${i.id}`));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        (i.companyName && i.companyName.toLowerCase().includes(q)) ||
        (i.location && i.location.toLowerCase().includes(q))
      );
    }
    return list;
  }, [items, searchQuery, showSaved, savedIds]);

  return (
    <InternshipsView
      loading={loading || authLoading}
      filtered={filtered}
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      showSaved={showSaved}
      onToggleShowSaved={() => setShowSaved(!showSaved)}
      savedIds={savedIds}
      savingIds={savingIds}
      onToggleSave={toggleSave}
    />
  );
}
