'use client';
import { useTransitionRouter } from 'next-view-transitions';

// Student-facing notification center — a top-bar bell with an unseen badge and
// a drop-down panel of upcoming tests, events, internships and deadlines.
// Mirrors the Flutter app's NotificationsScreen / NotificationsAppBarButton:
// alerts grouped into Today / This week / Later, an urgency chip per row, a
// live unseen count, and "newly posted" surfacing. Browsers can't schedule
// future OS reminders, so the app's local-notification scheduling becomes a
// browser toast for freshly-posted items (when the student allows it).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  computeAlerts, untilLong, untilShort, postedTitle,
  type AppAlert, type AlertCategory,
} from '@/lib/alerts';
import Bell from '@/components/icons/Bell';
import FileText from '@/components/icons/FileText';
import Calendar from '@/components/icons/Calendar';
import Briefcase from '@/components/icons/Briefcase';
import Clock from '@/components/icons/Clock';
import Code from '@/components/icons/Code';
import X from '@/components/icons/X';

const CATEGORY_STYLE: Record<AlertCategory, { color: string; Icon: React.ComponentType<{ size?: number }> }> = {
  test:       { color: 'var(--status-warning)',   Icon: FileText },
  event:      { color: 'var(--type-event)',       Icon: Calendar },
  internship: { color: 'var(--type-internship)',  Icon: Briefcase },
  deadline:   { color: 'var(--status-warning)',   Icon: Clock },
  practice:   { color: 'var(--type-hackathon)',   Icon: Code },
};

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function NotificationCenter() {
  const { user, role, universityId, branch, gpa, loading } = useAuth();
  const router = useTransitionRouter();
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<AppAlert[]>([]);
  const [unseen, setUnseen] = useState(0);
  // SSR-safe: the panel (which reads this) only renders client-side once opened.
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    () => (typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'),
  );
  const wrapRef = useRef<HTMLDivElement>(null);

  const isStudent = !loading && !!user && role !== 'university_admin' && role !== 'super_admin';
  const uid = user?.uid ?? null;
  const seenKey = uid ? `uniship_notif_seen_${uid}` : '';
  const lastSyncKey = uid ? `uniship_notif_lastsync_${uid}` : '';

  // "Newly posted" — items created since the last visit become a browser toast.
  // The first ever sync only seeds the watermark (so we never blast everything).
  const notifyNewlyPosted = useCallback((list: AppAlert[]) => {
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return;
    const now = Date.now();
    const raw = localStorage.getItem(lastSyncKey);
    if (raw == null) { localStorage.setItem(lastSyncKey, String(now)); return; }
    const lastSync = Number(raw);
    const fresh = list
      .filter((a) => a.createdAt && a.createdAt.getTime() > lastSync && a.relevantUntil.getTime() > now)
      .slice(0, 5);
    for (const a of fresh) {
      try { new Notification(postedTitle(a.category), { body: a.title, icon: '/logo.png', tag: a.key }); } catch {}
    }
    localStorage.setItem(lastSyncKey, String(now));
  }, [lastSyncKey]);

  // Recompute alerts. When markSeen is set (panel opening) the freshly-computed
  // list is recorded as seen and the badge cleared; otherwise the badge counts
  // alerts not yet in the persisted "seen" set.
  const load = useCallback(async (markSeen: boolean) => {
    if (!uid) return;
    const list = await computeAlerts({ uid, universityId, branch, gpa });
    setAlerts(list);
    const now = Date.now();
    if (markSeen) {
      const keys = list.map((a) => a.key);
      try { localStorage.setItem(seenKey, JSON.stringify(keys)); } catch {}
      setUnseen(0);
    } else {
      let seen: Set<string> = new Set();
      try { seen = new Set(JSON.parse(localStorage.getItem(seenKey) || '[]') as string[]); } catch {}
      setUnseen(list.filter((a) => a.relevantUntil.getTime() > now && !seen.has(a.key)).length);
    }
    notifyNewlyPosted(list);
  }, [uid, universityId, branch, gpa, seenKey, notifyNewlyPosted]);

  // Compute on mount / when the student's profile resolves.
  useEffect(() => {
    if (!isStudent) return;
    void (async () => { await load(false); })();
  }, [isStudent, load]);

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (!next) return;
    // Opening: clear the badge immediately against what we already show, then
    // reconcile with a background refresh that also marks the fresh list seen.
    const keys = alerts.map((a) => a.key);
    try { localStorage.setItem(seenKey, JSON.stringify(keys)); } catch {}
    setUnseen(0);
    void load(true);
  };

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const requestPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try { await Notification.requestPermission(); } catch {}
    setPermission(Notification.permission);
    // Seed the watermark so existing items don't all toast at once.
    if (!localStorage.getItem(lastSyncKey)) localStorage.setItem(lastSyncKey, String(Date.now()));
  };

  const openAlert = (a: AppAlert) => {
    setOpen(false);
    if (a.navTarget) router.push(a.navTarget);
  };

  // Group into Today / This week / Later (mirrors the app's sectioning).
  const { today, week, later } = useMemo(() => {
    const now = new Date();
    const weekAhead = new Date(now.getTime() + 7 * 86_400_000);
    const visible = alerts.filter((a) => a.relevantUntil > now);
    const today: AppAlert[] = [], week: AppAlert[] = [], later: AppAlert[] = [];
    for (const a of visible) {
      if (a.when < now || sameDay(a.when, now)) today.push(a);
      else if (a.when < weekAhead) week.push(a);
      else later.push(a);
    }
    return { today, week, later };
  }, [alerts]);

  const total = today.length + week.length + later.length;

  if (!isStudent) return null;

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        onClick={toggleOpen}
        aria-label="Notifications"
        title="Notifications"
        className="relative p-2 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
      >
        <Bell size={19} />
        {unseen > 0 && (
          <span className="absolute top-1 right-1 min-w-[15px] h-[15px] px-1 flex items-center justify-center rounded-full bg-[var(--status-danger)] text-white text-[9px] font-bold leading-none border-[1.5px] border-[var(--bg-canvas)]">
            {unseen > 9 ? '9+' : unseen}
          </span>
        )}
      </button>

      {open && (
        <>
        <div className="popover-scrim backdrop-blur-[3px] z-40" onClick={() => setOpen(false)} aria-hidden="true" />
        <div
          role="region"
          className="fixed top-[60px] right-3 md:right-5 z-50 w-[340px] max-w-[calc(100vw-24px)] rounded-[16px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-[0_20px_60px_-16px_rgba(0,0,0,0.55)] overflow-hidden popover-in"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 px-4 h-12 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[13px] font-semibold text-[var(--text-primary)]">Notifications</span>
              {total > 0 && (
                <span className="px-1.5 h-[17px] inline-flex items-center rounded-full bg-[var(--bg-elevated)] text-[10.5px] font-semibold text-[var(--text-muted)] tabular-nums">
                  {total}
                </span>
              )}
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close notifications" className="p-1 rounded-[8px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors">
              <X size={15} />
            </button>
          </div>

          {/* Browser-reminder affordance (the web analog of the app's reminders toggle) */}
          {permission === 'default' && (
            <button
              onClick={requestPermission}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left border-b border-[var(--border-subtle)] bg-[var(--accent-orange)]/[0.06] hover:bg-[var(--accent-orange)]/10 transition-colors"
            >
              <span className="w-7 h-7 rounded-[9px] flex items-center justify-center shrink-0 bg-[var(--accent-orange)]/15 text-[var(--accent-orange)]">
                <Bell size={14} />
              </span>
              <span className="min-w-0">
                <span className="block text-[12px] font-semibold text-[var(--text-primary)]">Turn on alerts</span>
                <span className="block text-[11px] text-[var(--text-muted)]">Get a browser heads-up when new opportunities are posted.</span>
              </span>
            </button>
          )}

          <div className="max-h-[min(64vh,520px)] overflow-y-auto py-1">
            {total === 0 ? (
              <div className="text-center px-6 py-10">
                <span className="w-11 h-11 mx-auto mb-3 rounded-full flex items-center justify-center bg-[var(--bg-elevated)] text-[var(--text-faint)]">
                  <Bell size={20} />
                </span>
                <p className="text-[13px] font-medium text-[var(--text-primary)]">You&apos;re all caught up</p>
                <p className="text-[11.5px] text-[var(--text-faint)] mt-1 max-w-[240px] mx-auto">Reminders for upcoming tests, events and deadlines will show up here.</p>
              </div>
            ) : (
              <>
                <Section label="Today" items={today} onOpen={openAlert} />
                <Section label="This week" items={week} onOpen={openAlert} />
                <Section label="Later" items={later} onOpen={openAlert} />
              </>
            )}
          </div>
        </div>
        </>
      )}
    </div>
  );
}

function Section({ label, items, onOpen }: { label: string; items: AppAlert[]; onOpen: (a: AppAlert) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="px-1.5">
      <p className="px-2.5 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)]">{label}</p>
      {items.map((a) => <AlertRow key={a.key} alert={a} onOpen={onOpen} />)}
    </div>
  );
}

function AlertRow({ alert, onOpen }: { alert: AppAlert; onOpen: (a: AppAlert) => void }) {
  const { color, Icon } = CATEGORY_STYLE[alert.category];
  return (
    <button
      onClick={() => onOpen(alert)}
      className="w-full flex items-start gap-3 px-2.5 py-2.5 rounded-[10px] text-left hover:bg-[var(--bg-elevated)] transition-colors"
    >
      <span
        className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
        style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
      >
        <Icon size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{alert.title}</span>
          <span className="shrink-0 text-[11px] font-semibold tabular-nums" style={{ color }}>{untilShort(alert.when)}</span>
        </span>
        <span className="mt-0.5 block text-[11.5px] text-[var(--text-muted)] truncate">{alert.subtitle} · {alert.leadLabel} {untilLong(alert.when)}</span>
      </span>
    </button>
  );
}
