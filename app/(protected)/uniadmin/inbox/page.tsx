'use client';

// Admin Support Inbox — every student chat for the admin's university, newest
// first, with a live unread badge. Mirrors the Flutter app's InboxScreen +
// AdminChatScreen: claim / close / reopen and internal notes via ChatThread.

import { useEffect, useMemo, useState } from 'react';
import { collection, query, where, limit, onSnapshot, type DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { claim, closeChat, reopen, type ChatActor } from '@/lib/chat';
import { toDate } from '@/lib/college';
import { ChatThread } from '@/components/chat/ChatThread';
import { MessageCircle, Search, Bell, Clock } from '@/components/icons';
import { StatBar } from '@/components/StatBar';

function timeAgo(d: Date | null): string {
  if (!d) return '';
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface Chat { id: string; data: DocumentData; }

export default function SupportInboxPage() {
  const { user, role, userName, universityId, loading } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [streamError, setStreamError] = useState(false);
  const [search, setSearch] = useState('');

  const isAdmin = role === 'university_admin' || role === 'super_admin';

  const actor: ChatActor | null = useMemo(() => {
    if (!user) return null;
    return { uid: user.uid, name: userName, email: user.email, universityId, isAdmin: true };
  }, [user, userName, universityId]);

  // Live chat list (equality-only query → no composite index; sorted below).
  useEffect(() => {
    if (!isAdmin || !universityId) return;
    const q = query(collection(db, 'chats'), where('universityId', '==', universityId), limit(200));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setStreamError(false);
        const list = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
        list.sort((a, b) =>
          (toDate(b.data.lastMessageAt)?.getTime() ?? 0) - (toDate(a.data.lastMessageAt)?.getTime() ?? 0),
        );
        setChats(list);
      },
      () => setStreamError(true),
    );
    return unsub;
  }, [isAdmin, universityId]);

  const selected = chats.find((c) => c.id === selectedId) ?? null;

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="loading-dots"><span /><span /><span /></div></div>;
  }

  if (!isAdmin) {
    return <p className="text-center text-[13px] text-[var(--text-muted)] mt-16">Admins only.</p>;
  }

  const unreadConvos = chats.filter((c) => ((c.data.adminUnread as number) ?? 0) > 0).length;
  const openConvos = chats.filter((c) => c.data.status !== 'closed').length;
  const q = search.trim().toLowerCase();
  const filtered = q
    ? chats.filter((c) => `${c.data.studentName ?? ''} ${c.data.lastMessageText ?? ''}`.toLowerCase().includes(q))
    : chats;

  const statusOf = (s?: string) => s === 'claimed' ? 'Claimed' : s === 'closed' ? 'Closed' : 'Open';
  const statusChip = (s?: string) =>
    s === 'closed' ? 'text-[var(--text-faint)] bg-[var(--bg-elevated)]'
    : s === 'claimed' ? 'text-[var(--accent-orange)] bg-[var(--accent-orange)]/10'
    : 'text-[var(--status-success)] bg-[var(--status-success)]/10';

  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in">
      <div className="pt-8 mb-7">
        <h1 className="text-[26px] font-semibold text-[var(--text-primary)] tracking-[-0.025em]">Support Inbox</h1>
        <p className="text-[var(--text-tertiary)] text-[13.5px] mt-1.5">Student messages land here — open a chat to reply.</p>
      </div>

      <StatBar
        className="mb-6"
        items={[
          { label: 'conversations', value: chats.length, icon: MessageCircle },
          { label: 'open', value: openConvos, icon: Clock },
          { label: 'unread', value: unreadConvos, icon: Bell, accent: unreadConvos > 0 ? 'text-[var(--accent-orange)]' : undefined },
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-[330px_1fr] gap-4 h-[calc(100vh-300px)] min-h-[440px]">
        {/* Conversation list */}
        <div className={`rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex-col overflow-hidden ${selected ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-2.5 border-b border-[var(--border-subtle)] shrink-0">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations…"
                className="w-full h-9 pl-9 pr-3 text-[13px] placeholder:text-[var(--text-faint)]"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {streamError ? (
              <p className="text-center text-[12px] text-[var(--text-faint)] mt-10 px-4">Inbox unavailable</p>
            ) : chats.length === 0 ? (
              <div className="text-center mt-12 px-6">
                <MessageCircle size={26} className="mx-auto text-[var(--text-faint)] mb-3" />
                <p className="text-[13px] font-medium text-[var(--text-primary)]">No conversations yet</p>
                <p className="text-[11.5px] text-[var(--text-faint)] mt-1">Student messages appear here in real time</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center mt-12 px-6">
                <Search size={22} className="mx-auto text-[var(--text-faint)] mb-3" />
                <p className="text-[12.5px] font-medium text-[var(--text-primary)]">No matches</p>
                <p className="text-[11.5px] text-[var(--text-faint)] mt-1">Try a different search.</p>
              </div>
            ) : (
              filtered.map((c) => {
                const name = (c.data.studentName as string) ?? 'Student';
                const unread = (c.data.adminUnread as number) ?? 0;
                const lastText = (c.data.lastMessageText as string) ?? '';
                const isClosed = c.data.status === 'closed';
                const active = selectedId === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 text-left border-b border-[var(--border-subtle)] last:border-b-0 border-l-2 transition-colors ${
                      active ? 'bg-[var(--bg-elevated)] border-l-[var(--accent-orange)]' : 'border-l-transparent hover:bg-[var(--bg-elevated)]'
                    }`}
                  >
                    <span className="w-9 h-9 rounded-full bg-[var(--accent-orange)]/15 text-[var(--accent-orange)] flex items-center justify-center text-[14px] font-bold shrink-0">
                      {name[0]?.toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className={`text-[13px] truncate ${unread > 0 ? 'font-bold text-[var(--text-primary)]' : 'font-semibold text-[var(--text-primary)]'}`}>{name}</span>
                        <span className="text-[10px] text-[var(--text-faint)] shrink-0">{timeAgo(toDate(c.data.lastMessageAt))}</span>
                      </span>
                      <span className="flex items-center justify-between gap-2 mt-0.5">
                        <span className={`text-[11.5px] truncate ${unread > 0 ? 'text-[var(--text-secondary)]' : 'text-[var(--text-faint)]'}`}>
                          {lastText || 'No messages yet'}
                        </span>
                        {unread > 0 ? (
                          <span className="min-w-[16px] h-4 px-1 rounded-full bg-[var(--accent-indigo)] text-white text-[9.5px] font-bold flex items-center justify-center shrink-0">{unread}</span>
                        ) : isClosed ? (
                          <span className="text-[9px] font-semibold text-[var(--text-faint)] uppercase tracking-[0.07em] shrink-0">Closed</span>
                        ) : null}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Thread */}
        <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-col min-h-0 overflow-hidden">
          {!selected || !actor ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <MessageCircle size={30} className="text-[var(--text-faint)] mb-3" />
              <p className="text-[13px] font-medium text-[var(--text-primary)]">Select a conversation</p>
              <p className="text-[11.5px] text-[var(--text-faint)] mt-1">Choose a student on the left to reply</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 px-4 h-14 border-b border-[var(--border-subtle)] shrink-0">
                <button onClick={() => setSelectedId(null)} className="md:hidden text-[var(--accent-orange)] shrink-0" title="Back">←</button>
                <span className="w-8 h-8 rounded-full bg-[var(--accent-orange)]/15 text-[var(--accent-orange)] flex items-center justify-center text-[13px] font-bold shrink-0">
                  {((selected.data.studentName as string) ?? 'S')[0]?.toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[13.5px] font-semibold text-[var(--text-primary)] truncate">{(selected.data.studentName as string) ?? 'Student'}</p>
                    <span className={`text-[9.5px] font-semibold uppercase tracking-[0.07em] px-2 py-0.5 rounded-full shrink-0 ${statusChip(selected.data.status)}`}>
                      {statusOf(selected.data.status)}
                    </span>
                  </div>
                  {selected.data.status === 'claimed' && (
                    <p className="text-[11px] text-[var(--text-faint)] truncate">claimed by {selected.data.claimedByName ?? 'an admin'}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {selected.data.status !== 'claimed' && selected.data.status !== 'closed' && (
                    <button onClick={() => claim(selected.id, actor)} className="px-2.5 py-1 rounded-[8px] text-[11px] font-semibold border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-active)] hover:text-[var(--text-primary)] transition-colors">Claim</button>
                  )}
                  {selected.data.status === 'closed' ? (
                    <button onClick={() => reopen(selected.id)} className="px-2.5 py-1 rounded-[8px] text-[11px] font-semibold border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-active)] hover:text-[var(--text-primary)] transition-colors">Reopen</button>
                  ) : (
                    <button onClick={() => closeChat(selected.id)} className="px-2.5 py-1 rounded-[8px] text-[11px] font-semibold border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-active)] hover:text-[var(--text-primary)] transition-colors">Close</button>
                  )}
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <ChatThread key={selected.id} chatId={selected.id} actor={actor} asAdmin showInternalToggle />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
