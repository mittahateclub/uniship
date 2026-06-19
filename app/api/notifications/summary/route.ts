import { NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { verifyAuthFromRequest } from '@/lib/auth-server';
import { getAdminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

type Category = 'test' | 'event' | 'internship' | 'deadline' | 'practice';
interface SummaryAlert {
  key: string;
  category: Category;
  title: string;
  subtitle: string;
  when: string;
  leadLabel: string;
  navTarget: string | null;
  relevantUntil: string;
  createdAt: string | null;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (typeof (value as { toDate?: unknown }).toDate === 'function') return (value as { toDate: () => Date }).toDate();
  const date = value instanceof Date ? value : new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? null : date;
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function targetsStudent(event: Record<string, unknown>, branch: string | null, gpa: number | null): boolean {
  const branches = Array.isArray(event.targetBranches) ? event.targetBranches as string[] : [];
  if (branches.length > 0 && !branches.includes('all') && branch) {
    if (!branches.map((value) => value.toLowerCase()).includes(branch.toLowerCase())) return false;
  }
  return !(typeof event.minGpa === 'number' && gpa != null && gpa < event.minGpa);
}

function alert(
  key: string,
  category: Category,
  title: string,
  subtitle: string,
  when: Date,
  leadLabel: string,
  navTarget: string | null,
  relevantUntil: Date,
  createdAt: Date | null,
): SummaryAlert {
  return {
    key, category, title, subtitle,
    when: when.toISOString(),
    leadLabel,
    navTarget,
    relevantUntil: relevantUntil.toISOString(),
    createdAt: createdAt?.toISOString() ?? null,
  };
}

export async function POST(request: Request) {
  const user = await verifyAuthFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getAdminDb();
  const profileSnap = await db.collection('users').doc(user.uid).get();
  const profile = profileSnap.data();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const universityId = profile.universityId as string | undefined;
  const branch = (profile.branch as string | undefined) ?? null;
  const gpa = typeof profile.gpa === 'number' ? profile.gpa : null;
  const now = new Date();

  const [eventsSnap, internshipsSnap, testsSnap, savedSnap, practiceSnap] = await Promise.all([
    db.collection('events').limit(300).get(),
    universityId ? db.collection('internships').where('universityId', '==', universityId).limit(200).get() : null,
    universityId ? db.collection('tests').where('universityId', '==', universityId).where('approved', '==', true).limit(100).get() : null,
    db.collection('savedEvents').where('userId', '==', user.uid).limit(500).get(),
    universityId ? db.collection('practice_problems').where('universityId', '==', universityId).limit(200).get() : null,
  ]);

  const savedEventIds = new Set(
    savedSnap.docs
      .filter((saved) => saved.data().source === 'event')
      .map((saved) => saved.data().eventId as string)
      .filter(Boolean),
  );
  const alerts: SummaryAlert[] = [];

  for (const eventDoc of eventsSnap.docs) {
    const data = eventDoc.data();
    const expiry = toDate(data.expiresAt) ?? toDate(data.date);
    if (expiry && now > endOfDay(expiry)) continue;
    if (!targetsStudent(data, branch, gpa) && !savedEventIds.has(eventDoc.id)) continue;
    const date = toDate(data.date);
    const applyBy = toDate(data.expiresAt);
    const createdAt = toDate(data.createdAt);
    const title = data.title || 'Event';
    const subtitle = ({ event: 'Event', internship: 'Internship', hackathon: 'Hackathon', research: 'Research', workshop: 'Workshop' } as Record<string, string>)[data.type] || 'Event';
    if (date) alerts.push(alert(`event:${eventDoc.id}`, 'event', title, subtitle, date, 'Starts', '/user/internships', endOfDay(date), createdAt));
    if (applyBy && (!date || !sameDay(applyBy, date))) {
      alerts.push(alert(`event-deadline:${eventDoc.id}`, 'deadline', title, 'Application deadline', applyBy, 'Closes', '/user/internships', applyBy, createdAt));
    }
  }

  for (const internshipDoc of internshipsSnap?.docs ?? []) {
    const data = internshipDoc.data();
    const deadline = toDate(data.deadline);
    if (!deadline || deadline <= now) continue;
    alerts.push(alert(
      `internship:${internshipDoc.id}`, 'internship', data.role || data.title || 'Internship',
      data.companyName || 'Internship deadline', deadline, 'Closes', '/user/internships',
      deadline, toDate(data.createdAt),
    ));
  }

  for (const testDoc of testsSnap?.docs ?? []) {
    const data = testDoc.data();
    const start = toDate(data.examStart);
    const end = toDate(data.examEnd);
    const relevantUntil = end ?? start;
    if (!relevantUntil || relevantUntil <= now) continue;
    const upcoming = !!start && start > now;
    alerts.push(alert(
      `test:${testDoc.id}`, 'test', data.title || 'Test',
      upcoming ? 'Scheduled assessment' : 'Assessment open',
      start ?? end!, upcoming ? 'Starts' : 'Closes', '/user/test-portal',
      relevantUntil, toDate(data.createdAt),
    ));
  }

  for (const practiceDoc of practiceSnap?.docs ?? []) {
    const data = practiceDoc.data();
    const due = toDate(data.dueDate) ?? toDate(data.deadline) ?? toDate(data.endDate);
    if (!due || due <= now) continue;
    alerts.push(alert(
      `practice:${practiceDoc.id}`, 'practice', data.title || 'Practice set',
      'Practice questions', due, 'Due', '/user/practice', due, toDate(data.createdAt),
    ));
  }

  alerts.sort((a, b) => a.when.localeCompare(b.when));
  const expiresAt = Timestamp.fromMillis(Date.now() + 5 * 60_000);
  await db.collection('notification_summaries').doc(user.uid).set({
    userId: user.uid,
    alerts,
    generatedAt: FieldValue.serverTimestamp(),
    expiresAt,
  });
  return NextResponse.json({ alerts, expiresAt: expiresAt.toDate().toISOString() });
}
