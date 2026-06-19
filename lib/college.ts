// College Space shared logic — branch/GPA targeting + in-app applications.
// Ported field-for-field from the Flutter app's lib/core/student_filters.dart
// and lib/services/event_application_service.dart so both clients agree on
// which students see an event and write identical `eventApplications` docs.

import {
  collection,
  addDoc,
  getDocs,
  limit,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const kBranches = [
  'CSE',
  'IT',
  'ECE',
  'EEE',
  'Mechanical',
  'Civil',
  'Chemical',
  'Aerospace',
  'Biotech',
  'AI & ML',
  'Data Science',
  'Other',
] as const;

export const kGpaCutoffs = [6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0] as const;

export function toDate(d: unknown): Date | null {
  if (!d) return null;
  if (typeof (d as { toDate?: unknown }).toDate === 'function') return (d as { toDate: () => Date }).toDate();
  if (d instanceof Date) return d;
  const parsed = new Date(d as string | number);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/// End of the day a listing stops being relevant (apply-by wins over date).
export function effectiveExpiry(data: Record<string, unknown>): Date | null {
  const d = toDate(data.expiresAt) ?? toDate(data.date) ?? toDate(data.deadline);
  if (!d) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
}

/// Whether a student (branch + gpa, either possibly unknown) should see an
/// event. Missing profile data is inclusive — we never hide an event just
/// because the student hasn't filled in their branch or CGPA yet.
export function eventTargetsStudent(
  event: Record<string, unknown>,
  { branch, gpa }: { branch?: string | null; gpa?: number | null },
): boolean {
  const branches: string[] | undefined = Array.isArray(event.targetBranches)
    ? event.targetBranches
    : undefined;
  if (
    branches &&
    branches.length > 0 &&
    !branches.includes('all') &&
    branch &&
    branch.length > 0 &&
    !branches.map((b) => b.toLowerCase()).includes(branch.toLowerCase())
  ) {
    return false;
  }
  const minGpa = typeof event.minGpa === 'number' ? event.minGpa : null;
  if (minGpa != null && gpa != null && gpa < minGpa) return false;
  return true;
}

/// Home-feed priority scoring — ported field-for-field from the Flutter app's
/// student_dashboard.dart so the web feed surfaces the same "trending" items.
/// Trending score = engagement (comments·2 + RSVPs) + recency + deadline urgency.

/// Newer posts rank higher.
export function recencyPoints(createdAt: Date | null, now: Date): number {
  if (!createdAt) return 0;
  const h = (now.getTime() - createdAt.getTime()) / 3_600_000;
  if (h < 24) return 4;
  if (h < 72) return 2;
  if (h < 168) return 1;
  return 0;
}

/// Items closing soon surface as trending.
export function urgencyPoints(expiry: Date | null, now: Date): number {
  if (!expiry) return 0;
  const h = (expiry.getTime() - now.getTime()) / 3_600_000;
  if (h < 0) return 0;
  if (h < 24) return 5;
  if (h < 48) return 3;
  if (h < 168) return 1;
  return 0;
}

export interface ApplicantProfile {
  uid: string;
  userName: string | null;
  userEmail: string | null;
  branch: string | null;
  gpa: number | null;
}

/// Event ids this student has already applied to in-app.
export async function appliedEventIds(uid: string): Promise<Set<string>> {
  const snap = await getDocs(
    query(collection(db, 'eventApplications'), where('userId', '==', uid), limit(500)),
  );
  return new Set(
    snap.docs.map((d) => (d.data().eventId as string) ?? '').filter(Boolean),
  );
}

/// Records an in-app application for an event posted without an external link.
/// One doc per (event, student) in `eventApplications`.
export async function applyToEvent(
  eventId: string,
  eventData: Record<string, unknown>,
  profile: ApplicantProfile,
): Promise<void> {
  await addDoc(collection(db, 'eventApplications'), {
    eventId,
    eventTitle: eventData.title ?? null,
    universityId: eventData.universityId ?? null,
    userId: profile.uid,
    userName: profile.userName ?? profile.userEmail ?? 'Student',
    userEmail: profile.userEmail ?? null,
    branch: profile.branch ?? null,
    gpa: profile.gpa ?? null,
    appliedAt: serverTimestamp(),
  });
}
