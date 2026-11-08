// The single definition of a "live" exam session, shared by the uniadmin
// dashboard and proctoring so their counts cannot drift apart.

export const ACTIVE_HEARTBEAT_WINDOW_MS = 45000;

export interface LiveSessionFields {
  id: string;
  userId?: string;
  userEmail?: string;
  status?: string;
  startedAt?: unknown;
  lastHeartbeat?: unknown;
  isAttempting?: boolean;
}

export const toMillis = (value: unknown): number => {
  if (!value) return 0;
  if (typeof value === 'object' && value !== null) {
    const candidate = value as { toMillis?: () => number; seconds?: number };
    if (typeof candidate.toMillis === 'function') return candidate.toMillis();
    if (typeof candidate.seconds === 'number') return candidate.seconds * 1000;
  }
  const parsed = new Date(value as string | number | Date).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

export const lastSessionActivity = (session: LiveSessionFields): number =>
  Math.max(toMillis(session.lastHeartbeat), toMillis(session.startedAt));

/** Sessions still being attempted, with a heartbeat inside the activity window. */
export function selectActiveAttempts<T extends LiveSessionFields>(sessions: T[], now: number): T[] {
  return sessions.filter((session) => {
    if (session.status !== 'active') return false;
    if (session.isAttempting === false) return false;
    const lastActivity = lastSessionActivity(session);
    if (!lastActivity) return false;
    return (now - lastActivity) <= ACTIVE_HEARTBEAT_WINDOW_MS;
  });
}

/** Keeps each student's most recently active session. */
export function uniqueByStudent<T extends LiveSessionFields>(sessions: T[]): T[] {
  const byUser = new Map<string, T>();
  sessions.forEach((session) => {
    const key = session.userId || session.userEmail || session.id;
    const current = byUser.get(key);
    if (!current || lastSessionActivity(session) >= lastSessionActivity(current)) {
      byUser.set(key, session);
    }
  });
  return Array.from(byUser.values());
}

/** When the next attempting session will age out, so a page can recount then. */
export function nextSessionExpiry<T extends LiveSessionFields>(sessions: T[], now: number): number | undefined {
  return sessions
    .filter((session) => session.status === 'active' && session.isAttempting !== false)
    .map((session) => lastSessionActivity(session) + ACTIVE_HEARTBEAT_WINDOW_MS)
    .filter((expiry) => expiry > now)
    .sort((a, b) => a - b)[0];
}
