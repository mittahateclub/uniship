// Support-chat data layer shared by the student widget and the admin inbox.
// Ported field-for-field from the Flutter app's lib/services/chat_service.dart.
//
// Model: one chat per student, `chats/{studentUid}` with a `messages`
// subcollection. Admin-only notes are messages with `internal: true` —
// students query with `internal == false` so they never receive them.

import {
  doc,
  collection,
  getDoc,
  setDoc,
  updateDoc,
  writeBatch,
  serverTimestamp,
  increment,
  query,
  where,
  limit,
  getDocs,
  type DocumentReference,
  type CollectionReference,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';

export type ChatStatus = 'open' | 'claimed' | 'closed';
export type SenderRole = 'admin' | 'student';

/// Identity the chat helpers need — mirror of the app's AuthService fields.
export interface ChatActor {
  uid: string;
  name: string | null;
  email: string | null;
  universityId: string | null;
  isAdmin: boolean;
}

export function chatRef(chatId: string): DocumentReference {
  return doc(db, 'chats', chatId);
}

export function messagesRef(chatId: string): CollectionReference {
  return collection(db, 'chats', chatId, 'messages');
}

/// Creates the student's chat doc on first open, and heals the fields the
/// admin inbox filters on (universityId, name) for chats created before the
/// profile was fully loaded.
export async function ensureChat(actor: ChatActor): Promise<void> {
  const uid = actor.uid;
  if (!uid) return;
  const ref = chatRef(uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await setDoc(
      ref,
      {
        studentId: uid,
        studentName: actor.name ?? actor.email ?? 'Student',
        ...(actor.universityId != null ? { universityId: actor.universityId } : {}),
      },
      { merge: true },
    );
    return;
  }
  await setDoc(ref, {
    studentId: uid,
    studentName: actor.name ?? actor.email ?? 'Student',
    universityId: actor.universityId,
    status: 'open', // open (unassigned) | claimed | closed
    claimedBy: null,
    claimedByName: null,
    createdAt: serverTimestamp(),
    lastMessageAt: serverTimestamp(),
    lastMessageText: '',
    studentUnread: 0,
    adminUnread: 0,
  });
}

const CONTENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  png: 'image/png',
};

/// Sends a text and/or file message and updates the chat summary.
export async function sendMessage(opts: {
  chatId: string;
  actor: ChatActor;
  text?: string;
  file?: File | null;
  internal?: boolean;
}): Promise<void> {
  const { chatId, actor } = opts;
  const internal = opts.internal ?? false;
  const uid = actor.uid;
  if (!uid) return;
  const isAdmin = actor.isAdmin;
  const text = (opts.text ?? '').trim();

  let fileUrl: string | null = null;
  let fileName: string | null = null;
  if (opts.file) {
    const f = opts.file;
    const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
    const contentType = CONTENT_TYPES[ext] ?? 'image/jpeg';
    const ref = storageRef(
      storage,
      `chat_attachments/${chatId}/${Date.now()}_${f.name}`,
    );
    // Storage rules validate the content type, so set it explicitly.
    await uploadBytes(ref, f, { contentType });
    fileUrl = await getDownloadURL(ref);
    fileName = f.name;
  }

  const batch = writeBatch(db);
  const msgRef = doc(messagesRef(chatId));
  batch.set(msgRef, {
    text,
    fileUrl,
    fileName,
    senderId: uid,
    senderName: actor.name ?? actor.email ?? '',
    senderRole: (isAdmin ? 'admin' : 'student') as SenderRole,
    internal,
    createdAt: serverTimestamp(),
    // Own messages start seen by their side.
    seenByStudent: !isAdmin,
    seenByAdmin: isAdmin,
  });

  if (internal) {
    // Notes don't touch the student-facing summary.
    batch.update(chatRef(chatId), { lastMessageAt: serverTimestamp() });
  } else {
    batch.update(chatRef(chatId), {
      lastMessageAt: serverTimestamp(),
      lastMessageText: text.length > 0 ? text : `📎 ${fileName}`,
      lastMessageBy: isAdmin ? 'admin' : 'student',
      ...(isAdmin
        ? { studentUnread: increment(1) }
        : { adminUnread: increment(1) }),
    });
  }
  await batch.commit();
}

/// Marks the other side's messages as seen and clears the unread counter.
export async function markSeen(
  chatId: string,
  { asAdmin }: { asAdmin: boolean },
): Promise<void> {
  const seenField = asAdmin ? 'seenByAdmin' : 'seenByStudent';
  try {
    const unseen = await getDocs(
      query(
        messagesRef(chatId),
        where(seenField, '==', false),
        where('internal', '==', false),
        limit(200),
      ),
    );
    const batch = writeBatch(db);
    unseen.docs.forEach((d) => batch.update(d.ref, { [seenField]: true }));
    batch.update(chatRef(chatId), {
      [asAdmin ? 'adminUnread' : 'studentUnread']: 0,
    });
    await batch.commit();
  } catch {
    // Receipts are best-effort.
  }
}

export function claim(chatId: string, actor: ChatActor): Promise<void> {
  return updateDoc(chatRef(chatId), {
    status: 'claimed',
    claimedBy: actor.uid,
    claimedByName: actor.name ?? actor.email ?? 'Admin',
  });
}

export function closeChat(chatId: string): Promise<void> {
  return updateDoc(chatRef(chatId), { status: 'closed' });
}

export function reopen(chatId: string): Promise<void> {
  return updateDoc(chatRef(chatId), {
    status: 'open',
    claimedBy: null,
    claimedByName: null,
  });
}
