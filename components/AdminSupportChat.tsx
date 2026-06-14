'use client';

// Admin-facing support chat — a floating launcher + panel (bottom-right), the
// admin counterpart to the student SupportChat. Lists every student chat for
// the admin's university with an unread badge; opening one shows the thread
// with claim / close / reopen + internal notes. Same data as /uniadmin/inbox.

import { useEffect, useMemo, useState } from 'react';
import { collection, query, where, limit, onSnapshot, type DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { claim, closeChat, reopen, type ChatActor } from '@/lib/chat';
import { toDate } from '@/lib/college';
import { ChatThread } from '@/components/chat/ChatThread';
import { MessageCircle, X, ArrowLeft } from '@/components/icons';

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

export default function AdminSupportChat() {
  const { user, role, userName, universityId, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const isUniAdmin = !loading && !!user && role === 'university_admin';

  const actor: ChatActor | null = useMemo(() => {
    if (!user) return null;
    return { uid: user.uid, name: userName, email: user.email, universityId, isAdmin: true };
  }, [user, userName, universityId]);

  // Live chat list (equality-only query → no composite index; sorted below).
  useEffect(() => {
    if (!isUniAdmin || !universityId) return;
    const q = query(collection(db, 'chats'), where('universityId', '==', universityId), limit(200));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
      list.sort((a, b) => (toDate(b.data.lastMessageAt)?.getTime() ?? 0) - (toDate(a.data.lastMessageAt)?.getTime() ?? 0));
      setChats(list);
    }, () => {});
    return unsub;
  }, [isUniAdmin, universityId]);

  // Allow other UI to open the panel.
  useEffect(() => {
    const handler = () => setOpen(true);
    document.addEventListener('open-support-chat', handler);
    return () => document.removeEventListener('open-support-chat', handler);
  }, []);

  if (!isUniAdmin || !actor) return null;

  const totalUnread = chats.filter((c) => ((c.data.adminUnread as number) ?? 0) > 0).length;
  const selected = chats.find((c) => c.id === selectedId) ?? null;

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
        <div className="fixed bottom-5 right-5 z-40 w-[min(390px,calc(100vw-2rem))] h-[min(580px,calc(100vh-6rem))] flex flex-col rounded-[16px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl shadow-black/40 overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="flex items-center gap-2 px-3.5 h-14 border-b border-[var(--border-subtle)] shrink-0">
            {selected ? (
              <>
                <button onClick={() => setSelectedId(null)} className="p-1 rounded-[8px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors">
                  <ArrowLeft size={16} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{(selected.data.studentName as string) ?? 'Student'}</p>
                  <p className="text-[10.5px] text-[var(--text-muted)]">
                    {selected.data.status === 'claimed' ? `claimed by ${selected.data.claimedByName ?? 'an admin'}` : selected.data.status === 'closed' ? 'closed' : 'unassigned'}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {selected.data.status !== 'claimed' && selected.data.status !== 'closed' && (
                    <button onClick={() => claim(selected.id, actor)} className="px-2 py-1 rounded-[7px] text-[10.5px] font-semibold border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-active)] transition-colors">Claim</button>
                  )}
                  {selected.data.status === 'closed' ? (
                    <button onClick={() => reopen(selected.id)} className="px-2 py-1 rounded-[7px] text-[10.5px] font-semibold border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-active)] transition-colors">Reopen</button>
                  ) : (
                    <button onClick={() => closeChat(selected.id)} className="px-2 py-1 rounded-[7px] text-[10.5px] font-semibold border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-active)] transition-colors">Close</button>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold text-[var(--text-primary)] leading-tight">Support Inbox</p>
                  <p className="text-[11px] text-[var(--text-muted)]">Student messages from your university</p>
                </div>
              </>
            )}
            <button onClick={() => setOpen(false)} className="p-1.5 rounded-[8px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors shrink-0">
              <X size={18} />
            </button>
          </div>

          {/* Body: list OR thread */}
          <div className="flex-1 min-h-0">
            {selected ? (
              <ChatThread key={selected.id} chatId={selected.id} actor={actor} asAdmin showInternalToggle />
            ) : chats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <MessageCircle size={28} className="text-[var(--text-faint)] mb-3" />
                <p className="text-[12.5px] font-medium text-[var(--text-primary)]">No conversations yet</p>
                <p className="text-[11px] text-[var(--text-faint)] mt-1">Student messages appear here in real time</p>
              </div>
            ) : (
              <div className="h-full overflow-y-auto">
                {chats.map((c) => {
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
                          <span className={`text-[13px] truncate ${unread > 0 ? 'font-extrabold' : 'font-semibold'} text-[var(--text-primary)]`}>{name}</span>
                          <span className="text-[10px] text-[var(--text-faint)] shrink-0">{timeAgo(toDate(c.data.lastMessageAt))}</span>
                        </span>
                        <span className="flex items-center justify-between gap-2 mt-0.5">
                          <span className={`text-[11.5px] truncate ${unread > 0 ? 'text-[var(--text-secondary)]' : 'text-[var(--text-faint)]'}`}>{lastText || 'No messages yet'}</span>
                          {unread > 0 && (
                            <span className="min-w-[16px] h-4 px-1 rounded-full bg-[var(--accent-indigo)] text-white text-[9.5px] font-bold flex items-center justify-center shrink-0">{unread}</span>
                          )}
                          {isClosed && unread === 0 && (
                            <span className="text-[9px] font-semibold text-[var(--status-success)] uppercase tracking-wide shrink-0">Closed</span>
                          )}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
