'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
  doc, getDoc, collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, updateDoc, getDocs, limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Shield, Eye, Clock, AlertTriangle, MessageCircle, Send,
  Monitor, CheckCircle2, RefreshCw,
  MonitorPlay, ShieldCheck, RotateCcw, Calendar, LogIn, X,
  Flag, Bell,
} from '@/components/icons';
import { ListSkeleton } from '@/components/Skeleton';
import { StatBar } from '@/components/StatBar';
import { Modal, ModalHeader, ModalBody } from '@/components/Modal';

interface ExamSession {
  id: string;
  testId: string;
  testTitle: string;
  userId: string;
  userEmail: string;
  universityId: string;
  status: 'active' | 'submitted';
  startedAt: unknown;
  lastHeartbeat?: unknown;
  isAttempting?: boolean;
  browser?: string;
  screenRes?: string;
}

interface ChatMessage {
  id: string;
  sender: 'student' | 'proctor';
  message: string;
  timestamp: unknown;
  userEmail?: string;
}

interface TestResult {
  id: string;
  testId: string;
  testTitle: string;
  userId: string;
  userEmail: string;
  sessionId: string;
  attemptedQuestions: number;
  totalQuestions: number;
  submittedAt: unknown;
  flagged?: boolean;
  reattemptAllowed?: boolean;
  proctoring: {
    totalViolations: number;
    violationPoints: number;
    violationLog: string[];
    submitReason: string;
    flagReasonKeywords?: string[];
  };
}

interface StudentInfo {
  name?: string;
  rollNumber?: string;
  email?: string;
}

interface UpcomingTest {
  id: string;
  title: string;
  category: string;
  duration: number;
  totalQuestions: number;
  examStart: string;
  examEnd: string;
}

const ACTIVE_HEARTBEAT_WINDOW_MS = 45000;
const VIOLATION_SUBMIT_REASONS = new Set(['max_violations', 'session_frozen', 'tab_away', 'esc_pressed']);

const toMillis = (value: unknown): number => {
  if (!value) return 0;
  if (typeof value === 'object' && value !== null) {
    const candidate = value as { toMillis?: () => number; seconds?: number };
    if (typeof candidate.toMillis === 'function') return candidate.toMillis();
    if (typeof candidate.seconds === 'number') return candidate.seconds * 1000;
  }
  const parsed = new Date(value as string | number | Date).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const isViolationSubmitReason = (reason?: string) => Boolean(reason && VIOLATION_SUBMIT_REASONS.has(reason));

const getSubmitReasonLabel = (reason?: string): string => {
  switch (reason) {
    case 'max_violations': return 'Max Violations';
    case 'session_frozen': return 'Session Frozen';
    case 'time_up': return 'Time Up';
    case 'face_away': return 'Face Away';
    case 'tab_away': return 'Tab Away';
    case 'esc_pressed': return 'ESC pressed';
    case 'admin_forced': return 'Admin forced auto submit';
    default: return 'Auto';
  }
};

const normalizeFlagKeyword = (raw: string): string => {
  const key = raw.trim().toLowerCase();
  if (!key) return '';
  if (key.includes('esc')) return 'ESC pressed';
  if (key.includes('screen share')) return 'screen share stopped';
  if (key.includes('tab')) return 'tab switch';
  if (key.includes('window blur')) return 'window blur';
  if (key.includes('fullscreen')) return 'fullscreen exited';
  return raw.trim();
};

const parseViolationLogKeyword = (log: string): string => {
  const match = log.match(/\]\s*(.*?)\s*—/);
  return normalizeFlagKeyword(match?.[1] || log);
};

// Shared popup action buttons (consistent across the submissions + flagged lists).
const reassignBtn = 'inline-flex items-center gap-1.5 text-[10.5px] font-semibold px-3 py-1.5 rounded-[8px] bg-[var(--accent-orange)]/10 text-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/20 transition-colors disabled:opacity-40';
const reassignedBtn = 'inline-flex items-center gap-1.5 text-[10.5px] font-semibold px-3 py-1.5 rounded-[8px] bg-[var(--status-success)]/10 text-[var(--status-success)] border border-[var(--status-success)]/20 transition-colors disabled:opacity-40';
const dangerActionBtn = 'inline-flex items-center gap-1.5 text-[10.5px] font-semibold px-3 py-1.5 rounded-[8px] bg-[var(--status-danger)]/10 text-[var(--status-danger)] hover:bg-[var(--status-danger)]/20 transition-colors disabled:opacity-40';

export default function ProctorDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [universityId, setUniversityId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ExamSession | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [recentResults, setRecentResults] = useState<TestResult[]>([]);
  const [reattemptLoading, setReattemptLoading] = useState<string | null>(null);
  const [autoSubmitLoading, setAutoSubmitLoading] = useState<string | null>(null);
  const [upcomingTests, setUpcomingTests] = useState<UpcomingTest[]>([]);
  const [activeTestId, setActiveTestId] = useState<string | null>(null);
  const [studentInfoMap, setStudentInfoMap] = useState<Record<string, StudentInfo>>({});
  const [statsPopup, setStatsPopup] = useState<'live' | 'submissions' | 'flagged' | null>(null);
  const [unreadSessions, setUnreadSessions] = useState<Set<string>>(new Set());
  const [chatNotification, setChatNotification] = useState<{ sessionId: string; email: string; message: string } | null>(null);
  const [actionPopup, setActionPopup] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [sessionLastMessage, setSessionLastMessage] = useState<Record<string, number>>({});
  const [nowMs, setNowMs] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const notificationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionPopupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isProctoringMode = Boolean(activeTestId);
  const activeSelectedSession = useMemo(() => {
    if (!selectedSession || !activeTestId) return null;
    const session = sessions.find(s => s.id === selectedSession.id);
    if (!session) return null;
    if (activeTestId && session.testId !== activeTestId) return null;
    return session;
  }, [selectedSession, sessions, activeTestId]);

  // Get admin's universityId
  useEffect(() => {
    if (!authLoading && !user) { router.push('/'); return; }
    if (!user) return;
    (async () => {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        setUniversityId(userDoc.data().universityId);
      }
    })();
  }, [user, authLoading, router]);

  // Listen to active exam sessions for this university
  useEffect(() => {
    if (!universityId) return;
    const q = query(
      collection(db, 'exam_sessions'),
      where('universityId', '==', universityId),
      where('status', '==', 'active'),
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ExamSession));
      setSessions(data);
    });
    return () => unsub();
  }, [universityId]);

  // Fetch recent submitted results
  useEffect(() => {
    if (!universityId) return;
    const q = query(
      collection(db, 'test_results'),
      where('universityId', '==', universityId),
      orderBy('submittedAt', 'desc'),
      limit(100),
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const results = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as TestResult));
      setRecentResults(results);

      const flaggedUserIds = [
        ...new Set(
          results
            .filter(r => r.flagged)
            .map(r => r.userId)
        )
      ];
      if (flaggedUserIds.length === 0) {
        setStudentInfoMap({});
        return;
      }

      void (async () => {
        const infoMap: Record<string, StudentInfo> = {};
        await Promise.all(flaggedUserIds.map(async (uid) => {
          try {
            const userDoc = await getDoc(doc(db, 'users', uid));
            if (userDoc.exists()) {
              const data = userDoc.data();
              infoMap[uid] = { name: data.name || data.displayName, rollNumber: data.rollNumber, email: data.email };
            }
          } catch { /* skip */ }
        }));
        setStudentInfoMap(infoMap);
      })();
    }, () => { /* index may be missing */ });
    return () => unsub();
  }, [universityId]);

  // Fetch tests starting within the next 24 hours
  useEffect(() => {
    if (!universityId) return;
    (async () => {
      try {
        const q = query(
          collection(db, 'tests'),
          where('universityId', '==', universityId),
        );
        const snap = await getDocs(q);
        const now = new Date();
        const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const upcoming = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as UpcomingTest))
          .filter(t => {
            if (!t.examStart) return false;
            const start = new Date(t.examStart);
            const end = t.examEnd ? new Date(t.examEnd) : start;
            // Show if exam hasn't ended yet and starts within 24 hours
            return end >= now && start <= in24h;
          })
          .sort((a, b) => new Date(a.examStart).getTime() - new Date(b.examStart).getTime());
        setUpcomingTests(upcoming);
      } catch { /* index may be missing */ }
    })();
  }, [universityId]);

  // Listen to chat messages for selected session
  useEffect(() => {
    if (!activeSelectedSession) return;
    const q = query(
      collection(db, 'exam_sessions', activeSelectedSession.id, 'messages'),
      orderBy('timestamp', 'asc'),
    );
    const unsub = onSnapshot(q, (snapshot) => {
      setChatMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage)));
    });
    return () => unsub();
  }, [activeSelectedSession]);

  // Listen for new student messages across ALL active sessions (for notifications)
  useEffect(() => {
    if (sessions.length === 0) return;
    const now = Date.now();
    const activeSessions = sessions.filter((session) => {
      if (session.status !== 'active') return false;
      if (session.isAttempting === false) return false;
      const lastActivity = Math.max(toMillis(session.lastHeartbeat), toMillis(session.startedAt));
      if (!lastActivity) return false;
      return (now - lastActivity) <= ACTIVE_HEARTBEAT_WINDOW_MS;
    });
    const byUser = new Map<string, ExamSession>();
    activeSessions.forEach((session) => {
      const key = session.userId || session.userEmail || session.id;
      const current = byUser.get(key);
      if (!current) {
        byUser.set(key, session);
        return;
      }
      const currentActivity = Math.max(toMillis(current.lastHeartbeat), toMillis(current.startedAt));
      const nextActivity = Math.max(toMillis(session.lastHeartbeat), toMillis(session.startedAt));
      if (nextActivity >= currentActivity) {
        byUser.set(key, session);
      }
    });
    const scopedSessions = Array.from(byUser.values());
    if (scopedSessions.length === 0) return;

    const unsubscribers: (() => void)[] = [];
    scopedSessions.forEach(session => {
      const q = query(
        collection(db, 'exam_sessions', session.id, 'messages'),
        orderBy('timestamp', 'desc'),
      );
      const unsub = onSnapshot(q, (snapshot) => {
        const newStudentMsgs = snapshot.docChanges().filter(
          c => c.type === 'added' && c.doc.data().sender === 'student'
        );
        if (newStudentMsgs.length > 0) {
          const latestMsg = newStudentMsgs[0].doc.data();
          // Update last message timestamp for sorting
          setSessionLastMessage(prev => ({
            ...prev,
            [session.id]: Date.now(),
          }));
          // Only notify if not currently viewing this session
          if (!activeSelectedSession || activeSelectedSession.id !== session.id) {
            setUnreadSessions(prev => new Set(prev).add(session.id));
            // Show popup notification
            if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
            setChatNotification({
              sessionId: session.id,
              email: session.userEmail,
              message: latestMsg.message,
            });
            notificationTimeoutRef.current = setTimeout(() => setChatNotification(null), 5000);
          }
        }
      });
      unsubscribers.push(unsub);
    });
    return () => unsubscribers.forEach(u => u());
  }, [sessions, activeSelectedSession]);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const sendMessage = async () => {
    if (!chatInput.trim() || !activeSelectedSession || !user) return;
    const msg = chatInput.trim();
    setChatInput('');
    await addDoc(collection(db, 'exam_sessions', activeSelectedSession.id, 'messages'), {
      sender: 'proctor',
      senderId: user.uid,
      message: msg,
      timestamp: serverTimestamp(),
      userEmail: user.email,
    });
  };

  const showActionPopup = useCallback((type: 'success' | 'error', message: string) => {
    if (actionPopupTimeoutRef.current) clearTimeout(actionPopupTimeoutRef.current);
    setActionPopup({ type, message });
    actionPopupTimeoutRef.current = setTimeout(() => setActionPopup(null), 4000);
  }, []);

  const getStudentDisplayName = useCallback((result: TestResult) => {
    const mapped = studentInfoMap[result.userId]?.name?.trim();
    if (mapped) return mapped;
    const emailName = result.userEmail?.split('@')?.[0]?.trim();
    if (emailName) return emailName;
    return 'this student';
  }, [studentInfoMap]);

  const selectSession = useCallback((session: ExamSession) => {
    setSelectedSession(session);
    setUnreadSessions(prev => {
      const next = new Set(prev);
      next.delete(session.id);
      return next;
    });
  }, []);

  // Allow re-attempt: mark the test_result so the student can take the test again
  const allowReattempt = async (result: TestResult) => {
    setReattemptLoading(result.id);
    const studentName = getStudentDisplayName(result);
    try {
      const attemptQuery = query(
        collection(db, 'test_results'),
        where('userId', '==', result.userId),
        where('testId', '==', result.testId),
      );
      const attemptsSnap = await getDocs(attemptQuery);
      if (attemptsSnap.empty) {
        showActionPopup('error', `No attempts found for ${studentName}.`);
        setReattemptLoading(null);
        return;
      }

      await Promise.all(attemptsSnap.docs.map((attemptDoc) => updateDoc(doc(db, 'test_results', attemptDoc.id), {
        reattemptAllowed: true,
        reattemptUpdatedAt: serverTimestamp(),
        reattemptUpdatedBy: user?.uid || null,
      })));

      setRecentResults(prev => prev.map(r => (
        (r.userId === result.userId && r.testId === result.testId)
          ? { ...r, reattemptAllowed: true }
          : r
      )));
      showActionPopup('success', `Test reassigned for ${studentName}.`);
    } catch (e) {
      console.error('Failed to allow reattempt:', e);
      showActionPopup('error', `Failed to reassign test for ${studentName}.`);
    }
    setReattemptLoading(null);
  };

  // Revoke re-attempt: set reattemptAllowed back to false
  const revokeReattempt = async (result: TestResult) => {
    setReattemptLoading(result.id);
    const studentName = getStudentDisplayName(result);
    try {
      const attemptQuery = query(
        collection(db, 'test_results'),
        where('userId', '==', result.userId),
        where('testId', '==', result.testId),
      );
      const attemptsSnap = await getDocs(attemptQuery);
      if (attemptsSnap.empty) {
        showActionPopup('error', `No attempts found for ${studentName}.`);
        setReattemptLoading(null);
        return;
      }

      await Promise.all(attemptsSnap.docs.map((attemptDoc) => updateDoc(doc(db, 'test_results', attemptDoc.id), {
        reattemptAllowed: false,
        reattemptUpdatedAt: serverTimestamp(),
        reattemptUpdatedBy: user?.uid || null,
      })));

      setRecentResults(prev => prev.map(r => (
        (r.userId === result.userId && r.testId === result.testId)
          ? { ...r, reattemptAllowed: false }
          : r
      )));
      showActionPopup('success', `Reassignment revoked for ${studentName}.`);
    } catch (e) {
      console.error('Failed to revoke reattempt:', e);
      showActionPopup('error', `Failed to revoke reassignment for ${studentName}.`);
    }
    setReattemptLoading(null);
  };

  const autoSubmitStudent = async (result: TestResult) => {
    setAutoSubmitLoading(result.id);
    const studentName = getStudentDisplayName(result);
    try {
      const attemptQuery = query(
        collection(db, 'test_results'),
        where('userId', '==', result.userId),
        where('testId', '==', result.testId),
      );
      const attemptsSnap = await getDocs(attemptQuery);

      const targetSessions = sessions.filter(
        (session) => session.status === 'active' && session.userId === result.userId && session.testId === result.testId
      );
      if (targetSessions.length === 0) {
        showActionPopup('error', `No active attempt found for ${studentName}.`);
        setAutoSubmitLoading(null);
        return;
      }

      await Promise.all(targetSessions.map((session) => updateDoc(doc(db, 'exam_sessions', session.id), {
        status: 'submitted',
        submittedAt: serverTimestamp(),
        lastHeartbeat: serverTimestamp(),
        isAttempting: false,
        flagged: true,
        submitReason: 'admin_forced',
        flagReasonKeywords: ['admin forced auto submit'],
      })));

      if (!attemptsSnap.empty) {
        await Promise.all(attemptsSnap.docs.map((attemptDoc) => updateDoc(doc(db, 'test_results', attemptDoc.id), {
          reattemptAllowed: false,
          autoSubmittedAt: serverTimestamp(),
          autoSubmittedBy: user?.uid || null,
        })));
      }

      setRecentResults(prev => prev.map(r => (
        (r.userId === result.userId && r.testId === result.testId)
          ? { ...r, reattemptAllowed: false }
          : r
      )));

      showActionPopup('success', `Test auto-submitted for ${studentName}.`);
    } catch (e) {
      console.error('Failed to auto-submit student session:', e);
      showActionPopup('error', `Failed to auto-submit test for ${studentName}.`);
    }
    setAutoSubmitLoading(null);
  };

  const formatTime = (ts: unknown) => {
    if (!ts) return '—';
    const d = (typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof (ts as { toDate?: () => Date }).toDate === 'function')
      ? (ts as { toDate: () => Date }).toDate()
      : new Date(ts as string | number | Date);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const activeAttemptSessions = useMemo(() => {
    return sessions.filter((session) => {
      if (session.status !== 'active') return false;
      if (session.isAttempting === false) return false;
      if (nowMs === 0) return true;
      const lastActivity = Math.max(toMillis(session.lastHeartbeat), toMillis(session.startedAt));
      if (!lastActivity) return false;
      return (nowMs - lastActivity) <= ACTIVE_HEARTBEAT_WINDOW_MS;
    });
  }, [sessions, nowMs]);

  const uniqueActiveSessions = useMemo(() => {
    const byUser = new Map<string, ExamSession>();
    activeAttemptSessions.forEach((session) => {
      const key = session.userId || session.userEmail || session.id;
      const current = byUser.get(key);
      if (!current) {
        byUser.set(key, session);
        return;
      }
      const currentActivity = Math.max(toMillis(current.lastHeartbeat), toMillis(current.startedAt));
      const nextActivity = Math.max(toMillis(session.lastHeartbeat), toMillis(session.startedAt));
      if (nextActivity >= currentActivity) {
        byUser.set(key, session);
      }
    });
    return Array.from(byUser.values());
  }, [activeAttemptSessions]);

  const filteredSessions = useMemo(() => {
    const scoped = (isProctoringMode && activeTestId)
      ? uniqueActiveSessions.filter(s => s.testId === activeTestId)
      : [];
    return scoped.sort((a, b) => {
      const aUnread = unreadSessions.has(a.id) ? 1 : 0;
      const bUnread = unreadSessions.has(b.id) ? 1 : 0;
      if (aUnread !== bUnread) return bUnread - aUnread;
      const aTime = sessionLastMessage[a.id] || Math.max(toMillis(a.lastHeartbeat), toMillis(a.startedAt));
      const bTime = sessionLastMessage[b.id] || Math.max(toMillis(b.lastHeartbeat), toMillis(b.startedAt));
      return bTime - aTime;
    });
  }, [isProctoringMode, activeTestId, uniqueActiveSessions, unreadSessions, sessionLastMessage]);

  // Deduplicate flagged results: one entry per user+test, keeping the LATEST submission
  const flaggedResults = useMemo(() => {
    const flagged = recentResults.filter(r => r.flagged);
    const byUserTest = new Map<string, TestResult>();
    flagged.forEach(r => {
      const key = `${r.userId}__${r.testId}`;
      const existing = byUserTest.get(key);
      if (!existing || toMillis(r.submittedAt) > toMillis(existing.submittedAt)) {
        byUserTest.set(key, r);
      }
    });
    return Array.from(byUserTest.values());
  }, [recentResults]);

  // Check the LATEST result (flagged or not) for a user+test to determine reattempt state.
  // This ensures a new submission always resets the button to "Reassign Test".
  const isReattemptAllowed = useCallback((userId: string, testId: string): boolean => {
    const allForUserTest = recentResults.filter(
      r => r.userId === userId && r.testId === testId
    );
    if (allForUserTest.length === 0) return false;
    const latest = allForUserTest.reduce((a, b) =>
      toMillis(b.submittedAt) > toMillis(a.submittedAt) ? b : a
    );
    return latest.reattemptAllowed === true;
  }, [recentResults]);

  const getFlagReasonKeywords = useCallback((result: TestResult): string[] => {
    // Collect keywords from ALL attempts for this user+test, not just the latest
    const allResultsForUserTest = recentResults.filter(
      r => r.userId === result.userId && r.testId === result.testId && r.flagged
    );
    const allKeywords = new Set<string>();
    allResultsForUserTest.forEach(r => {
      (r.proctoring?.flagReasonKeywords || []).map(normalizeFlagKeyword).filter(Boolean).forEach(k => allKeywords.add(k));
      if (r.proctoring?.submitReason) {
        const k = normalizeFlagKeyword(getSubmitReasonLabel(r.proctoring.submitReason));
        if (k) allKeywords.add(k);
      }
      (r.proctoring?.violationLog || []).map(parseViolationLogKeyword).filter(Boolean).forEach(k => allKeywords.add(k));
    });
    if (allKeywords.size > 0) return [...allKeywords];
    const fromSubmitReason = result.proctoring?.submitReason
      ? normalizeFlagKeyword(getSubmitReasonLabel(result.proctoring?.submitReason))
      : '';
    const fromLog = (result.proctoring?.violationLog || []).map(parseViolationLogKeyword).filter(Boolean);
    return [...new Set([fromSubmitReason, ...fromLog].filter(Boolean))];
  }, [recentResults]);

  if (authLoading || !universityId) {
    return <ListSkeleton withStats statCount={3} rows={5} />;
  }

  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in">
      {/* Chat notification popup */}
      {chatNotification && (
        <div className="fixed top-4 right-4 z-50 max-w-sm animate-fade-in">
          <button
            type="button"
            onClick={() => {
              const session = uniqueActiveSessions.find(s => s.id === chatNotification.sessionId);
              if (session) {
                setActiveTestId(session.testId);
                selectSession(session);
              }
              setChatNotification(null);
            }}
            className="w-full text-left bg-[var(--bg-primary)] border border-[var(--type-event)]/40 rounded-[var(--radius)] shadow-lg p-4 hover:border-[var(--type-event)] transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[var(--type-event)]/10 flex items-center justify-center shrink-0 mt-0.5">
                <Bell size={14} className="text-[var(--type-event)]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[11px] font-semibold text-[var(--type-event)]">New Message</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setChatNotification(null); }}
                    className="text-[var(--text-faint)] hover:text-[var(--text-primary)]"
                  >
                    <X size={12} />
                  </button>
                </div>
                <p className="text-[12px] font-semibold text-[var(--text-primary)] truncate">{chatNotification.email}</p>
                <p className="text-[11px] text-[var(--text-tertiary)] truncate mt-0.5">{chatNotification.message}</p>
              </div>
            </div>
          </button>
        </div>
      )}
      {actionPopup && (
        <div className="fixed top-4 right-4 z-[140] max-w-sm animate-fade-in">
          <div className={`w-full text-left rounded-[var(--radius)] shadow-lg p-4 border ${
            actionPopup.type === 'success'
              ? 'bg-green-50 border-green-300 dark:bg-[#0B2E1A] dark:border-[var(--status-success)]/40'
              : 'bg-red-50 border-red-300 dark:bg-[#2C1212] dark:border-[var(--status-danger)]/40'
          }`}>
            <p className={`text-[12px] font-semibold ${
              actionPopup.type === 'success' ? 'text-green-700 dark:text-[#8DE2AA]' : 'text-red-700 dark:text-[#FCA5A5]'
            }`}>
              {actionPopup.message}
            </p>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="pt-8 mb-7">
        <h1 className="text-[26px] font-semibold text-[var(--text-primary)] tracking-[-0.025em]">Proctoring</h1>
        <p className="text-[var(--text-tertiary)] text-[13.5px] mt-1.5">Monitor live exams, respond to student queries, and manage submissions.</p>
      </div>

      {/* Upcoming tests within 24h */}
      {upcomingTests.length > 0 && (
        <div className="window mb-6 overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-[var(--type-event)]" />
              <span className="text-[12px] font-semibold text-[var(--text-primary)]">Upcoming in 24 Hours</span>
            </div>
            <span className="text-[10px] text-[var(--text-faint)]">{upcomingTests.length} test{upcomingTests.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="divide-y divide-[var(--border-subtle)]">
            {upcomingTests.map(test => {
              const start = new Date(test.examStart);
              const end = test.examEnd ? new Date(test.examEnd) : null;
              const now = new Date();
              const isLive = start <= now && (!end || end >= now);
              const diffMs = start.getTime() - now.getTime();
              const diffH = Math.floor(diffMs / 3600000);
              const diffM = Math.floor((diffMs % 3600000) / 60000);
              return (
                <div key={test.id} className="px-4 py-3 flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0 ${
                    isLive ? 'bg-[var(--status-success)]/10' : 'bg-[var(--type-event)]/10'
                  }`}>
                    {isLive ? <Monitor size={14} className="text-[var(--status-success)]" /> : <Clock size={14} className="text-[var(--type-event)]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-semibold text-[var(--text-primary)] truncate">{test.title}</span>
                      {isLive ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-[var(--status-success)] bg-[var(--status-success)]/10 px-1.5 py-0.5 rounded-full shrink-0">
                          <div className="w-1 h-1 rounded-full bg-[var(--status-success)] animate-pulse" />
                          LIVE NOW
                        </span>
                      ) : (
                        <span className="text-[9px] font-semibold text-[var(--type-event)] bg-[var(--type-event)]/10 px-1.5 py-0.5 rounded-full shrink-0">
                          {diffH > 0 ? `in ${diffH}h ${diffM}m` : `in ${diffM}m`}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[var(--text-faint)]">
                      <span>{test.category}</span>
                      <span className="w-px h-3 bg-[var(--border-subtle)]" />
                      <span>{test.duration}min</span>
                      <span className="w-px h-3 bg-[var(--border-subtle)]" />
                      <span>{test.totalQuestions}Q</span>
                      <span className="w-px h-3 bg-[var(--border-subtle)]" />
                      <span>{start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {end ? end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                    </div>
                  </div>
                  {isLive && (
                    <button
                      type="button"
                      onClick={() => { setActiveTestId(test.id); setSelectedSession(null); }}
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[11px] font-semibold transition-colors ${
                        activeTestId === test.id
                          ? 'bg-[var(--status-success)] text-white'
                          : 'bg-[var(--status-success)]/10 text-[var(--status-success)] hover:bg-[var(--status-success)]/20'
                      }`}
                    >
                      <LogIn size={12} />
                      {activeTestId === test.id ? 'Proctoring' : 'Enter Proctoring'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats — clickable hairline bar (matches every other uniadmin page) */}
      <StatBar
        className="mb-6"
        items={[
          {
            label: 'live sessions',
            value: filteredSessions.length,
            icon: Monitor,
            iconAccent: 'text-[var(--status-success)]',
            accent: filteredSessions.length > 0 ? 'text-[var(--status-success)]' : undefined,
            onClick: () => setStatsPopup('live'),
            disabled: !isProctoringMode,
          },
          {
            label: 'submissions',
            value: recentResults.length,
            icon: CheckCircle2,
            iconAccent: 'text-[var(--accent-orange)]',
            onClick: () => setStatsPopup('submissions'),
          },
          {
            label: 'flagged',
            value: flaggedResults.length,
            icon: AlertTriangle,
            iconAccent: 'text-[var(--status-danger)]',
            accent: flaggedResults.length > 0 ? 'text-[var(--status-danger)]' : undefined,
            onClick: () => setStatsPopup('flagged'),
          },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 h-[calc(100vh-330px)] min-h-[520px]">
        {/* Left: Live sessions list */}
        <div className={`rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex-col overflow-hidden ${activeSelectedSession ? 'hidden lg:flex' : 'flex'}`}>
          <div className="px-4 h-14 border-b border-[var(--border-subtle)] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[var(--status-success)] animate-pulse" />
              <span className="text-[13px] font-semibold text-[var(--text-primary)]">Live Sessions</span>
            </div>
            <span className="text-[11px] text-[var(--text-faint)]">{isProctoringMode ? `${filteredSessions.length} active` : 'Idle'}</span>
          </div>

          {/* Active test filter banner */}
          {activeTestId && (
            <div className="px-4 py-2 bg-[var(--status-success)]/5 border-b border-[var(--status-success)]/20 flex items-center justify-between shrink-0">
              <span className="text-[10.5px] font-medium text-[var(--status-success)] truncate">
                Filtering: {upcomingTests.find(t => t.id === activeTestId)?.title || 'Selected Test'}
              </span>
              <button onClick={() => setActiveTestId(null)} className="text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors shrink-0 ml-2">
                <X size={12} />
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {!isProctoringMode ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <Shield size={26} className="text-[var(--text-faint)] mb-3" />
                <p className="text-[12.5px] font-medium text-[var(--text-primary)]">Not in proctoring mode</p>
                <p className="text-[11.5px] text-[var(--text-faint)] mt-1">Use an “Enter Proctoring” button from a live test above to monitor students.</p>
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <Monitor size={26} className="text-[var(--text-faint)] mb-3" />
                <p className="text-[12.5px] font-medium text-[var(--text-primary)]">{activeTestId ? 'No students yet' : 'No active sessions'}</p>
                <p className="text-[11.5px] text-[var(--text-faint)] mt-1">Sessions appear here in real time as students begin.</p>
              </div>
            ) : (
              filteredSessions.map(session => {
                const active = activeSelectedSession?.id === session.id;
                const unread = unreadSessions.has(session.id);
                return (
                  <button
                    key={session.id}
                    onClick={() => selectSession(session)}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 text-left border-b border-[var(--border-subtle)] last:border-b-0 border-l-2 transition-colors ${
                      active ? 'bg-[var(--bg-elevated)] border-l-[var(--type-event)]' : 'border-l-transparent hover:bg-[var(--bg-elevated)]'
                    }`}
                  >
                    <span className="w-9 h-9 rounded-full bg-[var(--type-event)]/15 text-[var(--type-event)] flex items-center justify-center text-[14px] font-bold shrink-0 uppercase">
                      {session.userEmail?.[0] ?? 'S'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{session.userEmail}</span>
                        <span className="text-[10px] text-[var(--text-faint)] shrink-0">{formatTime(session.startedAt)}</span>
                      </span>
                      <span className="flex items-center gap-2 mt-1">
                        <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-[var(--status-success)] bg-[var(--status-success)]/10 px-1.5 py-0.5 rounded-full shrink-0">
                          <span className="w-1 h-1 rounded-full bg-[var(--status-success)] animate-pulse" />
                          LIVE
                        </span>
                        <span className="text-[11px] text-[var(--text-tertiary)] truncate">{session.testTitle}</span>
                        {unread && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-[var(--type-event)] bg-[var(--type-event)]/10 px-1.5 py-0.5 rounded-full shrink-0 ml-auto">
                            <MessageCircle size={9} /> New
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Chat / Session detail */}
        <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-col min-h-0 overflow-hidden">
          {activeSelectedSession ? (
            <>
              {/* Session header */}
              <div className="px-4 py-3 border-b border-[var(--border-subtle)] shrink-0">
                <div className="flex items-center gap-3">
                  <button onClick={() => setSelectedSession(null)} className="lg:hidden text-[var(--type-event)] shrink-0" title="Back">←</button>
                  <span className="w-9 h-9 rounded-full bg-[var(--type-event)]/15 text-[var(--type-event)] flex items-center justify-center text-[14px] font-bold shrink-0 uppercase">
                    {activeSelectedSession.userEmail?.[0] ?? 'S'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13.5px] font-semibold text-[var(--text-primary)] truncate">{activeSelectedSession.userEmail}</span>
                      <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-[var(--status-success)] bg-[var(--status-success)]/10 px-2 py-0.5 rounded-full shrink-0">
                        <span className="w-1 h-1 rounded-full bg-[var(--status-success)] animate-pulse" />
                        LIVE
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--text-tertiary)] truncate mt-0.5">{activeSelectedSession.testTitle}</p>
                  </div>
                  <button onClick={() => setSelectedSession(null)} className="hidden lg:flex w-8 h-8 rounded-[8px] items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors shrink-0">
                    <X size={16} />
                  </button>
                </div>
                {/* Session details */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[10px] text-[var(--text-faint)]">
                  <span className="flex items-center gap-1"><Clock size={9} /> Started {formatTime(activeSelectedSession.startedAt)}</span>
                  {activeSelectedSession.browser && (
                    <span className="flex items-center gap-1"><Monitor size={9} /> {activeSelectedSession.browser.slice(0, 40)}…</span>
                  )}
                  {activeSelectedSession.screenRes && (
                    <span className="flex items-center gap-1"><MonitorPlay size={9} /> {activeSelectedSession.screenRes}</span>
                  )}
                </div>
              </div>

              {/* Chat messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2.5 min-h-0">
                <div className="text-center py-2">
                  <div className="inline-flex items-center gap-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-full px-3 py-1">
                    <ShieldCheck size={11} className="text-[var(--status-success)]" />
                    <span className="text-[10px] text-[var(--text-faint)]">Secure session — messages are between proctor and student only</span>
                  </div>
                </div>

                {chatMessages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.sender === 'proctor' ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[75%]">
                      <div className={`px-3 py-2 rounded-[12px] text-[13px] ${
                        msg.sender === 'proctor'
                          ? 'bg-[var(--type-event)] text-white rounded-br-[3px]'
                          : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-bl-[3px]'
                      }`}>
                        {msg.message}
                      </div>
                      <p className={`text-[9px] mt-0.5 ${msg.sender === 'proctor' ? 'text-right' : ''} text-[var(--text-faint)]`}>
                        {msg.sender === 'proctor' ? 'You' : activeSelectedSession.userEmail.split('@')[0]} · {formatTime(msg.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-[var(--border-subtle)] p-3 flex gap-2 shrink-0">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Reply to student…"
                  className="flex-1 px-3.5 py-2.5 text-[13px]"
                />
                <button
                  onClick={sendMessage}
                  disabled={!chatInput.trim()}
                  className="px-4 py-2.5 rounded-[var(--radius)] bg-[var(--type-event)] text-white text-[13px] font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center gap-2 shrink-0"
                >
                  <Send size={14} />
                  Send
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <div className="w-14 h-14 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center mb-4">
                <MessageCircle size={24} className="text-[var(--text-faint)]" />
              </div>
              <h2 className="text-[15px] font-semibold text-[var(--text-primary)] mb-1">Select a session</h2>
              <p className="text-[12px] text-[var(--text-tertiary)] leading-relaxed max-w-xs">
                {isProctoringMode
                  ? 'Pick an active session on the left to view details and chat with the student in real time.'
                  : 'Enter proctoring mode from a live test to view active student sessions.'}
              </p>
              <div className="mt-6 grid grid-cols-3 gap-3 w-full max-w-sm">
                <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[8px] p-3 text-center">
                  <MessageCircle size={16} className="mx-auto text-[var(--type-event)] mb-1" />
                  <p className="text-[10px] text-[var(--text-faint)]">Reply to queries</p>
                </div>
                <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[8px] p-3 text-center">
                  <Eye size={16} className="mx-auto text-[var(--status-success)] mb-1" />
                  <p className="text-[10px] text-[var(--text-faint)]">Monitor sessions</p>
                </div>
                <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[8px] p-3 text-center">
                  <RotateCcw size={16} className="mx-auto text-[var(--accent-orange)] mb-1" />
                  <p className="text-[10px] text-[var(--text-faint)]">Allow re-attempts</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Stat popups (shared Modal shell — consistent margins everywhere) ── */}
      <Modal open={!!statsPopup} onClose={() => setStatsPopup(null)} size={statsPopup === 'flagged' ? 'lg' : 'md'}>
        {/* ── Live Sessions ── */}
        {statsPopup === 'live' && (
          <>
            <ModalHeader
              icon={Monitor}
              iconClass="text-[var(--status-success)]"
              iconWrapClass="bg-[var(--status-success)]/10"
              title="Live Sessions"
              subtitle={`${filteredSessions.length} active session${filteredSessions.length !== 1 ? 's' : ''}`}
              onClose={() => setStatsPopup(null)}
            />
            <ModalBody flush>
              {!isProctoringMode ? (
                <div className="flex flex-col items-center justify-center text-center px-6 py-16">
                  <Shield size={30} className="text-[var(--text-faint)] mb-3" />
                  <p className="text-[13px] font-medium text-[var(--text-primary)]">Not in proctoring mode</p>
                  <p className="text-[11.5px] text-[var(--text-faint)] mt-1">Pick a live test and click “Enter Proctoring”.</p>
                </div>
              ) : filteredSessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center px-6 py-16">
                  <Monitor size={30} className="text-[var(--text-faint)] mb-3" />
                  <p className="text-[13px] font-medium text-[var(--text-primary)]">No active sessions</p>
                  <p className="text-[11.5px] text-[var(--text-faint)] mt-1">Sessions appear here when students start tests.</p>
                </div>
              ) : (
                filteredSessions.map(session => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => { selectSession(session); setStatsPopup(null); }}
                    className="w-full flex items-center gap-3 px-5 py-3.5 text-left border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-elevated)] transition-colors"
                  >
                    <span className="w-9 h-9 rounded-full bg-[var(--type-event)]/15 text-[var(--type-event)] flex items-center justify-center text-[14px] font-bold shrink-0 uppercase">
                      {session.userEmail?.[0] ?? 'S'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{session.userEmail}</span>
                        <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-[var(--status-success)] bg-[var(--status-success)]/10 px-1.5 py-0.5 rounded-full shrink-0">
                          <span className="w-1 h-1 rounded-full bg-[var(--status-success)] animate-pulse" /> LIVE
                        </span>
                      </span>
                      <span className="flex items-center gap-2 mt-1 text-[10.5px] text-[var(--text-tertiary)]">
                        <span className="truncate">{session.testTitle}</span>
                        <span className="text-[var(--text-faint)] shrink-0">· {formatTime(session.startedAt)}</span>
                        {unreadSessions.has(session.id) && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-[var(--type-event)] bg-[var(--type-event)]/10 px-1.5 py-0.5 rounded-full shrink-0 ml-auto">
                            <MessageCircle size={9} /> New
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </ModalBody>
          </>
        )}

        {/* ── Recent Submissions ── */}
        {statsPopup === 'submissions' && (
          <>
            <ModalHeader
              icon={CheckCircle2}
              iconClass="text-[var(--accent-orange)]"
              iconWrapClass="bg-[var(--accent-orange)]/10"
              title="Recent Submissions"
              subtitle={`${recentResults.length} total submission${recentResults.length !== 1 ? 's' : ''}`}
              onClose={() => setStatsPopup(null)}
            />
            <ModalBody flush>
              {recentResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center px-6 py-16">
                  <CheckCircle2 size={30} className="text-[var(--text-faint)] mb-3" />
                  <p className="text-[13px] font-medium text-[var(--text-primary)]">No submissions yet</p>
                </div>
              ) : (
                recentResults.map(result => {
                  const wasForced = result.proctoring?.submitReason !== 'manual';
                  const allowed = isReattemptAllowed(result.userId, result.testId);
                  return (
                    <div key={result.id} className="px-5 py-3.5 border-b border-[var(--border-subtle)] last:border-b-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{result.userEmail}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          {wasForced && (
                            <span className="text-[9.5px] font-semibold text-[var(--status-danger)] bg-[var(--status-danger)]/10 px-2 py-0.5 rounded-full uppercase tracking-[0.05em]">
                              {getSubmitReasonLabel(result.proctoring?.submitReason)}
                            </span>
                          )}
                          {result.flagged && <Flag size={11} className="text-[var(--status-danger)]" />}
                        </div>
                      </div>
                      <p className="text-[11px] text-[var(--text-tertiary)] truncate">{result.testTitle}</p>
                      <div className="flex items-center justify-between gap-2 mt-2.5">
                        <div className="flex items-center gap-2 text-[10.5px] text-[var(--text-muted)]">
                          <span>{result.attemptedQuestions}/{result.totalQuestions} answered</span>
                          {result.proctoring?.totalViolations > 0 && (
                            <>
                              <span className="w-px h-3 bg-[var(--border-subtle)]" />
                              <span className="text-[var(--status-warning)]">{result.proctoring.violationPoints} pts</span>
                            </>
                          )}
                        </div>
                        {!allowed ? (
                          <button onClick={() => allowReattempt(result)} disabled={reattemptLoading === result.id} className={reassignBtn}>
                            <RefreshCw size={10} className={reattemptLoading === result.id ? 'animate-spin' : ''} />
                            Reassign Test
                          </button>
                        ) : (
                          <button onClick={() => revokeReattempt(result)} disabled={reattemptLoading === result.id} className={reassignedBtn}>
                            <CheckCircle2 size={10} className={reattemptLoading === result.id ? 'animate-spin' : ''} />
                            Reassigned
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </ModalBody>
          </>
        )}

        {/* ── Flagged Students ── */}
        {statsPopup === 'flagged' && (
          <>
            <ModalHeader
              icon={Flag}
              iconClass="text-[var(--status-danger)]"
              iconWrapClass="bg-[var(--status-danger)]/10 border border-[var(--status-danger)]/20"
              title="Flagged Students"
              subtitle={`${flaggedResults.length} flagged account${flaggedResults.length !== 1 ? 's' : ''}`}
              onClose={() => setStatsPopup(null)}
            />
            <ModalBody className="space-y-3">
              {flaggedResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center px-6 py-16">
                  <CheckCircle2 size={30} className="text-[var(--status-success)] mb-3" />
                  <p className="text-[13px] font-medium text-[var(--text-primary)]">No flagged students</p>
                  <p className="text-[11.5px] text-[var(--text-faint)] mt-1">Students auto-submitted due to violations appear here.</p>
                </div>
              ) : (
                flaggedResults.map(result => {
                  const info = studentInfoMap[result.userId];
                  const reasonKeywords = getFlagReasonKeywords(result);
                  const allAttempts = recentResults.filter(
                    r => r.userId === result.userId && r.testId === result.testId && r.flagged
                  );
                  const totalViolationPts = allAttempts.reduce((s, r) => s + (r.proctoring?.violationPoints || 0), 0);
                  const totalViolationCount = allAttempts.reduce((s, r) => s + (r.proctoring?.totalViolations || 0), 0);
                  const allLogs = allAttempts.flatMap(r => r.proctoring?.violationLog || []);
                  const allowed = isReattemptAllowed(result.userId, result.testId);
                  return (
                    <div
                      key={`${result.userId}-${result.testId}`}
                      className="rounded-[12px] border border-[var(--status-danger)]/25 bg-[var(--status-danger)]/[0.04] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-[8px] bg-[var(--status-danger)]/10 border border-[var(--status-danger)]/20 flex items-center justify-center shrink-0">
                            <Flag size={15} className="text-[var(--status-danger)]" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13.5px] font-semibold text-[var(--text-primary)] truncate">{info?.name || result.userEmail.split('@')[0]}</p>
                            <p className="text-[11.5px] text-[var(--text-tertiary)] truncate">
                              {result.userEmail}{info?.rollNumber ? ` · ${info.rollNumber}` : ''}
                            </p>
                          </div>
                        </div>
                        <span className="text-[9.5px] font-semibold text-[var(--status-danger)] bg-[var(--status-danger)]/10 px-2 py-0.5 rounded-full uppercase tracking-[0.07em] shrink-0">
                          {getSubmitReasonLabel(result.proctoring?.submitReason)}
                        </span>
                      </div>
                      <p className="text-[11.5px] text-[var(--text-tertiary)] truncate mt-2.5">{result.testTitle}</p>
                      {reasonKeywords.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                          {reasonKeywords.map((keyword) => (
                            <span key={`${result.userId}-${result.testId}-${keyword}`} className="text-[10.5px] font-medium text-[var(--status-danger)] bg-[var(--status-danger)]/10 px-2 py-0.5 rounded-full">
                              {keyword}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-2.5 text-[11px] text-[var(--text-tertiary)]">
                        <span>{result.attemptedQuestions}/{result.totalQuestions} answered</span>
                        {totalViolationCount > 0 && (
                          <>
                            <span className="w-px h-3 bg-[var(--border-subtle)]" />
                            <span className="text-[var(--status-danger)]">{totalViolationPts} violation pts</span>
                            <span className="w-px h-3 bg-[var(--border-subtle)]" />
                            <span>{totalViolationCount} violations</span>
                          </>
                        )}
                      </div>
                      {allLogs.length > 0 && (
                        <details className="mt-3">
                          <summary className="text-[10.5px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.07em] cursor-pointer hover:text-[var(--text-primary)] select-none">
                            Violation log ({allLogs.length})
                          </summary>
                          <div className="mt-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[10px] p-3 max-h-36 overflow-y-auto">
                            {allLogs.map((log, i) => (
                              <p key={i} className="text-[11px] text-[var(--text-tertiary)] font-mono leading-relaxed">{log}</p>
                            ))}
                          </div>
                        </details>
                      )}
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border-subtle)]">
                        {!allowed ? (
                          <button onClick={() => allowReattempt(result)} disabled={reattemptLoading === result.id} className={reassignBtn}>
                            <RefreshCw size={10} className={reattemptLoading === result.id ? 'animate-spin' : ''} />
                            Reassign Test
                          </button>
                        ) : (
                          <button onClick={() => revokeReattempt(result)} disabled={reattemptLoading === result.id} className={reassignedBtn}>
                            <CheckCircle2 size={10} className={reattemptLoading === result.id ? 'animate-spin' : ''} />
                            Reassigned
                          </button>
                        )}
                        <button onClick={() => autoSubmitStudent(result)} disabled={autoSubmitLoading === result.id} className={dangerActionBtn}>
                          <AlertTriangle size={10} className={autoSubmitLoading === result.id ? 'animate-pulse' : ''} />
                          Auto Submit
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </ModalBody>
          </>
        )}
      </Modal>
    </div>
  );
}
