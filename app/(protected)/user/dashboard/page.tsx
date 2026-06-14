// app/(protected)/user/dashboard/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DashboardView, type FeedPost, type SidebarEvent, type Suggestion } from './dashboard.view';
import { toDate, effectiveExpiry, eventTargetsStudent, appliedEventIds, applyToEvent } from '@/lib/college';

export default function UserDashboard() {
  const { user, universityId, userName, userPhotoURL, universityName, branch, gpa, loading } = useAuth();
  const router = useRouter();

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [upcoming, setUpcoming] = useState<SidebarEvent[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [savedIds, setSavedIds] = useState<Map<string, string>>(new Map());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [applyingIds, setApplyingIds] = useState<Set<string>>(new Set());
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  useEffect(() => {
    async function fetchFeed() {
      if (!user) return;
      try {
        const [eventsSnap, internshipsSnap, savedSnap, applied] = await Promise.all([
          getDocs(query(collection(db, 'events'))),
          universityId
            ? getDocs(query(collection(db, 'internships'), where('universityId', '==', universityId)))
            : Promise.resolve(null),
          getDocs(query(collection(db, 'savedEvents'), where('userId', '==', user.uid))),
          appliedEventIds(user.uid),
        ]);

        const now = new Date();
        const feed: FeedPost[] = [];
        const upcomingList: SidebarEvent[] = [];

        eventsSnap.docs.forEach((d) => {
          const data = d.data();
          const exp = effectiveExpiry(data);
          if (exp && now > exp) return;
          if (!eventTargetsStudent(data, { branch, gpa })) return;
          const date = toDate(data.date);
          feed.push({
            id: d.id,
            title: data.title || 'Untitled',
            type: data.type || 'event',
            description: data.description || '',
            location: data.location || undefined,
            company: data.company || undefined,
            date,
            imageUrl: (data.imageUrl as string) || undefined,
            link: (data.link as string)?.trim() || undefined,
            universityId: data.universityId || undefined,
          });
          if (date && date >= now) upcomingList.push({ id: d.id, title: data.title || 'Untitled', type: data.type || 'event', date });
        });

        // Feed: soonest-relevant first.
        feed.sort((a, b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0));
        upcomingList.sort((a, b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0));
        setPosts(feed);
        setUpcoming(upcomingList.slice(0, 5));

        const sugg: Suggestion[] = (internshipsSnap?.docs ?? [])
          .map((d) => { const x = d.data(); return { id: d.id, title: x.role || x.title || 'Internship', companyName: x.companyName, stipend: x.stipend }; })
          .slice(0, 4);
        setSuggestions(sugg);

        const map = new Map<string, string>();
        savedSnap.docs.forEach((d) => { const x = d.data(); map.set(`${x.source}-${x.eventId}`, d.id); });
        setSavedIds(map);
        setAppliedIds(applied);
      } catch (error) {
        console.error('Error fetching feed:', error);
      } finally {
        setDataLoading(false);
      }
    }
    if (!loading && user) fetchFeed();
  }, [user, universityId, branch, gpa, loading]);

  const onToggleSave = async (post: FeedPost) => {
    if (!user) return;
    const key = `event-${post.id}`;
    setSavingIds((p) => new Set(p).add(key));
    try {
      if (savedIds.has(key)) {
        await deleteDoc(doc(db, 'savedEvents', savedIds.get(key)!));
        setSavedIds((p) => { const m = new Map(p); m.delete(key); return m; });
      } else {
        const ref = await addDoc(collection(db, 'savedEvents'), {
          userId: user.uid, eventId: post.id, source: 'event', title: post.title,
          date: post.date, type: post.type, description: post.description,
          location: post.location || null, companyName: post.company || null, savedAt: new Date(),
        });
        setSavedIds((p) => new Map(p).set(key, ref.id));
      }
    } catch (e) {
      console.error('Error toggling save:', e);
    } finally {
      setSavingIds((p) => { const s = new Set(p); s.delete(key); return s; });
    }
  };

  const onApply = async (post: FeedPost) => {
    if (!user) return;
    if (post.link) { window.open(post.link, '_blank', 'noopener,noreferrer'); return; }
    if (appliedIds.has(post.id) || applyingIds.has(post.id)) return;
    setApplyingIds((p) => new Set(p).add(post.id));
    try {
      await applyToEvent(post.id, { title: post.title, universityId: post.universityId }, {
        uid: user.uid, userName, userEmail: user.email, branch, gpa,
      });
      setAppliedIds((p) => new Set(p).add(post.id));
    } catch (e) {
      console.error('Error applying:', e);
    } finally {
      setApplyingIds((p) => { const s = new Set(p); s.delete(post.id); return s; });
    }
  };

  if (!loading && !user) return null;

  return (
    <DashboardView
      loading={loading || dataLoading}
      posts={posts}
      savedIds={savedIds}
      savingIds={savingIds}
      onToggleSave={onToggleSave}
      appliedIds={appliedIds}
      applyingIds={applyingIds}
      onApply={onApply}
      upcoming={upcoming}
      suggestions={suggestions}
      userName={userName}
      userPhotoURL={userPhotoURL}
      universityName={universityName}
      branch={branch}
      savedCount={savedIds.size}
    />
  );
}
