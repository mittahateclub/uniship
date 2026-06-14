// College Space shared logic — branch/GPA targeting + in-app applications.
// Ported field-for-field from the Flutter app's lib/core/student_filters.dart
// and lib/services/event_application_service.dart so both clients agree on
// which students see an event and write identical `eventApplications` docs.

import {
  collection,
  addDoc,
  getDocs,
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

export function toDate(d: any): Date | null {
  if (!d) return null;
  if (typeof d.toDate === 'function') return d.toDate();
  if (d instanceof Date) return d;
  const parsed = new Date(d);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/// End of the day a listing stops being relevant (apply-by wins over date).
export function effectiveExpiry(data: Record<string, any>): Date | null {
  const d = toDate(data.expiresAt) ?? toDate(data.date) ?? toDate(data.deadline);
  if (!d) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
}

/// Whether a student (branch + gpa, either possibly unknown) should see an
/// event. Missing profile data is inclusive — we never hide an event just
/// because the student hasn't filled in their branch or CGPA yet.
export function eventTargetsStudent(
  event: Record<string, any>,
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
    query(collection(db, 'eventApplications'), where('userId', '==', uid)),
  );
  return new Set(
    snap.docs.map((d) => (d.data().eventId as string) ?? '').filter(Boolean),
  );
}

/// Records an in-app application for an event posted without an external link.
/// One doc per (event, student) in `eventApplications`.
export async function applyToEvent(
  eventId: string,
  eventData: Record<string, any>,
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
