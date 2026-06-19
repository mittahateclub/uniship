'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, getDocs, limit, addDoc, deleteDoc, doc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { InternshipsView, type CollegeEvent } from './internships.view';
import {
  toDate,
  effectiveExpiry,
  eventTargetsStudent,
  appliedEventIds,
  applyToEvent,
} from '@/lib/college';

export default function CollegeSpacePage() {
  const { user, universityId, userName, branch, gpa, loading: authLoading } = useAuth();
  const [items, setItems] = useState<CollegeEvent[]>([]);
  const [savedIds, setSavedIds] = useState<Map<string, string>>(new Map());
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [applyingIds, setApplyingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSaved, setShowSaved] = useState(false);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetchAll() {
      if (!user) return;
      try {
        // Events are readable by any signed-in user (campus-wide); internships
        // are scoped to the student's university by the security rules, so the
        // query MUST carry the universityId filter or Firestore rejects it.
        const [eventsSnap, internshipsSnap, savedSnap, applied] = await Promise.all([
          getDocs(query(collection(db, 'events'), limit(300))),
          universityId
            ? getDocs(query(collection(db, 'internships'), where('universityId', '==', universityId), limit(200)))
            : Promise.resolve(null),
          getDocs(query(collection(db, 'savedEvents'), where('userId', '==', user.uid), limit(500))),
          appliedEventIds(user.uid),
        ]);

        const now = new Date();
        const all: CollegeEvent[] = [];

        // Students never see expired listings, and events respect their
        // branch / GPA targeting.
        eventsSnap.docs.forEach((d) => {
          const data = d.data();
          const exp = effectiveExpiry(data);
          if (exp && now > exp) return;
          if (!eventTargetsStudent(data, { branch, gpa })) return;
          all.push({
            id: d.id,
            title: data.title || 'Untitled',
            date: data.date,
            type: data.type || 'event',
            description: data.description || '',
            location: data.location,
            source: 'event',
            companyName: data.company || undefined,
            link: (data.link as string)?.trim() || undefined,
            universityId: data.universityId || undefined,
          });
        });

        internshipsSnap?.docs.forEach((d) => {
          const data = d.data();
          const exp = effectiveExpiry(data);
          if (exp && now > exp) return;
          all.push({
            id: d.id,
            title: data.role || data.title || 'Internship',
            date: data.deadline,
            type: 'internship',
            description: data.description || '',
            location: data.location,
            source: 'internship',
            companyName: data.companyName,
            role: data.role,
            stipend: data.stipend,
            duration: data.duration,
            deadline: data.deadline,
          });
        });

        all.sort((a, b) => (toDate(a.date)?.getTime() || 0) - (toDate(b.date)?.getTime() || 0));
        setItems(all);

        const map = new Map<string, string>();
        savedSnap.docs.forEach((d) => {
          const data = d.data();
          map.set(`${data.source}-${data.eventId}`, d.id);
        });
        setSavedIds(map);
        setAppliedIds(applied);
      } catch (error) {
        console.error('Error fetching college space:', error);
      } finally {
        setLoading(false);
      }
    }
    if (!authLoading) fetchAll();
  }, [user, universityId, branch, gpa, authLoading]);

  const toggleSave = async (item: CollegeEvent) => {
    if (!user) return;
    const key = `${item.source}-${item.id}`;
    setSavingIds((prev) => new Set(prev).add(key));
    try {
      if (savedIds.has(key)) {
        const saveDocId = savedIds.get(key)!;
        await deleteDoc(doc(db, 'savedEvents', saveDocId));
        setSavedIds((prev) => { const m = new Map(prev); m.delete(key); return m; });
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
        setSavedIds((prev) => new Map(prev).set(key, docRef.id));
      }
    } catch (error) {
      console.error('Error toggling save:', error);
    } finally {
      setSavingIds((prev) => { const s = new Set(prev); s.delete(key); return s; });
    }
  };

  // Apply: external link opens in a new tab; otherwise record an in-app
  // application the placement cell can see (eventApplications).
  const applyTo = async (item: CollegeEvent) => {
    if (!user) return;
    if (item.link) {
      window.open(item.link, '_blank', 'noopener,noreferrer');
      return;
    }
    if (appliedIds.has(item.id) || applyingIds.has(item.id)) return;
    setApplyingIds((prev) => new Set(prev).add(item.id));
    try {
      await applyToEvent(item.id, { title: item.title, universityId: item.universityId }, {
        uid: user.uid,
        userName,
        userEmail: user.email,
        branch,
        gpa,
      });
      setAppliedIds((prev) => new Set(prev).add(item.id));
    } catch (error) {
      console.error('Error applying:', error);
    } finally {
      setApplyingIds((prev) => { const s = new Set(prev); s.delete(item.id); return s; });
    }
  };

  const filtered = useMemo(() => {
    let list = items;
    if (showSaved) list = list.filter((i) => savedIds.has(`${i.source}-${i.id}`));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((i) =>
        i.title.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        (i.companyName && i.companyName.toLowerCase().includes(q)) ||
        (i.location && i.location.toLowerCase().includes(q)),
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
      appliedIds={appliedIds}
      applyingIds={applyingIds}
      onApply={applyTo}
    />
  );
}
