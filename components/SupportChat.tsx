'use client';

// Student-facing support chat — a floating launcher + slide-up panel, mounted
// once in the protected layout for students. Mirrors the Flutter app's
// ChatScreen: ensureChat on open, live status header, reopen-on-send when the
// conversation was closed, and an unread badge from chats/{uid}.studentUnread.

import { useEffect, useMemo, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { chatRef, ensureChat, reopen, type ChatActor } from '@/lib/chat';
import { ChatThread } from '@/components/chat/ChatThread';
import MessageCircle from '@/components/icons/MessageCircle';
import X from '@/components/icons/X';

export default function SupportChat() {
  const { user, role, userName, universityId, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<string>('open');
  const [claimedByName, setClaimedByName] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);

  const isStudent = !loading && !!user && role !== 'university_admin' && role !== 'super_admin';

  const actor: ChatActor | null = useMemo(() => {
    if (!user) return null;
    return {
      uid: user.uid,
      name: userName,
      email: user.email,
      universityId,
      isAdmin: false,
    };
  }, [user, userName, universityId]);

  // Live status + unread badge.
  useEffect(() => {
    if (!isStudent || !user) return;
    const unsub = onSnapshot(chatRef(user.uid), (snap) => {
      const d = snap.data();
      setStatus((d?.status as string) ?? 'open');
      setClaimedByName((d?.claimedByName as string) ?? null);
      setUnread((d?.studentUnread as number) ?? 0);
    }, () => {});
    return unsub;
  }, [isStudent, user]);

  // Allow other UI (e.g. the home "Messages" button) to open the panel.
  useEffect(() => {
    const handler = () => setOpen(true);
    document.addEventListener('open-support-chat', handler);
    return () => document.removeEventListener('open-support-chat', handler);
  }, []);

  // Create / heal the chat doc the first time the panel opens.
  useEffect(() => {
    if (open && actor && !ready) {
      ensureChat(actor).then(() => setReady(true)).catch(() => setReady(true));
    }
  }, [open, actor, ready]);

  if (!isStudent || !actor) return null;

  const statusLabel =
    status === 'claimed' ? `with ${claimedByName ?? 'an admin'}`
    : status === 'closed' ? 'conversation closed'
    : 'an admin will reply soon';

  const onBeforeSend = async () => {
    if (status === 'closed') await reopen(actor.uid);
  };

  return (
    <>
      {/* Floating launcher */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 w-12 h-12 rounded-full bg-[var(--accent-indigo)] text-white shadow-lg shadow-black/25 flex items-center justify-center hover:opacity-90 transition-opacity"
          title="Placement Support"
        >
          <MessageCircle size={20} />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--status-danger)] border-2 border-[var(--bg-canvas)] text-[10px] font-bold flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-40 w-[min(380px,calc(100vw-2rem))] h-[min(560px,calc(100vh-6rem))] flex flex-col rounded-[16px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl shadow-black/40 overflow-hidden animate-fade-in">
          <div className="flex items-center justify-between px-4 h-14 border-b border-[var(--border-subtle)] shrink-0">
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold text-[var(--text-primary)] leading-tight">Placement Support</p>
              <p className="text-[11px] text-[var(--text-muted)] truncate">{statusLabel}</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-[8px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 min-h-0">
            {ready ? (
              <ChatThread key={actor.uid} chatId={actor.uid} actor={actor} asAdmin={false} onBeforeSend={onBeforeSend} />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="loading-dots"><span /><span /><span /></div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
