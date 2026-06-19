'use client';

// Live comment thread for an event post (campus feed), backed by the
// events/{eventId}/comments subcollection — mirrors the Flutter app's
// EventCommentsSheet.

import { useEffect, useRef, useState } from 'react';
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  doc,
  increment,
  serverTimestamp,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { toDate } from '@/lib/college';
import X from '@/components/icons/X';
import Send from '@/components/icons/Send';

function timeAgo(d: Date | null): string {
  if (!d) return '';
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  return `${days}d`;
}

export function EventComments({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const { user, userName } = useAuth();
  const [comments, setComments] = useState<{ id: string; data: DocumentData }[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);
  const ref = collection(db, 'events', eventId, 'comments');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      query(ref, orderBy('createdAt', 'desc'), limit(100)),
      (snap) => { setError(false); setComments(snap.docs.map((d) => ({ id: d.id, data: d.data() }))); },
      () => setError(true),
    );
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const send = async () => {
    const t = text.trim();
    if (!t || sending || !user) return;
    setSending(true);
    try {
      await addDoc(ref, {
        userId: user.uid,
        userName: userName ?? user.email ?? 'Student',
        text: t,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'events', eventId), { commentsCount: increment(1) }).catch(() => {});
      setText('');
    } catch {
      setError(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md h-[70vh] sm:h-[60vh] flex flex-col bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-t-[18px] sm:rounded-[16px] overflow-hidden animate-fade-in">
        <div className="flex items-center justify-between px-4 h-13 py-3 border-b border-[var(--border-subtle)] shrink-0">
          <p className="text-[14px] font-semibold text-[var(--text-primary)]">Comments</p>
          <button onClick={onClose} className="p-1.5 rounded-[8px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
          {error ? (
            <p className="text-center text-[12px] text-[var(--text-faint)] mt-8">Comments unavailable</p>
          ) : comments.length === 0 ? (
            <p className="text-center text-[12px] text-[var(--text-faint)] mt-8">Be the first to comment</p>
          ) : (
            comments.map((c) => {
              const name = (c.data.userName as string) ?? 'Student';
              return (
                <div key={c.id} className="flex items-start gap-2.5 mb-3.5">
                  <span className="w-7 h-7 rounded-full bg-[var(--accent-orange)]/15 text-[var(--accent-orange)] flex items-center justify-center text-[11px] font-bold shrink-0">
                    {name[0]?.toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12px] font-semibold text-[var(--text-primary)] truncate">{name}</span>
                      <span className="text-[10px] text-[var(--text-faint)]">{timeAgo(toDate(c.data.createdAt))}</span>
                    </div>
                    <p className="text-[12.5px] text-[var(--text-secondary)] leading-snug break-words">{c.data.text}</p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>
        <div className="border-t border-[var(--border-subtle)] p-2 flex items-center gap-1.5 shrink-0">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
            placeholder="Add a comment…"
            className="flex-1 px-3 py-2 text-[13px] rounded-[10px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] focus:border-[var(--border-active)] focus:outline-none text-[var(--text-primary)] placeholder:text-[var(--text-faint)]"
          />
          <button onClick={send} disabled={sending || !text.trim()} className="p-2 rounded-[8px] text-[var(--accent-indigo)] hover:bg-[var(--bg-elevated)] transition-colors disabled:opacity-40">
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
