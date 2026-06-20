'use client';

// Admin-facing support chat — a floating launcher + panel (bottom-right), the
// admin counterpart to the student SupportChat. Lists every student chat for
// the admin's university with an unread badge; opening one shows the thread
// with claim / close / reopen + internal notes. Same data as /uniadmin/inbox.

import { useEffect, useMemo, useState } from 'react';
import { collection, query, where, limit, onSnapshot, orderBy, type DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { claim, closeChat, reopen, type ChatActor } from '@/lib/chat';
import { toDate } from '@/lib/college';
import { ChatThread } from '@/components/chat/ChatThread';
import MessageCircle from '@/components/icons/MessageCircle';
import X from '@/components/icons/X';
import ArrowLeft from '@/components/icons/ArrowLeft';
import Search from '@/components/icons/Search';

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

const statusOf = (s?: string) => (s === 'claimed' ? 'Claimed' : s === 'closed' ? 'Closed' : 'Open');
const statusChip = (s?: string) =>
  s === 'closed'
    ? 'text-[var(--text-faint)] bg-[var(--bg-elevated)]'
    : s === 'claimed'
      ? 'text-[var(--accent-orange)] bg-[var(--accent-orange)]/10'
      : 'text-[var(--status-success)] bg-[var(--status-success)]/10';
const actionBtn =
  'px-2.5 py-1 rounded-[8px] text-[10.5px] font-semibold border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-active)] hover:text-[var(--text-primary)] transition-colors';

interface Chat { id: string; data: DocumentData; }

export default function AdminSupportChat() {
  const { user, role, userName, universityId, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  const isUniAdmin = !loading && !!user && role === 'university_admin';

  const actor: ChatActor | null = useMemo(() => {
    if (!user) return null;
    return { uid: user.uid, name: userName, email: user.email, universityId, isAdmin: true };
  }, [user, userName, universityId]);

  // Keep only a tiny unread subscription while the panel is closed.
  useEffect(() => {
    if (!isUniAdmin || !universityId) return;
    const unreadQuery = query(
      collection(db, 'chats'),
      where('universityId', '==', universityId),
      where('adminUnread', '>', 0),
      limit(10),
    );
    const unsub = onSnapshot(unreadQuery, (snap) => setUnreadCount(snap.size), () => {});
    return unsub;
  }, [isUniAdmin, universityId]);

  // Load the full recent inbox only while it is visible.
  useEffect(() => {
    if (!open || !isUniAdmin || !universityId) return;
    const inboxQuery = query(
      collection(db, 'chats'),
      where('universityId', '==', universityId),
      orderBy('lastMessageAt', 'desc'),
      limit(50),
    );
    const unsub = onSnapshot(inboxQuery, (snap) => {
      setChats(snap.docs.map((chatDoc) => ({ id: chatDoc.id, data: chatDoc.data() })));
    }, () => {});
    return unsub;
  }, [open, isUniAdmin, universityId]);

  // Allow other UI to open the panel.
  useEffect(() => {
    const handler = () => setOpen(true);
    document.addEventListener('open-support-chat', handler);
    return () => document.removeEventListener('open-support-chat', handler);
  }, []);

  if (!isUniAdmin || !actor) return null;

  const totalUnread = open
    ? chats.filter((c) => ((c.data.adminUnread as number) ?? 0) > 0).length
    : unreadCount;
  const selected = chats.find((c) => c.id === selectedId) ?? null;
  const q = search.trim().toLowerCase();
  const filtered = q
    ? chats.filter((c) => `${c.data.studentName ?? ''} ${c.data.lastMessageText ?? ''}`.toLowerCase().includes(q))
    : chats;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 w-12 h-12 rounded-full bg-[var(--accent-indigo)] text-white shadow-lg shadow-black/25 flex items-center justify-center hover:opacity-90 transition-opacity"
          title="Support Inbox"
        >
          <MessageCircle size={20} />
          {totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--status-danger)] border-2 border-[var(--bg-canvas)] text-[10px] font-bold flex items-center justify-center">
              {totalUnread > 9 ? '9+' : totalUnread}
            </span>
          )}
        </button>
      )}

      {open && (
        <>
        <div className="popover-scrim backdrop-blur-[3px] z-40" onClick={() => setOpen(false)} aria-hidden="true" />
        <div className="fixed bottom-5 right-5 z-50 w-[min(390px,calc(100vw-2rem))] h-[min(580px,calc(100vh-6rem))] flex flex-col rounded-[16px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-[0_24px_64px_-16px_rgba(0,0,0,0.6)] overflow-hidden popover-in-br">
          {selected ? (
            /* ── Thread mode ── */
            <>
              <div className="flex items-center gap-2.5 px-3.5 h-14 border-b border-[var(--border-subtle)] shrink-0">
                <button onClick={() => setSelectedId(null)} className="p-1 rounded-[8px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors shrink-0">
                  <ArrowLeft size={16} />
                </button>
                <span className="w-8 h-8 rounded-full bg-[var(--accent-orange)]/15 text-[var(--accent-orange)] flex items-center justify-center text-[13px] font-bold shrink-0">
                  {((selected.data.studentName as string) ?? 'S')[0]?.toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate leading-tight">{(selected.data.studentName as string) ?? 'Student'}</p>
                  {selected.data.status === 'claimed' && (
                    <p className="text-[10.5px] text-[var(--text-faint)] truncate">claimed by {selected.data.claimedByName ?? 'an admin'}</p>
                  )}
                </div>
                <span className={`text-[9px] font-semibold uppercase tracking-[0.07em] px-2 py-0.5 rounded-full shrink-0 ${statusChip(selected.data.status)}`}>
                  {statusOf(selected.data.status)}
                </span>
                <button onClick={() => setOpen(false)} className="p-1.5 rounded-[8px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors shrink-0">
                  <X size={16} />
                </button>
              </div>
              {/* Action toolbar */}
              <div className="flex items-center justify-end gap-1.5 px-3.5 py-2 border-b border-[var(--border-subtle)] shrink-0">
                {selected.data.status !== 'claimed' && selected.data.status !== 'closed' && (
                  <button onClick={() => claim(selected.id, actor)} className={actionBtn}>Claim</button>
                )}
                {selected.data.status === 'closed' ? (
                  <button onClick={() => reopen(selected.id)} className={actionBtn}>Reopen</button>
                ) : (
                  <button onClick={() => closeChat(selected.id)} className={actionBtn}>Close</button>
                )}
              </div>
              <div className="flex-1 min-h-0">
                <ChatThread key={selected.id} chatId={selected.id} actor={actor} asAdmin showInternalToggle />
              </div>
            </>
          ) : (
            /* ── List mode ── */
            <>
              <div className="flex items-center gap-2 px-3.5 h-14 border-b border-[var(--border-subtle)] shrink-0">
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold text-[var(--text-primary)] leading-tight">Support Inbox</p>
                  <p className="text-[11px] text-[var(--text-muted)]">{chats.length} conversation{chats.length !== 1 ? 's' : ''}{totalUnread > 0 ? ` · ${totalUnread} unread` : ''}</p>
                </div>
                <button onClick={() => setOpen(false)} className="p-1.5 rounded-[8px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors shrink-0">
                  <X size={18} />
                </button>
              </div>

              {chats.length > 0 && (
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
              )}

              <div className="flex-1 min-h-0 overflow-y-auto">
                {chats.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center px-6">
                    <MessageCircle size={28} className="text-[var(--text-faint)] mb-3" />
                    <p className="text-[12.5px] font-medium text-[var(--text-primary)]">No conversations yet</p>
                    <p className="text-[11px] text-[var(--text-faint)] mt-1">Student messages appear here in real time</p>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center px-6">
                    <Search size={22} className="text-[var(--text-faint)] mb-3" />
                    <p className="text-[12.5px] font-medium text-[var(--text-primary)]">No matches</p>
                    <p className="text-[11px] text-[var(--text-faint)] mt-1">Try a different search.</p>
                  </div>
                ) : (
                  filtered.map((c) => {
                    const name = (c.data.studentName as string) ?? 'Student';
                    const unread = (c.data.adminUnread as number) ?? 0;
                    const lastText = (c.data.lastMessageText as string) ?? '';
                    const isClosed = c.data.status === 'closed';
                    return (
                      <button
                        key={c.id}
                        onClick={() => setSelectedId(c.id)}
                        className="w-full flex items-center gap-2.5 px-3.5 py-3 text-left border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-elevated)] transition-colors"
                      >
                        <span className="w-9 h-9 rounded-full bg-[var(--accent-orange)]/15 text-[var(--accent-orange)] flex items-center justify-center text-[14px] font-bold shrink-0">
                          {name[0]?.toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className={`text-[13px] truncate ${unread > 0 ? 'font-bold' : 'font-semibold'} text-[var(--text-primary)]`}>{name}</span>
                            <span className="text-[10px] text-[var(--text-faint)] shrink-0">{timeAgo(toDate(c.data.lastMessageAt))}</span>
                          </span>
                          <span className="flex items-center justify-between gap-2 mt-0.5">
                            <span className={`text-[11.5px] truncate ${unread > 0 ? 'text-[var(--text-secondary)]' : 'text-[var(--text-faint)]'}`}>{lastText || 'No messages yet'}</span>
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
            </>
          )}
        </div>
        </>
      )}
    </>
  );
}
