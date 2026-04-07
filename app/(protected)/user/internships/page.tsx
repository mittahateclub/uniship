'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, getDocs, addDoc, deleteDoc, doc, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { Bookmark, BookmarkCheck, MapPin, Clock, Calendar, Briefcase, Code, FlaskConical, Presentation, GraduationCap, Search } from 'lucide-react';

interface CollegeEvent {
  id: string;
  title: string;
  date: any;
  type: string;
  description: string;
  location?: string;
  // internship-specific
  companyName?: string;
  role?: string;
  stipend?: string;
  duration?: string;
  deadline?: any;
  source: 'event' | 'internship';
}

const TYPE_CONFIG: Record<string, { badge: string; icon: React.ComponentType<any>; label: string }> = {
  event:      { badge: 'bg-[#4B8BBE]/10 text-[#4B8BBE] border-[#4B8BBE]/20', icon: Calendar, label: 'Event' },
  internship: { badge: 'bg-[#00C16E]/10 text-[#00C16E] border-[#00C16E]/20', icon: Briefcase, label: 'Internship' },
  hackathon:  { badge: 'bg-[#00A8E1]/10 text-[#00A8E1] border-[#00A8E1]/20', icon: Code, label: 'Hackathon' },
  research:   { badge: 'bg-[#F1A82C]/10 text-[#F1A82C] border-[#F1A82C]/20', icon: FlaskConical, label: 'Research' },
  workshop:   { badge: 'bg-[#E04DB0]/10 text-[#E04DB0] border-[#E04DB0]/20', icon: Presentation, label: 'Workshop' },
};

function toDate(d: any): Date | null {
  if (!d) return null;
  if (typeof d.toDate === 'function') return d.toDate();
  if (d instanceof Date) return d;
  return new Date(d);
}

export default function CollegeSpacePage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<CollegeEvent[]>([]);
  const [savedIds, setSavedIds] = useState<Map<string, string>>(new Map()); // eventKey -> saveDocId
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

        // Sort by date
        all.sort((a, b) => {
          const da = toDate(a.date)?.getTime() || 0;
          const db_ = toDate(b.date)?.getTime() || 0;
          return da - db_;
        });

        setItems(all);

        // Build saved map: eventKey -> savedDoc.id
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
        // Unsave
        const saveDocId = savedIds.get(key)!;
        await deleteDoc(doc(db, 'savedEvents', saveDocId));
        setSavedIds(prev => { const m = new Map(prev); m.delete(key); return m; });
      } else {
        // Save
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

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-dots"><span /><span /><span /></div>
      </div>
    );
  }

  return (
    <div className="max-w-[1000px] mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-[-0.02em]">College Space</h1>
        <p className="text-[var(--text-tertiary)] text-[13px] mt-1">All events, internships & opportunities from your university</p>
      </div>

      {/* Search & Saved */}
      <div className="flex gap-2 mb-5">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
          <input
            type="text"
            placeholder="Search events, companies, locations..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[#4B8BBE] transition-all duration-150"
          />
        </div>
        <button
          onClick={() => setShowSaved(!showSaved)}
          className={`flex items-center gap-1.5 px-3 py-2 text-[12px] font-bold rounded border whitespace-nowrap transition-all duration-150 ${
            showSaved
              ? 'bg-[#4B8BBE]/10 text-[#4B8BBE] border-[#4B8BBE]/30'
              : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:border-[var(--border-active)]'
          }`}
        >
          {showSaved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
          Saved ({savedIds.size})
        </button>
      </div>

      {/* Listings */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-[var(--border-active)] rounded">
          <GraduationCap size={28} className="mx-auto text-[var(--text-faint)] mb-3" />
          <p className="text-[var(--text-primary)] text-[13px] font-medium">
            {'No listings found'}
          </p>
          <p className="text-[var(--text-faint)] text-[12px] mt-1">
            {'Check back for new opportunities'}
          </p>
        </div>
      ) : (
        <div id="listings" className="space-y-2">
          {filtered.map((item) => {
            const key = `${item.source}-${item.id}`;
            const isSaved = savedIds.has(key);
            const isSaving = savingIds.has(key);
            const d = toDate(item.date);
            const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.event;
            const TypeIcon = cfg.icon;

            return (
              <div key={key} className="window p-4 hover:border-[var(--border-active)] transition-colors duration-150">
                <div className="flex items-start gap-3">
                  {/* Date badge */}
                  {d && (
                    <div className="hidden sm:flex flex-col items-center justify-center min-w-[48px] py-1">
                      <span className="text-[16px] font-bold tabular-nums text-[var(--text-primary)] leading-none">{d.getDate()}</span>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-faint)] mt-0.5">
                        {d.toLocaleString('default', { month: 'short' })}
                      </span>
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded border uppercase tracking-wider ${cfg.badge}`}>
                        <TypeIcon size={10} />
                        {cfg.label}
                      </span>
                      {item.companyName && (
                        <span className="text-[12px] font-bold text-[#00A8E1]">{item.companyName}</span>
                      )}
                      {item.location && (
                        <span className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                          <MapPin size={10} />
                          {item.location}
                        </span>
                      )}
                    </div>

                    <h2 className="text-[14px] font-bold text-[var(--text-primary)] mb-1">{item.title}</h2>
                    <p className="text-[12px] text-[var(--text-muted)] line-clamp-2 mb-2">{item.description}</p>

                    <div className="flex flex-wrap gap-3 text-[11px] text-[var(--text-faint)]">
                      {d && (
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          {' · '}
                          {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                      {item.stipend && (
                        <span className="flex items-center gap-1 text-[#4CAF50]">
                          {item.stipend}
                        </span>
                      )}
                      {item.duration && (
                        <span className="flex items-center gap-1">
                          <Calendar size={10} />
                          {item.duration}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-start gap-2 shrink-0">
                    <button
                      onClick={() => toggleSave(item)}
                      disabled={isSaving}
                      className={`p-2 rounded-lg border transition-all duration-150 ${
                        isSaved
                          ? 'bg-[#4B8BBE]/10 border-[#4B8BBE]/20 text-[#4B8BBE]'
                          : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-faint)] hover:text-[#4B8BBE] hover:border-[#4B8BBE]/30'
                      } ${isSaving ? 'opacity-50' : ''}`}
                      title={isSaved ? 'Unsave' : 'Save to calendar'}
                    >
                      {isSaved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                    </button>
                    {item.source === 'internship' && (
                      <Link
                        href={`/user/internships/${item.id}`}
                        className="btn-primary text-[11px] px-3 py-2"
                      >
                        Details
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}