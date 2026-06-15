'use client';

// Students who applied to an event in-app (events posted without an external
// link). Backed by the `eventApplications` collection — mirrors the Flutter
// app's EventApplicantsScreen.

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { collection, query, where, limit, getDocs, type DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toDate } from '@/lib/college';
import { ArrowLeft, Mail, Users } from '@/components/icons';

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

export default function EventApplicantsPage() {
  const params = useParams();
  const eventId = String(params.id);
  const [apps, setApps] = useState<DocumentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchApps() {
      try {
        // Equality-only query — no composite index needed; sorted below.
        const snap = await getDocs(
          query(collection(db, 'eventApplications'), where('eventId', '==', eventId), limit(500)),
        );
        const list = snap.docs.map((d) => d.data());
        list.sort((a, b) => (toDate(b.appliedAt)?.getTime() ?? 0) - (toDate(a.appliedAt)?.getTime() ?? 0));
        setApps(list);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchApps();
  }, [eventId]);

  const eventTitle = (apps[0]?.eventTitle as string) ?? 'Event';
  const emails = apps.map((a) => (a.userEmail as string) ?? '').filter(Boolean);

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <Link href="/uniadmin/create-event" className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors pt-8 mb-4">
        <ArrowLeft size={14} /> Back to Manage Events
      </Link>

      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-[26px] font-semibold text-[var(--text-primary)] tracking-[-0.025em]">{eventTitle}</h1>
          <p className="text-[var(--text-tertiary)] text-[13px] mt-1">
            {apps.length} {apps.length === 1 ? 'student has' : 'students have'} applied in-app
          </p>
        </div>
        {emails.length > 0 && (
          <a
            href={`mailto:?bcc=${emails.join(',')}&subject=${encodeURIComponent(eventTitle)}`}
            className="btn-secondary inline-flex items-center gap-1.5 text-[12px] shrink-0"
          >
            <Mail size={13} /> Email
          </a>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="loading-dots"><span /><span /><span /></div></div>
      ) : error ? (
        <p className="text-center text-[13px] text-[var(--text-muted)] py-12">Applicants unavailable</p>
      ) : apps.length === 0 ? (
        <div className="text-center py-16 border border-[var(--border-subtle)] rounded-[var(--radius)] bg-[var(--bg-surface)]">
          <Users size={26} className="mx-auto text-[var(--text-faint)] mb-3" />
          <p className="text-[var(--text-primary)] text-[13px] font-medium">No applications yet</p>
          <p className="text-[var(--text-faint)] text-[12px] mt-1">Students who tap Apply on this event appear here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {apps.map((a, i) => {
            const name = (a.userName as string) ?? 'Student';
            const email = (a.userEmail as string) ?? '';
            const branch = (a.branch as string) ?? '';
            const gpa = a.gpa as number | null;
            return (
              <div key={i} className="window p-3.5 flex items-center gap-3">
                <span className="w-9 h-9 rounded-full bg-[var(--accent-orange)]/15 text-[var(--accent-orange)] flex items-center justify-center text-[14px] font-bold shrink-0">
                  {name[0]?.toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{name}</p>
                  {email && <p className="text-[11px] text-[var(--text-faint)] truncate">{email}</p>}
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {branch && <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-[var(--type-event)]/12 text-[var(--type-event)]">{branch}</span>}
                    {gpa != null && <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-[var(--accent-orange)]/12 text-[var(--accent-orange)]">CGPA {gpa}</span>}
                  </div>
                </div>
                <span className="text-[10.5px] text-[var(--text-faint)] shrink-0">{timeAgo(toDate(a.appliedAt))}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
