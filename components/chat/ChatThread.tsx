'use client';

// Shared support-chat thread — live message stream + composer. Used by the
// student widget (asAdmin=false, internal messages filtered out) and the admin
// inbox (asAdmin=true, internal notes visible + postable). Behaviour mirrors the
// Flutter app's chat_screen / admin_chat_screen / chat_widgets.

import { useEffect, useRef, useState } from 'react';
import {
  getDocs,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  where,
  limit,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import {
  messagesRef,
  markSeen,
  sendMessage,
  type ChatActor,
} from '@/lib/chat';
import { toDate } from '@/lib/college';
import Paperclip from '@/components/icons/Paperclip';
import Send from '@/components/icons/Send';
import Lock from '@/components/icons/Lock';
import FileText from '@/components/icons/FileText';
import ImageIcon from '@/components/icons/ImageIcon';
import FilePdf from '@/components/icons/FilePdf';
import Check from '@/components/icons/Check';
import CheckCircle2 from '@/components/icons/CheckCircle2';

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

const isImage = (name: string) => /\.(png|jpe?g|gif|webp)$/i.test(name);

function AttachmentPreview({ fileUrl, fileName }: { fileUrl: string; fileName: string }) {
  if (isImage(fileName) && fileUrl) {
    return (
      <a href={fileUrl} target="_blank" rel="noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={fileUrl} alt={fileName} className="rounded-[10px] max-w-[210px] max-h-[160px] object-cover" />
      </a>
    );
  }
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  const Icon = ext === 'pdf' ? FilePdf : ext === 'doc' || ext === 'docx' ? FileText : ImageIcon;
  return (
    <a
      href={fileUrl}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 p-2 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:border-[var(--border-active)] transition-colors max-w-[230px]"
    >
      <span className="w-8 h-8 rounded-[8px] bg-[var(--accent-orange)]/12 text-[var(--accent-orange)] flex items-center justify-center shrink-0">
        <Icon size={16} />
      </span>
      <span className="min-w-0">
        <span className="block text-[12px] font-medium text-[var(--text-primary)] truncate">{fileName}</span>
        <span className="block text-[9.5px] text-[var(--text-faint)] uppercase tracking-[0.07em]">{ext} · open</span>
      </span>
    </a>
  );
}

function MessageBubble({ data, mine, seen }: { data: DocumentData; mine: boolean; seen: boolean }) {
  const internal = data.internal === true;
  const text = (data.text as string) ?? '';
  const fileName = data.fileName as string | null;
  const fileUrl = (data.fileUrl as string) ?? '';
  const time = toDate(data.createdAt);

  return (
    <div className={`flex mb-2 ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[78%] px-3 pt-2 pb-1.5 text-[13px] leading-[1.4] rounded-[14px] border ${
          internal
            ? 'bg-[var(--accent-orange)]/12 border-[var(--accent-orange)]/40'
            : mine
              ? 'bg-[var(--accent-indigo)]/14 border-[var(--accent-indigo)]/30 rounded-br-[4px]'
              : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] rounded-bl-[4px]'
        }`}
      >
        {internal && (
          <div className="flex items-center gap-1 mb-1 text-[var(--accent-orange)]">
            <Lock size={10} />
            <span className="text-[8.5px] font-extrabold tracking-[0.1em]">INTERNAL NOTE</span>
          </div>
        )}
        {fileName && (
          <div className={text ? 'mb-1.5' : 'mb-0.5'}>
            <AttachmentPreview fileUrl={fileUrl} fileName={fileName} />
          </div>
        )}
        {text && <p className="text-[var(--text-primary)] whitespace-pre-wrap break-words">{text}</p>}
        <div className="flex items-center gap-1 mt-0.5 justify-end">
          <span className="text-[9.5px] text-[var(--text-faint)]">{timeAgo(time)}</span>
          {mine && !internal && (
            seen
              ? <CheckCircle2 size={11} className="text-[var(--accent-indigo)]" />
              : <Check size={11} className="text-[var(--text-faint)]" />
          )}
        </div>
      </div>
    </div>
  );
}

const ALLOWED = ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg'];
const MESSAGE_PAGE_SIZE = 50;

export function ChatThread({
  chatId,
  actor,
  asAdmin,
  showInternalToggle = false,
  onBeforeSend,
}: {
  chatId: string;
  actor: ChatActor;
  asAdmin: boolean;
  showInternalToggle?: boolean;
  onBeforeSend?: () => Promise<void>;
}) {
  const [docs, setDocs] = useState<{ id: string; data: DocumentData }[]>([]);
  const [text, setText] = useState('');
  const [internal, setInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const markScheduled = useRef(false);
  const oldestVisibleRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);

  // Live message stream. Students filter internal==false (also enforced by
  // rules); admins see everything. Equality-only query → no composite index.
  useEffect(() => {
    oldestVisibleRef.current = null;
    markSeen(chatId, { asAdmin }).catch(() => {});
    const q = asAdmin
      ? query(messagesRef(chatId), orderBy('createdAt', 'desc'), limit(MESSAGE_PAGE_SIZE))
      : query(messagesRef(chatId), where('internal', '==', false), orderBy('createdAt', 'desc'), limit(MESSAGE_PAGE_SIZE));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setError(false);
        oldestVisibleRef.current = snap.docs.at(-1) ?? null;
        setHasOlder(snap.size === MESSAGE_PAGE_SIZE);
        const latest = snap.docs.map((messageDoc) => ({ id: messageDoc.id, data: messageDoc.data() }));
        setDocs((previous) => {
          const merged = new Map(previous.map((message) => [message.id, message]));
          latest.forEach((message) => merged.set(message.id, message));
          return Array.from(merged.values()).sort((a, b) => {
            const at = toDate(a.data.createdAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
            const bt = toDate(b.data.createdAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
            return at - bt;
          });
        });
        const seenField = asAdmin ? 'seenByAdmin' : 'seenByStudent';
        if (latest.some((m) => m.data[seenField] === false) && !markScheduled.current) {
          markScheduled.current = true;
          requestAnimationFrame(() => {
            markSeen(chatId, { asAdmin }).finally(() => { markScheduled.current = false; });
          });
        }
      },
      () => setError(true),
    );
    return unsub;
  }, [chatId, asAdmin]);

  const loadOlder = async () => {
    const cursor = oldestVisibleRef.current;
    if (!cursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const olderQuery = asAdmin
        ? query(messagesRef(chatId), orderBy('createdAt', 'desc'), startAfter(cursor), limit(MESSAGE_PAGE_SIZE))
        : query(messagesRef(chatId), where('internal', '==', false), orderBy('createdAt', 'desc'), startAfter(cursor), limit(MESSAGE_PAGE_SIZE));
      const snapshot = await getDocs(olderQuery);
      oldestVisibleRef.current = snapshot.docs.at(-1) ?? cursor;
      setHasOlder(snapshot.size === MESSAGE_PAGE_SIZE);
      const older = snapshot.docs.map((messageDoc) => ({ id: messageDoc.id, data: messageDoc.data() }));
      setDocs((previous) => {
        const merged = new Map(previous.map((message) => [message.id, message]));
        older.forEach((message) => merged.set(message.id, message));
        return Array.from(merged.values()).sort((a, b) => {
          const at = toDate(a.data.createdAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
          const bt = toDate(b.data.createdAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
          return at - bt;
        });
      });
    } catch {
      setError(true);
    } finally {
      setLoadingOlder(false);
    }
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [docs.length]);

  const send = async (file?: File | null) => {
    const t = text.trim();
    if ((!t && !file) || sending) return;
    setSending(true);
    try {
      if (onBeforeSend) await onBeforeSend();
      await sendMessage({ chatId, actor, text: t, file, internal });
      setText('');
    } catch {
      setError(true);
    } finally {
      setSending(false);
    }
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED.includes(ext)) { setError(true); return; }
    if (file.size > 6 * 1024 * 1024) { setError(true); return; }
    await send(file);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3.5 py-3">
        {hasOlder && (
          <div className="flex justify-center mb-3">
            <button type="button" onClick={loadOlder} disabled={loadingOlder} className="text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-50">
              {loadingOlder ? 'Loading…' : 'Load older messages'}
            </button>
          </div>
        )}
        {error && docs.length === 0 ? (
          <p className="text-center text-[12px] text-[var(--text-faint)] mt-8">Chat unavailable</p>
        ) : docs.length === 0 ? (
          <div className="text-center mt-10 px-6">
            <p className="text-[13px] font-semibold text-[var(--text-primary)]">Ask the placement cell anything</p>
            <p className="text-[11.5px] text-[var(--text-muted)] mt-1 leading-relaxed">
              Job postings, document verification, interview schedules — an admin will reply here.
            </p>
          </div>
        ) : (
          docs.map((m) => {
            const mine = m.data.senderId === actor.uid;
            // "Seen" = the OTHER side saw my message.
            const seen = asAdmin ? m.data.seenByStudent === true : m.data.seenByAdmin === true;
            return <MessageBubble key={m.id} data={m.data} mine={mine} seen={seen} />;
          })
        )}
      </div>

      <div className="border-t border-[var(--border-subtle)] p-2 shrink-0">
        {showInternalToggle && (
          <button
            type="button"
            onClick={() => setInternal((v) => !v)}
            className={`mb-1.5 ml-1 inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10.5px] font-semibold border transition-colors ${
              internal
                ? 'bg-[var(--accent-orange)]/15 text-[var(--accent-orange)] border-[var(--accent-orange)]/40'
                : 'text-[var(--text-muted)] border-[var(--border-subtle)] hover:border-[var(--border-active)]'
            }`}
          >
            <Lock size={11} /> Internal note
          </button>
        )}
        <div className="flex items-end gap-1.5">
          <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" className="hidden" onChange={onPickFile} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
            title="Attach file"
            className="p-2 rounded-[8px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors disabled:opacity-40 shrink-0"
          >
            <Paperclip size={17} />
          </button>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            rows={1}
            placeholder={internal ? 'Note for other admins…' : 'Type a message…'}
            className="flex-1 resize-none max-h-24 px-3 py-2 text-[13px] rounded-[10px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] focus:border-[var(--border-active)] focus:outline-none text-[var(--text-primary)] placeholder:text-[var(--text-faint)]"
          />
          <button
            type="button"
            onClick={() => send()}
            disabled={sending || (!text.trim())}
            className={`p-2 rounded-[8px] transition-colors disabled:opacity-40 shrink-0 ${
              internal ? 'text-[var(--accent-orange)]' : 'text-[var(--accent-indigo)]'
            } hover:bg-[var(--bg-elevated)]`}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
