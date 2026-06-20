// app/(protected)/user/dashboard/page.tsx
'use client';
import { useTransitionRouter } from 'next-view-transitions';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, getCountFromServer, limit, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DashboardView, type FeedPost, type SidebarEvent, type Suggestion } from './dashboard.view';
import { toDate, effectiveExpiry, eventTargetsStudent, appliedEventIds, applyToEvent, recencyPoints, urgencyPoints } from '@/lib/college';
import { getCache, setCache } from '@/lib/page-cache';

type CachedDash = { posts: FeedPost[]; upcoming: SidebarEvent[]; suggestions: Suggestion[]; trending: string[]; saved: [string, string][]; applied: string[] };

export default function UserDashboard() {
  const { user, universityId, userName, userPhotoURL, universityName, branch, gpa, loading } = useAuth();
  const router = useTransitionRouter();

  const cacheKey = user ? `dashboard:${user.uid}:${universityId ?? ''}` : '';
  const [posts, setPosts] = useState<FeedPost[]>(() => (cacheKey ? getCache<CachedDash>(cacheKey)?.posts : undefined) ?? []);
  const [upcoming, setUpcoming] = useState<SidebarEvent[]>(() => (cacheKey ? getCache<CachedDash>(cacheKey)?.upcoming : undefined) ?? []);
  const [suggestions, setSuggestions] = useState<Suggestion[]>(() => (cacheKey ? getCache<CachedDash>(cacheKey)?.suggestions : undefined) ?? []);
  const [trendingIds, setTrendingIds] = useState<Set<string>>(() => new Set((cacheKey ? getCache<CachedDash>(cacheKey)?.trending : undefined) ?? []));
  const [savedIds, setSavedIds] = useState<Map<string, string>>(() => new Map((cacheKey ? getCache<CachedDash>(cacheKey)?.saved : undefined) ?? []));
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [appliedIds, setAppliedIds] = useState<Set<string>>(() => new Set((cacheKey ? getCache<CachedDash>(cacheKey)?.applied : undefined) ?? []));
  const [applyingIds, setApplyingIds] = useState<Set<string>>(new Set());
  const [dataLoading, setDataLoading] = useState(() => !(cacheKey && getCache<CachedDash>(cacheKey)));

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  useEffect(() => {
    async function fetchFeed() {
      if (!user) return;
      try {
        const [eventsSnap, internshipsSnap, savedSnap, applied] = await Promise.all([
          getDocs(query(collection(db, 'events'), limit(300))),
          universityId
            ? getDocs(query(collection(db, 'internships'), where('universityId', '==', universityId), limit(200)))
            : Promise.resolve(null),
          getDocs(query(collection(db, 'savedEvents'), where('userId', '==', user.uid), limit(500))),
          appliedEventIds(user.uid),
        ]);

        const now = new Date();
        // Each feed item carries the metadata needed to score its priority —
        // engagement + recency + deadline urgency, mirroring the app's home feed.
        type Ranked = {
          post: FeedPost;
          createdAt: Date | null;
          expiry: Date | null;
          engagement: number;
          score: number;
          needsCommentCount: boolean;
        };
        const ranked: Ranked[] = [];
        const upcomingList: SidebarEvent[] = [];

        eventsSnap.docs.forEach((d) => {
          const data = d.data();
          const exp = effectiveExpiry(data);
          if (exp && now > exp) return;
          if (!eventTargetsStudent(data, { branch, gpa })) return;
          const date = toDate(data.date);
          const createdAt = toDate(data.createdAt) ?? date;
          const post: FeedPost = {
            id: d.id,
            title: data.title || 'Untitled',
            type: data.type || 'event',
            description: data.description || '',
            location: data.location || undefined,
            company: data.company || undefined,
            date,
            createdAt,
            imageUrl: (data.imageUrl as string) || undefined,
            link: (data.link as string)?.trim() || undefined,
            universityId: data.universityId || undefined,
          };
          const attendees = Array.isArray(data.attendees) ? data.attendees.length : 0;
          const hasStoredCommentCount = typeof data.commentsCount === 'number';
          const comments = hasStoredCommentCount ? data.commentsCount : 0;
          ranked.push({
            post,
            createdAt,
            expiry: exp,
            engagement: attendees + comments * 2,
            score: 0,
            needsCommentCount: !hasStoredCommentCount,
          });
          if (date && date >= now) upcomingList.push({ id: d.id, title: data.title || 'Untitled', type: data.type || 'event', date });
        });

        // Unified feed: also surface the university's internships as cards,
        // ranked alongside events — mirrors the app's home feed.
        (internshipsSnap?.docs ?? []).forEach((d) => {
          const data = d.data();
          const deadline = toDate(data.deadline);
          const exp = deadline ? new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate(), 23, 59, 59) : null;
          if (exp && now > exp) return;
          const createdAt = toDate(data.createdAt) ?? deadline;
          const post: FeedPost = {
            id: d.id,
            source: 'internship',
            title: data.role || data.title || 'Internship',
            type: 'internship',
            description: data.description || '',
            location: data.location || undefined,
            company: data.companyName || data.company || undefined,
            stipend: data.stipend || undefined,
            date: deadline,
            createdAt,
            link: (data.link as string)?.trim() || undefined,
            universityId: data.universityId || undefined,
          };
          ranked.push({ post, createdAt, expiry: exp, engagement: 0, score: 0, needsCommentCount: false });
        });

        // Engagement is stored with each event, avoiding one aggregate request
        // per recent post on every dashboard load.
        ranked.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
        await Promise.all(ranked.filter((r) => r.needsCommentCount).slice(0, 5).map(async (r) => {
          try {
            const aggregate = await getCountFromServer(collection(db, 'events', r.post.id, 'comments'));
            r.engagement += aggregate.data().count * 2;
          } catch { /* best-effort fallback for events created before commentsCount */ }
        }));

        // Trending score = engagement + freshness + deadline urgency.
        for (const r of ranked) {
          r.score = r.engagement + recencyPoints(r.createdAt, now) + urgencyPoints(r.expiry, now);
        }
        const trending = new Set(
          ranked.filter((r) => r.score > 2).sort((a, b) => b.score - a.score).slice(0, 3).map((r) => r.post.id),
        );

        // Trending floats to the top (by score); everything else by recency.
        ranked.sort((a, b) => {
          const at = trending.has(a.post.id) ? 1 : 0;
          const bt = trending.has(b.post.id) ? 1 : 0;
          if (at !== bt) return bt - at;
          if (at === 1) return b.score - a.score;
          return (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);
        });

        upcomingList.sort((a, b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0));
        setPosts(ranked.map((r) => r.post));
        setTrendingIds(trending);
        setUpcoming(upcomingList.slice(0, 5));

        const sugg: Suggestion[] = (internshipsSnap?.docs ?? [])
          .map((d) => { const x = d.data(); return { id: d.id, title: x.role || x.title || 'Internship', companyName: x.companyName, stipend: x.stipend }; })
          .slice(0, 4);
        setSuggestions(sugg);

        const map = new Map<string, string>();
        savedSnap.docs.forEach((d) => { const x = d.data(); map.set(`${x.source}-${x.eventId}`, d.id); });
        setSavedIds(map);
        setAppliedIds(applied);
        if (cacheKey) setCache<CachedDash>(cacheKey, {
          posts: ranked.map((r) => r.post),
          upcoming: upcomingList.slice(0, 5),
          suggestions: sugg,
          trending: [...trending],
          saved: [...map],
          applied: [...applied],
        });
      } catch (error) {
        console.error('Error fetching feed:', error);
      } finally {
        setDataLoading(false);
      }
    }
    if (!loading && user) fetchFeed();
  }, [user, universityId, branch, gpa, loading, cacheKey]);

  const onToggleSave = async (post: FeedPost) => {
    if (!user) return;
    const source = post.source ?? 'event';
    const key = `${source}-${post.id}`;
    setSavingIds((p) => new Set(p).add(key));
    try {
      if (savedIds.has(key)) {
        await deleteDoc(doc(db, 'savedEvents', savedIds.get(key)!));
        setSavedIds((p) => { const m = new Map(p); m.delete(key); return m; });
      } else {
        const ref = await addDoc(collection(db, 'savedEvents'), {
          userId: user.uid, eventId: post.id, source, title: post.title,
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
    // Internship cards open the full listing detail (mirrors the app).
    if (post.source === 'internship') { router.push(`/user/internships/${post.id}`); return; }
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
      trendingIds={trendingIds}
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
