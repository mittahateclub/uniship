// In-app notification center data for students — upcoming tests, events,
// internships and deadlines, computed from the same Firestore data the student
// already reads. Ported field-for-field from the Flutter app's
// lib/services/notification_service.dart (_compute) so both clients surface the
// same alerts. The web has no OS-scheduled reminders (browsers can't reliably
// fire local notifications while closed); this powers the in-app bell + panel,
// and — when the student grants permission — a browser toast for newly-posted
// items on the next visit, mirroring the app's "newly posted" behaviour.

import { collection, getDocs, query, where, type Query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toDate, eventTargetsStudent } from '@/lib/college';

export type AlertCategory = 'test' | 'event' | 'internship' | 'deadline' | 'practice';

/// A single upcoming thing a student should know about.
export interface AppAlert {
  key: string;            // stable id, e.g. "test:<docId>"
  category: AlertCategory;
  title: string;
  subtitle: string;
  when: Date;             // the moment it happens / is due
  leadLabel: string;      // "Starts" | "Closes" | "Due" | "Happening"
  navTarget: string | null; // route to open, or null (informational)
  relevantUntil: Date;    // hidden from the list after this
  createdAt: Date | null; // for "newly posted" detection
}

export interface AlertContext {
  uid: string | null;
  universityId: string | null;
  branch: string | null;
  gpa: number | null;
}

const EVENT_TYPE_LABEL: Record<string, string> = {
  event: 'Event',
  internship: 'Internship',
  hackathon: 'Hackathon',
  research: 'Research',
  workshop: 'Workshop',
};

function eventTypeLabel(type: string): string {
  return EVENT_TYPE_LABEL[type] ?? 'Event';
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
}

// Missing collection / rules — skip that source silently (matches app's _tryGet).
async function tryGet(q: Query) {
  try {
    return await getDocs(q);
  } catch {
    return null;
  }
}

/// Recompute the student's alerts from Firestore. Returns soonest-first.
/// Never throws — a failing source is skipped, mirroring the app.
export async function computeAlerts(ctx: AlertContext): Promise<AppAlert[]> {
  const { uid, universityId: uni, branch, gpa } = ctx;
  const now = new Date();

  const [eventsSnap, internSnap, testsSnap, savedSnap, practiceSnap] = await Promise.all([
    tryGet(query(collection(db, 'events'))),
    uni ? tryGet(query(collection(db, 'internships'), where('universityId', '==', uni))) : Promise.resolve(null),
    // Students may only list approved tests in their university (firestore.rules);
    // the app also discards non-approved tests, so this is equivalent + allowed.
    uni ? tryGet(query(collection(db, 'tests'), where('universityId', '==', uni), where('approved', '==', true))) : Promise.resolve(null),
    uid ? tryGet(query(collection(db, 'savedEvents'), where('userId', '==', uid))) : Promise.resolve(null),
    uni ? tryGet(query(collection(db, 'practice_problems'), where('universityId', '==', uni))) : Promise.resolve(null),
  ]);

  const out: AppAlert[] = [];

  // Saved event ids — a student's bookmarks always get an alert even if
  // branch/GPA targeting wouldn't otherwise include them.
  const savedEventIds = new Set<string>();
  for (const d of savedSnap?.docs ?? []) {
    const data = d.data();
    if (data.source === 'event' && typeof data.eventId === 'string') {
      savedEventIds.add(data.eventId);
    }
  }

  // ── Events ──
  for (const docu of eventsSnap?.docs ?? []) {
    const data = docu.data();
    const expiry = toDate(data.expiresAt) ?? toDate(data.date);
    if (expiry && now > endOfDay(expiry)) continue;
    const targeted = eventTargetsStudent(data, { branch, gpa });
    if (!targeted && !savedEventIds.has(docu.id)) continue;

    const type = (data.type as string) ?? 'event';
    const title = (data.title as string) ?? 'Event';
    const date = toDate(data.date);
    const applyBy = toDate(data.expiresAt);
    const created = toDate(data.createdAt);

    if (date) {
      out.push({
        key: `event:${docu.id}`,
        category: 'event',
        title,
        subtitle: eventTypeLabel(type),
        when: date,
        leadLabel: 'Starts',
        navTarget: '/user/internships',
        relevantUntil: endOfDay(date),
        createdAt: created,
      });
    }
    // Separate apply-by deadline (only if it's a different day to the event).
    if (applyBy && (!date || !sameDay(applyBy, date))) {
      out.push({
        key: `event-deadline:${docu.id}`,
        category: 'deadline',
        title,
        subtitle: 'Application deadline',
        when: applyBy,
        leadLabel: 'Closes',
        navTarget: '/user/internships',
        relevantUntil: applyBy,
        createdAt: created,
      });
    }
  }

  // ── Internships (deadline) ──
  for (const docu of internSnap?.docs ?? []) {
    const data = docu.data();
    const deadline = toDate(data.deadline);
    if (!deadline || deadline <= now) continue;
    const title = (data.role as string) ?? (data.title as string) ?? 'Internship';
    out.push({
      key: `internship:${docu.id}`,
      category: 'internship',
      title,
      subtitle: (data.companyName as string) ?? 'Internship deadline',
      when: deadline,
      leadLabel: 'Closes',
      navTarget: '/user/internships',
      relevantUntil: deadline,
      createdAt: toDate(data.createdAt),
    });
  }

  // ── Tests (approved, upcoming) ──
  for (const docu of testsSnap?.docs ?? []) {
    const data = docu.data();
    if (data.approved !== true) continue;
    const start = toDate(data.examStart);
    const end = toDate(data.examEnd);
    const title = (data.title as string) ?? 'Test';
    const relevantUntil = end ?? start;
    if (!relevantUntil || relevantUntil <= now) continue;
    const upcoming = !!start && start > now;
    out.push({
      key: `test:${docu.id}`,
      category: 'test',
      title,
      subtitle: upcoming ? 'Scheduled assessment' : 'Assessment open',
      when: start ?? end!,
      leadLabel: upcoming ? 'Starts' : 'Closes',
      navTarget: '/user/test-portal', // tests are taken here on the web
      relevantUntil,
      createdAt: toDate(data.createdAt),
    });
  }

  // ── Practice questions (best-effort; schema may vary) ──
  for (const docu of practiceSnap?.docs ?? []) {
    const data = docu.data();
    const due = toDate(data.dueDate) ?? toDate(data.deadline) ?? toDate(data.endDate);
    if (!due || due <= now) continue;
    const title = (data.title as string) ?? 'Practice set';
    out.push({
      key: `practice:${docu.id}`,
      category: 'practice',
      title,
      subtitle: 'Practice questions',
      when: due,
      leadLabel: 'Due',
      navTarget: '/user/practice',
      relevantUntil: due,
      createdAt: toDate(data.createdAt),
    });
  }

  out.sort((a, b) => a.when.getTime() - b.when.getTime());
  return out;
}

// ── Relative-time formatting (ported from notifications_screen.dart) ──────

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatDayDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/// "Starts in 2h" — full relative phrasing for the row subtitle.
export function untilLong(when: Date): string {
  const now = new Date();
  const ms = when.getTime() - now.getTime();
  if (ms <= 0) return 'now';
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `in ${mins}m`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 24) return `in ${hours}h`;
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (sameDay(when, tomorrow)) return `tomorrow at ${formatTime(when)}`;
  const days = Math.floor(ms / 86_400_000);
  if (days < 7) return `in ${days} days`;
  return `on ${formatDayDate(when)}`;
}

/// Compact form for the urgency chip.
export function untilShort(when: Date): string {
  const ms = when.getTime() - Date.now();
  if (ms <= 0) return 'NOW';
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(ms / 86_400_000)}d`;
}

/// Headline for a "newly posted" browser toast, by category.
export function postedTitle(category: AlertCategory): string {
  switch (category) {
    case 'test': return 'New test posted';
    case 'internship': return 'New internship posted';
    case 'practice': return 'New practice set posted';
    case 'deadline': return 'New opportunity posted';
    default: return 'New event posted';
  }
}
