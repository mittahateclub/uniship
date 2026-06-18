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
import { ArrowLeft, Mail, Users, GraduationCap, TrendingUp } from '@/components/icons';
import { StatBar } from '@/components/StatBar';

const microLabel = 'text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)]';

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

  const gpas = apps.map((a) => a.gpa).filter((g): g is number => typeof g === 'number');
  const avgGpa = gpas.length ? (gpas.reduce((s, g) => s + g, 0) / gpas.length).toFixed(1) : '—';
  const branchCount = new Set(apps.map((a) => a.branch).filter(Boolean)).size;

  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in">
      {/* Header */}
      <div className="pt-8 mb-7">
        <Link href="/uniadmin/create-event" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors mb-4">
          <ArrowLeft size={14} /> Events
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[26px] font-semibold text-[var(--text-primary)] tracking-[-0.025em] truncate">{eventTitle}</h1>
            <p className="text-[var(--text-tertiary)] text-[13.5px] mt-1.5">
              {apps.length} {apps.length === 1 ? 'student has' : 'students have'} applied in-app
            </p>
          </div>
          {emails.length > 0 && (
            <a
              href={`mailto:?bcc=${emails.join(',')}&subject=${encodeURIComponent(eventTitle)}`}
              className="btn-secondary inline-flex items-center gap-1.5 text-[12.5px] shrink-0"
            >
              <Mail size={14} /> Email all
            </a>
          )}
        </div>
      </div>

      {loading ? (
        <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border-subtle)] last:border-b-0">
              <span className="skeleton w-9 h-9 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <span className="skeleton h-3 w-1/3 rounded block" />
                <span className="skeleton h-2.5 w-1/2 rounded block" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-16 border border-[var(--border-subtle)] rounded-[var(--radius)] bg-[var(--bg-surface)]">
          <p className="text-[var(--text-primary)] text-[13px] font-medium">Applicants unavailable</p>
          <p className="text-[var(--text-faint)] text-[12px] mt-1">Please try again in a moment.</p>
        </div>
      ) : apps.length === 0 ? (
        <div className="text-center py-16 border border-[var(--border-subtle)] rounded-[var(--radius)] bg-[var(--bg-surface)]">
          <Users size={26} className="mx-auto text-[var(--text-faint)] mb-3" />
          <p className="text-[var(--text-primary)] text-[13px] font-medium">No applications yet</p>
          <p className="text-[var(--text-faint)] text-[12px] mt-1">Students who tap Apply on this event appear here.</p>
        </div>
      ) : (
        <>
          {/* Overview — slim inline summary */}
          <StatBar
            className="mb-6"
            items={[
              { label: 'applicants', value: apps.length, icon: Users },
              { label: 'branches', value: branchCount, icon: GraduationCap },
              { label: 'avg CGPA', value: avgGpa, icon: TrendingUp },
            ]}
          />

          {/* Applicants register list */}
          <div className="flex items-center justify-between mb-3">
            <h2 className={microLabel}>Applicants</h2>
            <span className="text-[11.5px] text-[var(--text-faint)]">Newest first</span>
          </div>
          <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
            {apps.map((a, i) => {
              const name = (a.userName as string) ?? 'Student';
              const email = (a.userEmail as string) ?? '';
              const branch = (a.branch as string) ?? '';
              const gpa = a.gpa as number | null;
              return (
                <div key={i} className="group flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-elevated)] transition-colors duration-150">
                  <span className="w-9 h-9 rounded-full bg-[var(--accent-orange)]/15 text-[var(--accent-orange)] flex items-center justify-center text-[14px] font-bold shrink-0">
                    {name[0]?.toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-semibold text-[var(--text-primary)] truncate">{name}</p>
                    {email && <p className="text-[11.5px] text-[var(--text-faint)] truncate">{email}</p>}
                  </div>
                  <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                    {branch && <span className="px-2.5 py-0.5 text-[10.5px] font-semibold rounded-full bg-[var(--type-event)]/10 text-[var(--type-event)]">{branch}</span>}
                    {gpa != null && <span className="px-2.5 py-0.5 text-[10.5px] font-semibold rounded-full bg-[var(--accent-orange)]/10 text-[var(--accent-orange)]">CGPA {gpa}</span>}
                  </div>
                  <span className="text-[10.5px] text-[var(--text-faint)] shrink-0 w-10 text-right tabular-nums">{timeAgo(toDate(a.appliedAt))}</span>
                  {email && (
                    <a
                      href={`mailto:${email}?subject=${encodeURIComponent(eventTitle)}`}
                      className="p-2 rounded-full text-[var(--text-faint)] hover:text-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/10 transition-colors lg:opacity-0 lg:group-hover:opacity-100 lg:focus:opacity-100"
                      title={`Email ${name}`}
                    >
                      <Mail size={14} />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
