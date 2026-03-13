'use client';

import { useState, useEffect, useCallback, useRef, use } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import Editor from '@monaco-editor/react';
import {
  Shield, AlertTriangle, Maximize, Eye, Clock,
  Wifi, CheckCircle2, XCircle, Monitor, Lock,
  MessageCircle, Send, ShieldCheck, MonitorPlay,
  Play, Terminal, Loader2, ChevronDown,
} from 'lucide-react';

// ── Interfaces ──
interface Problem {
  questionDescription: string;
  difficulty?: string;
  correctAnswer?: string;
  expectedOutput?: string;
  sampleTestCases?: Array<{ input: string; output: string }>;
  constraints?: string[];
  hints?: string[];
}
interface TestData {
  sourceFileName: string;
  title?: string;
  duration?: number;
  problems: Problem[];
  universityId: string;
  published: boolean;
  createdAt: string;
}
interface Violation {
  type: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: string;
  message: string;
}

interface ChatMessage {
  id: string;
  sender: 'student' | 'proctor';
  message: string;
  timestamp: string;
}

// ── Constants ──
const MAX_VIOLATIONS = 10;
const HIGH_SEVERITY_LIMIT = 3;
const TAB_AWAY_AUTO_SUBMIT = 30;

// Language ID → Monaco language mapping
const LANG_MONACO: Record<number, string> = {
  71: 'python', 62: 'java', 54: 'cpp', 50: 'c', 63: 'javascript',
  74: 'typescript', 51: 'csharp', 72: 'ruby', 60: 'go', 73: 'rust',
  78: 'kotlin', 76: 'sql', 68: 'php', 85: 'dart',
};

const SEVERITY_CONFIG = {
  low:    { label: 'Low',    color: '#F1A82C', points: 1 },
  medium: { label: 'Medium', color: '#F54E00', points: 2 },
  high:   { label: 'High',   color: '#DC2626', points: 3 },
};

// ── Phase type ──
type Phase = 'loading' | 'preflight' | 'rules' | 'active' | 'frozen' | 'submitted';

export default function TakeTest({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();

  // Core state
  const [test, setTest] = useState<TestData | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [submitReason, setSubmitReason] = useState('');
  const [resultSummary, setResultSummary] = useState<{
    score: number;
    totalQuestions: number;
    attemptedQuestions: number;
    percentage: number;
    mode: 'auto' | 'attempted';
  } | null>(null);

  // Proctoring state
  const [violations, setViolations] = useState<Violation[]>([]);
  const [violationPoints, setViolationPoints] = useState(0);
  const [warningVisible, setWarningVisible] = useState(false);
  const [warningData, setWarningData] = useState<{ message: string; severity: string }>({ message: '', severity: 'low' });
  // Preflight checks
  const [checks, setChecks] = useState({ internet: 'pending' as string, screen: 'pending' as string });

  // Refs
  const submittedRef = useRef(false);
  const violationPointsRef = useRef(0);
  const highViolationsRef = useRef(0);
  const savedThemeRef = useRef<string | null>(null);
  const sessionIdRef = useRef(crypto.randomUUID());
  const screenStreamRef = useRef<MediaStream | null>(null);
  const chatOpenRef = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const tabAwayStartRef = useRef<number | null>(null);
  const tabAwayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Compiler state
  const [selectedLang, setSelectedLang] = useState(71);
  const [codeStdin, setCodeStdin] = useState('');
  const [codeOutput, setCodeOutput] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [compileTime, setCompileTime] = useState<string | null>(null);
  const [compileMemory, setCompileMemory] = useState<string | null>(null);

  // Live support state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [newMsgCount, setNewMsgCount] = useState(0);

  // ── Fetch test data ──
  useEffect(() => {
    async function fetchTestData() {
      try {
        const docSnap = await getDoc(doc(db, 'tests', id));
        if (docSnap.exists()) {
          const data = docSnap.data() as TestData;
          setTest(data);
          if (data.duration) setTimeLeft(data.duration * 60);
        }
      } catch (error) {
        console.error('Error fetching test:', error);
      } finally {
        setPhase('preflight');
      }
    }
    fetchTestData();
  }, [id]);

  // ── Submit handler ──
  const doSubmit = useCallback(async (reason: string) => {
    if (submittedRef.current || !test || !user) return;
    submittedRef.current = true;

    // Stop media
    screenStreamRef.current?.getTracks().forEach(t => t.stop());

    try {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      const normalize = (value: string) => value.trim().replace(/\r\n/g, '\n').replace(/\s+/g, ' ').toLowerCase();
      const attemptedQuestions = Object.keys(answers).filter((k) => (answers[Number(k)] || '').trim().length > 0).length;

      let score = 0;
      let gradable = 0;

      test.problems.forEach((problem, index) => {
        const answer = (answers[index] || '').trim();
        if (!answer) return;

        const expected =
          (problem.correctAnswer || '').trim() ||
          (problem.expectedOutput || '').trim() ||
          (problem.sampleTestCases?.[0]?.output || '').trim();

        if (!expected) return;

        gradable += 1;
        if (normalize(answer) === normalize(expected)) {
          score += 1;
        }
      });

      const mode: 'auto' | 'attempted' = gradable > 0 ? 'auto' : 'attempted';
      const finalScore = mode === 'auto' ? score : attemptedQuestions;
      const totalQuestions = test.problems.length;
      const percentage = totalQuestions > 0 ? Math.round((finalScore / totalQuestions) * 1000) / 10 : 0;

      await addDoc(collection(db, 'test_results'), {
        testId: id,
        testTitle: test.title || test.sourceFileName,
        userId: user.uid,
        userEmail: user.email,
        answers,
        attemptedQuestions,
        score: finalScore,
        totalQuestions: test.problems.length,
        percentage,
        scoringMode: mode,
        submittedAt: serverTimestamp(),
        universityId: test.universityId,
        sessionId: sessionIdRef.current,
        proctoring: {
          totalViolations: violations.length,
          violationPoints: violationPointsRef.current,
          violationLog: violations.map(v => `[${v.severity.toUpperCase()}] ${v.type} — ${v.timestamp}`),
          submitReason: reason,
        },
      });
      setResultSummary({
        score: finalScore,
        totalQuestions,
        attemptedQuestions,
        percentage,
        mode,
      });
      setSubmitReason(reason);
      setPhase('submitted');
      setDoc(doc(db, 'exam_sessions', sessionIdRef.current), { status: 'submitted', submittedAt: new Date().toISOString() }, { merge: true }).catch(() => {});
    } catch (error) {
      console.error('Error submitting test:', error);
      submittedRef.current = false;
    }
  }, [test, user, answers, id, violations]);

  // ── Add violation ──
  const addViolation = useCallback((type: string, severity: 'low' | 'medium' | 'high', userMessage: string) => {
    if (submittedRef.current) return;
    const entry: Violation = { type, severity, timestamp: new Date().toLocaleTimeString(), message: userMessage };
    setViolations(prev => [...prev, entry]);
    const pts = SEVERITY_CONFIG[severity].points;
    violationPointsRef.current += pts;
    setViolationPoints(violationPointsRef.current);

    if (severity === 'high') highViolationsRef.current += 1;

    setWarningData({ message: userMessage, severity });
    setWarningVisible(true);
    setTimeout(() => setWarningVisible(false), 5000);

    // Session freeze on high severity
    if (severity === 'high' && highViolationsRef.current >= HIGH_SEVERITY_LIMIT) {
      setPhase('frozen');
      setTimeout(() => doSubmit('session_frozen'), 5000);
      return;
    }
    if (violationPointsRef.current >= MAX_VIOLATIONS) {
      doSubmit('max_violations');
    }
  }, [doSubmit]);

  // ── Preflight: System Readiness Check ──
  const runPreflight = useCallback(async () => {
    // Internet
    setChecks(c => ({ ...c, internet: 'checking' }));
    try {
      const start = performance.now();
      await fetch('https://www.google.com/favicon.ico', { mode: 'no-cors', cache: 'no-store' });
      const latency = Math.round(performance.now() - start);
      setChecks(c => ({ ...c, internet: latency < 2000 ? 'pass' : 'slow' }));
    } catch {
      setChecks(c => ({ ...c, internet: 'fail' }));
    }

    // Screen sharing
    setChecks(c => ({ ...c, screen: 'checking' }));
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { width: 1920, height: 1080 } });
      screenStreamRef.current = screenStream;
      setChecks(c => ({ ...c, screen: 'pass' }));
    } catch {
      setChecks(c => ({ ...c, screen: 'fail' }));
    }
  }, []);

  useEffect(() => {
    if (phase === 'preflight') runPreflight();
  }, [phase, runPreflight]);

  // ── Timer ──
  useEffect(() => {
    if (phase !== 'active' || timeLeft === null) return;
    if (timeLeft <= 0) { doSubmit('time_up'); return; }
    const t = setInterval(() => setTimeLeft(v => (v !== null ? v - 1 : null)), 1000);
    return () => clearInterval(t);
  }, [phase, timeLeft, doSubmit]);

  // ── Fullscreen enforcement ──
  useEffect(() => {
    if (phase !== 'active') return;
    const handleFS = () => {
      if (!document.fullscreenElement && !submittedRef.current) {
        addViolation('Exited fullscreen', 'medium', 'You exited fullscreen mode. Please remain in fullscreen.');
        document.documentElement.requestFullscreen().catch(() => {});
      }
    };
    document.addEventListener('fullscreenchange', handleFS);
    return () => document.removeEventListener('fullscreenchange', handleFS);
  }, [phase, addViolation]);

  // ── Tab switch / visibility ──
  useEffect(() => {
    if (phase !== 'active') return;
    const handleVis = () => {
      if (document.hidden && !submittedRef.current) {
        addViolation('Tab switch', 'high', 'Tab switching detected. This is a serious integrity violation.');
        // Start timer for tab-away auto-submit
        tabAwayStartRef.current = Date.now();
        tabAwayTimerRef.current = setInterval(() => {
          if (!tabAwayStartRef.current || submittedRef.current) return;
          const awaySeconds = Math.floor((Date.now() - tabAwayStartRef.current) / 1000);
          if (awaySeconds >= TAB_AWAY_AUTO_SUBMIT) {
            doSubmit('tab_away');
          }
        }, 1000);
      } else if (!document.hidden) {
        // Returned to tab - clear timer
        if (tabAwayTimerRef.current) {
          clearInterval(tabAwayTimerRef.current);
          tabAwayTimerRef.current = null;
        }
        if (tabAwayStartRef.current) {
          const awaySeconds = Math.floor((Date.now() - tabAwayStartRef.current) / 1000);
          if (awaySeconds >= 5) {
            addViolation('Extended tab switch', 'high', `You were away from the test for ${awaySeconds} seconds.`);
          }
          tabAwayStartRef.current = null;
        }
      }
    };
    const handleBlur = () => {
      if (!submittedRef.current) {
        addViolation('Window blur', 'medium', 'Window lost focus. Please stay on the test window.');
      }
    };
    document.addEventListener('visibilitychange', handleVis);
    window.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('visibilitychange', handleVis);
      window.removeEventListener('blur', handleBlur);
      if (tabAwayTimerRef.current) { clearInterval(tabAwayTimerRef.current); tabAwayTimerRef.current = null; }
    };
  }, [phase, addViolation, doSubmit]);

  // ── Keyboard / clipboard blocking ──
  useEffect(() => {
    if (phase !== 'active') return;
    const blockEv = (e: Event) => { e.preventDefault(); addViolation(e.type, 'medium', `Attempted ${e.type}. This action is not permitted.`); };
    const blockKeys = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ['c','v','x','a','p','s'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        addViolation(`Shortcut ${e.key}`, 'medium', `Keyboard shortcut blocked: ${e.metaKey ? 'Cmd' : 'Ctrl'}+${e.key.toUpperCase()}`);
      }
      if (['F12','PrintScreen'].includes(e.key)) { e.preventDefault(); addViolation(e.key, 'high', `${e.key} is not allowed during the exam.`); }
      if (e.key === 'Escape') e.preventDefault();
    };
    const events = ['copy','paste','cut','contextmenu'] as const;
    events.forEach(ev => document.addEventListener(ev, blockEv));
    document.addEventListener('keydown', blockKeys);
    return () => { events.forEach(ev => document.removeEventListener(ev, blockEv)); document.removeEventListener('keydown', blockKeys); };
  }, [phase, addViolation]);

  // ── Screen share monitoring ──
  useEffect(() => {
    if (phase !== 'active' || !screenStreamRef.current) return;
    const track = screenStreamRef.current.getVideoTracks()[0];
    if (!track) return;
    const handleEnded = () => {
      if (!submittedRef.current) {
        addViolation('Screen share stopped', 'high', 'Screen sharing was terminated. This is a critical integrity violation.');
      }
    };
    track.addEventListener('ended', handleEnded);
    return () => track.removeEventListener('ended', handleEnded);
  }, [phase, addViolation]);

  // ── Live support chat listener ──
  useEffect(() => {
    if (phase !== 'active' && phase !== 'frozen') return;
    const messagesRef = collection(db, 'exam_sessions', sessionIdRef.current, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const msgs: ChatMessage[] = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage));
      setChatMessages(msgs);
      const newProctor = snapshot.docChanges().filter(c => c.type === 'added' && c.doc.data().sender === 'proctor');
      if (newProctor.length > 0 && !chatOpenRef.current) {
        setNewMsgCount(prev => prev + newProctor.length);
      }
    }, (error) => { console.error('Chat listener error:', error); });
    return () => unsub();
  }, [phase]);

  // ── Auto-scroll chat ──
  useEffect(() => {
    if (chatOpen && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, chatOpen]);

  // ── Restore theme on unmount ──
  useEffect(() => {
    return () => {
      if (savedThemeRef.current !== null) {
        document.documentElement.setAttribute('data-theme', savedThemeRef.current);
      }
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // ── Start test ──
  const startTest = async () => {
    savedThemeRef.current = document.documentElement.getAttribute('data-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', 'light');
    // Create secure exam session
    try {
      await setDoc(doc(db, 'exam_sessions', sessionIdRef.current), {
        testId: id,
        testTitle: test?.title || test?.sourceFileName || 'Unknown',
        universityId: test?.universityId,
        userId: user?.uid,
        userEmail: user?.email,
        startedAt: serverTimestamp(),
        status: 'active',
        browser: navigator.userAgent,
        screenRes: `${screen.width}x${screen.height}`,
      });
    } catch (e) { console.error('Session creation failed:', e); }
    try { await document.documentElement.requestFullscreen(); } catch { /* ok */ }
    setPhase('active');
  };

  // ── Chat functions ──
  const toggleChat = () => {
    setChatOpen(prev => {
      const next = !prev;
      chatOpenRef.current = next;
      if (next) setNewMsgCount(0);
      return next;
    });
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !user) return;
    const msg = chatInput.trim();
    setChatInput('');
    try {
      await addDoc(collection(db, 'exam_sessions', sessionIdRef.current, 'messages'), {
        sender: 'student',
        message: msg,
        timestamp: serverTimestamp(),
        userEmail: user.email,
      });
    } catch (e) { console.error('Failed to send message:', e); }
  };

  // ── Run code against compiler ──
  const runCode = async () => {
    const code = answers[currentQuestion];
    if (!code?.trim() || compiling) return;
    setCompiling(true);
    setCodeOutput(null);
    setCodeError(null);
    setCompileTime(null);
    setCompileMemory(null);
    try {
      const res = await fetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_code: code, language_id: selectedLang, stdin: codeStdin }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setCodeError(data.error || `Server error (${res.status})`);
      } else if (data.status?.id >= 6) {
        // Compilation error, runtime error, etc.
        setCodeError(data.compile_output || data.stderr || data.status?.description || 'Execution failed');
      } else if (data.stderr) {
        setCodeError(data.stderr);
        if (data.stdout) setCodeOutput(data.stdout);
      } else {
        setCodeOutput(data.stdout || '(no output)');
      }
      if (data.time) setCompileTime(data.time);
      if (data.memory) setCompileMemory(`${(data.memory / 1024).toFixed(1)} MB`);
    } catch {
      setCodeError('Failed to connect to compiler');
    } finally {
      setCompiling(false);
    }
  };

  const handleNext = () => { if (test && currentQuestion < test.problems.length - 1) setCurrentQuestion(p => p + 1); };
  const handlePrevious = () => { if (currentQuestion > 0) setCurrentQuestion(p => p - 1); };
  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const allChecksPassed = (checks.internet === 'pass' || checks.internet === 'slow') && checks.screen === 'pass';

  // ─────────── RENDER ───────────

  // Loading
  if (phase === 'loading') return <div className="flex items-center justify-center py-24"><div className="loading-dots"><span /><span /><span /></div></div>;
  if (!test) return <div className="flex items-center justify-center py-24 text-[var(--text-tertiary)]">Test not found.</div>;
  if (!test.problems?.length) return <div className="flex items-center justify-center py-24 text-[var(--text-tertiary)]">No problems found.</div>;

  // ── Submitted screen ──
  if (phase === 'submitted') {
    const wasForced = submitReason !== 'manual';
    return (
      <div className="fixed inset-0 z-[9999] bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 ${wasForced ? 'bg-[#DC2626]/10' : 'bg-[#4CAF50]/10'}`}>
            {wasForced ? <AlertTriangle size={28} className="text-[#DC2626]" /> : <CheckCircle2 size={28} className="text-[#4CAF50]" />}
          </div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] mb-2">
            {wasForced ? 'Test Auto-Submitted' : 'Test Submitted Successfully'}
          </h1>
          <p className="text-[var(--text-tertiary)] text-[13px] mb-1">
            {submitReason === 'max_violations' && 'Your test was terminated due to excessive integrity violations.'}
            {submitReason === 'session_frozen' && 'Your session was frozen and auto-submitted due to a critical security breach.'}
            {submitReason === 'time_up' && 'Time expired. Your answers have been saved.'}
            {submitReason === 'tab_away' && 'Your test was auto-submitted because you left the test tab for over 30 seconds.'}
            {submitReason === 'manual' && 'Your answers have been saved successfully.'}
          </p>
          {violations.length > 0 && (
            <p className="text-[var(--text-faint)] text-[12px] mb-6">
              Integrity report: {violations.length} violation{violations.length > 1 ? 's' : ''} recorded ({violationPoints} severity points)
            </p>
          )}

          {resultSummary && (
            <div className="mb-6 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 text-left">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)] mb-2">Exam Result</p>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[var(--text-tertiary)]">Score</span>
                <span className="text-[14px] font-bold text-[var(--text-primary)] tabular-nums">
                  {resultSummary.score} / {resultSummary.totalQuestions}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[13px] text-[var(--text-tertiary)]">Percentage</span>
                <span className="text-[14px] font-bold text-[#4CAF50] tabular-nums">{resultSummary.percentage}%</span>
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[13px] text-[var(--text-tertiary)]">Attempted</span>
                <span className="text-[13px] text-[var(--text-primary)] tabular-nums">
                  {resultSummary.attemptedQuestions} / {resultSummary.totalQuestions}
                </span>
              </div>
              {resultSummary.mode === 'attempted' && (
                <p className="text-[11px] text-[var(--text-faint)] mt-2">
                  Note: This exam uses coding-style answers without explicit answer keys, so the score reflects attempted questions.
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-center gap-3">
            <button onClick={() => router.push('/user/results')} className="btn-primary px-6 py-2.5 text-[13px]">
              View Results
            </button>
            <button onClick={() => router.push('/user/dashboard')} className="btn-secondary px-6 py-2.5 text-[13px]">
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Frozen screen ──
  if (phase === 'frozen') {
    return (
      <div className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-20 h-20 rounded-full bg-[#DC2626]/20 flex items-center justify-center mx-auto mb-5 animate-pulse">
            <Lock size={32} className="text-[#DC2626]" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Session Paused — Security Review</h1>
          <p className="text-white/60 text-[13px] mb-1">
            This session has been paused due to a critical security breach.
          </p>
          <p className="text-white/40 text-[12px]">Your test will be auto-submitted in a few seconds.</p>
        </div>
      </div>
    );
  }

  // ── Preflight: System Readiness ──
  if (phase === 'preflight') {
    const CheckRow = ({ label, icon: Icon, status }: { label: string; icon: typeof Monitor; status: string }) => (
      <div className="flex items-center justify-between py-3 border-b border-[var(--border-subtle)] last:border-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center">
            <Icon size={15} className="text-[var(--text-faint)]" />
          </div>
          <span className="text-[13px] font-medium text-[var(--text-primary)]">{label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {status === 'pending' && <span className="text-[11px] text-[var(--text-faint)]">Waiting...</span>}
          {status === 'checking' && <div className="loading-dots" style={{ transform: 'scale(0.5)' }}><span /><span /><span /></div>}
          {status === 'pass' && <><CheckCircle2 size={14} className="text-[#4CAF50]" /><span className="text-[11px] font-bold text-[#4CAF50]">Ready</span></>}
          {status === 'slow' && <><AlertTriangle size={14} className="text-[#F1A82C]" /><span className="text-[11px] font-bold text-[#F1A82C]">Slow</span></>}
          {status === 'fail' && <><XCircle size={14} className="text-[#DC2626]" /><span className="text-[11px] font-bold text-[#DC2626]">Failed</span></>}
        </div>
      </div>
    );

    return (
      <div className="max-w-lg mx-auto animate-fade-in py-12">
        <div className="window p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-[#5E6AD2]/10 flex items-center justify-center">
              <Monitor size={20} className="text-[#5E6AD2]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[var(--text-primary)]">System Readiness Check</h1>
              <p className="text-[var(--text-tertiary)] text-[12px]">Verifying your hardware before the exam</p>
            </div>
          </div>

          {/* Checklist */}
          <div className="mb-6">
            <CheckRow label="Internet Connection" icon={Wifi} status={checks.internet} />
            <CheckRow label="Screen Sharing" icon={MonitorPlay} status={checks.screen} />
          </div>

          {/* Security indicators */}
          <div className="bg-[#4CAF50]/5 border border-[#4CAF50]/20 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck size={14} className="text-[#4CAF50]" />
              <span className="text-[11px] font-bold text-[#4CAF50] uppercase tracking-wider">Secure Connection</span>
            </div>
            <div className="space-y-1.5 text-[11px] text-[var(--text-tertiary)]">
              <div className="flex items-center gap-2">
                <Lock size={10} className="text-[var(--text-faint)]" />
                <span>SSL/TLS encrypted connection active</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield size={10} className="text-[var(--text-faint)]" />
                <span>Session: <span className="font-mono text-[var(--text-primary)]">{sessionIdRef.current.slice(0, 8)}</span></span>
              </div>
            </div>
          </div>

          {checks.screen === 'fail' && (
            <p className="text-[12px] text-[#DC2626] mb-4">Screen sharing denied. Please allow screen sharing and reload the page.</p>
          )}

          <button
            onClick={() => setPhase('rules')}
            disabled={!allChecksPassed}
            className="btn-primary w-full py-3 text-[13px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <CheckCircle2 size={14} />
            {allChecksPassed ? 'Continue to Exam Rules' : 'Waiting for all checks...'}
          </button>
        </div>
      </div>
    );
  }

  // ── Rules screen ──
  if (phase === 'rules') {
    return (
      <div className="max-w-lg mx-auto animate-fade-in py-12">
        <div className="window p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-[#F54E00]/10 flex items-center justify-center">
              <Shield size={20} className="text-[#F54E00]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[var(--text-primary)]">{test.title || test.sourceFileName}</h1>
              <p className="text-[var(--text-tertiary)] text-[12px]">Proctored Assessment — Read carefully</p>
            </div>
          </div>

          <div className="flex items-center gap-4 mb-6 text-[13px] text-[var(--text-secondary)]">
            <span className="flex items-center gap-1.5"><Eye size={14} className="text-[var(--text-faint)]" /> {test.problems.length} questions</span>
            {test.duration && <span className="flex items-center gap-1.5"><Clock size={14} className="text-[var(--text-faint)]" /> {test.duration} min</span>}
          </div>

          <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg p-5 mb-5">
            <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-widest mb-4">Monitoring & Enforcement</p>
            <div className="space-y-3 text-[12px] text-[var(--text-tertiary)]">
              <div className="flex items-start gap-2.5">
                <Maximize size={13} className="text-[#F54E00] mt-0.5 shrink-0" />
                <span>The test runs in <strong className="text-[var(--text-primary)]">fullscreen</strong>. Exiting fullscreen triggers a violation.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Monitor size={13} className="text-[#F54E00] mt-0.5 shrink-0" />
                <span><strong className="text-[var(--text-primary)]">Tab switching</strong>, copy-paste, right-click, and keyboard shortcuts are blocked and logged.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <MonitorPlay size={13} className="text-[#F54E00] mt-0.5 shrink-0" />
                <span>Your <strong className="text-[var(--text-primary)]">screen is being recorded</strong> and monitored. Stopping screen share triggers a violation.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <MessageCircle size={13} className="text-[#F54E00] mt-0.5 shrink-0" />
                <span><strong className="text-[var(--text-primary)]">Live support</strong> is available during the exam via the chat button.</span>
              </div>
            </div>
          </div>

          <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg p-5 mb-6">
            <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-widest mb-3">Violation Severity</p>
            <div className="space-y-2">
              {[
                { level: 'Low', color: '#F1A82C', desc: 'Ambient noise, minor disruption', action: '1 point' },
                { level: 'Medium', color: '#F54E00', desc: 'Fullscreen exit, copy/paste attempt, window blur', action: '2 points' },
                { level: 'High', color: '#DC2626', desc: 'Tab switching, unauthorized key, screen share stopped', action: '3 points — session freeze after 3' },
              ].map(v => (
                <div key={v.level} className="flex items-center gap-3 text-[11px]">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: v.color }} />
                  <span className="font-bold text-[var(--text-primary)] w-14">{v.level}</span>
                  <span className="text-[var(--text-tertiary)] flex-1">{v.desc}</span>
                  <span className="text-[var(--text-faint)] font-medium">{v.action}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-[var(--text-faint)] mt-3">Auto-submit at {MAX_VIOLATIONS} total points. {HIGH_SEVERITY_LIMIT} high-severity violations will freeze and terminate. {TAB_AWAY_AUTO_SUBMIT}s on another tab will auto-submit.</p>
          </div>

          <button onClick={startTest} className="btn-primary w-full py-3 text-[13px] font-semibold flex items-center justify-center gap-2">
            <Lock size={14} />
            I Understand — Enter Secure Exam
          </button>
        </div>
      </div>
    );
  }

  // ── Active test ──
  const problem = test.problems[currentQuestion];

  return (
    <div className="fixed inset-0 z-[9999] bg-[var(--bg-primary)] overflow-y-auto animate-fade-in select-none" style={{ userSelect: 'none' }}>
      {/* Warning toast */}
      {warningVisible && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[9999] max-w-md w-full px-4">
          <div className="rounded-lg shadow-lg border px-4 py-3 flex items-start gap-3 text-[13px]" style={{
            background: `${SEVERITY_CONFIG[warningData.severity as keyof typeof SEVERITY_CONFIG]?.color || '#F54E00'}15`,
            borderColor: `${SEVERITY_CONFIG[warningData.severity as keyof typeof SEVERITY_CONFIG]?.color || '#F54E00'}30`,
          }}>
            <AlertTriangle size={16} className="shrink-0 mt-0.5" style={{ color: SEVERITY_CONFIG[warningData.severity as keyof typeof SEVERITY_CONFIG]?.color }} />
            <div>
              <p className="font-semibold text-[var(--text-primary)] text-[12px]">
                {SEVERITY_CONFIG[warningData.severity as keyof typeof SEVERITY_CONFIG]?.label} Severity Violation
              </p>
              <p className="text-[var(--text-tertiary)] text-[11px] mt-0.5">{warningData.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Top proctoring bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-[var(--bg-primary)]/95 backdrop-blur border-b border-[var(--border-subtle)] px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-[#4CAF50]/10 px-2 py-0.5 rounded">
              <Shield size={11} className="text-[#4CAF50]" />
              <span className="text-[10px] font-bold text-[#4CAF50] uppercase tracking-wider">Secure Environment Active</span>
            </div>
            <span className="w-px h-4 bg-[var(--border-subtle)] hidden sm:block" />
            <span className="text-[11px] text-[var(--text-faint)] hidden sm:block">Monitoring Enabled</span>
            <span className="w-px h-4 bg-[var(--border-subtle)] hidden sm:block" />
            <div className="hidden sm:flex items-center gap-1 text-[10px] text-[#4CAF50]">
              <Lock size={9} />
              <span>SSL</span>
            </div>
            <div className="hidden sm:flex items-center gap-1 text-[10px] text-[#4CAF50]">
              <MonitorPlay size={9} />
              <span>Screen</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="w-px h-4 bg-[var(--border-subtle)]" />
            {/* Violations */}
            {violations.length > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-bold text-[#F54E00]">
                <AlertTriangle size={11} />
                {violationPoints}/{MAX_VIOLATIONS}
              </span>
            )}
            {/* Timer */}
            {timeLeft !== null && (
              <span className={`flex items-center gap-1 text-[12px] font-bold tabular-nums ${timeLeft <= 60 ? 'text-[#DC2626] animate-pulse' : timeLeft <= 300 ? 'text-[#F54E00]' : 'text-[var(--text-primary)]'}`}>
                <Clock size={12} />
                {formatTime(timeLeft)}
              </span>
            )}
            <span className="w-px h-4 bg-[var(--border-subtle)]" />
            {/* Live Support */}
            <button onClick={toggleChat} className="relative flex items-center gap-1 text-[11px] font-bold text-[#5E6AD2] hover:text-[#4C5ABF] transition-colors">
              <MessageCircle size={12} />
              <span className="hidden sm:inline">Support</span>
              {newMsgCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#DC2626] text-white text-[8px] font-bold flex items-center justify-center">
                  {newMsgCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Live Support Chat Panel */}
      {chatOpen && (
        <div className="fixed top-11 right-4 z-[10000] w-80 h-96 rounded-lg border border-[var(--border-subtle)] shadow-xl bg-[var(--bg-primary)] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
            <div className="flex items-center gap-2">
              <MessageCircle size={14} className="text-[#5E6AD2]" />
              <span className="text-[12px] font-bold text-[var(--text-primary)]">Live Support</span>
            </div>
            <button onClick={toggleChat} className="text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors">
              <XCircle size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {chatMessages.length === 0 && (
              <div className="text-center py-8">
                <MessageCircle size={20} className="mx-auto text-[var(--text-faint)] mb-2" />
                <p className="text-[11px] text-[var(--text-faint)]">Need help? Send a message to the proctor.</p>
              </div>
            )}
            {chatMessages.map(msg => (
              <div key={msg.id} className={`flex ${msg.sender === 'student' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-3 py-1.5 rounded-lg text-[12px] ${
                  msg.sender === 'student'
                    ? 'bg-[#5E6AD2] text-white rounded-br-none'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-bl-none'
                }`}>
                  {msg.message}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="border-t border-[var(--border-subtle)] p-2 flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
              placeholder="Type a message..."
              className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded px-3 py-1.5 text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[#5E6AD2]"
            />
            <button onClick={sendChatMessage} disabled={!chatInput.trim()} className="p-1.5 rounded bg-[#5E6AD2] text-white disabled:opacity-40 transition-opacity">
              <Send size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="max-w-4xl mx-auto pt-14 pb-8 px-4">
        <div className="mb-5 flex items-center justify-between">
          <p className="text-[var(--text-tertiary)] text-[13px]">
            Question {currentQuestion + 1} of {test.problems.length}
          </p>
          <span className="text-[11px] text-[var(--text-faint)]">
            {Object.keys(answers).length}/{test.problems.length} answered
          </span>
        </div>

        <div className="window p-6 sm:p-8 mb-5">
          <div className="flex justify-between items-start mb-5">
            <span className="inline-block bg-[#F54E00] text-white px-2.5 py-0.5 text-[11px] font-bold uppercase rounded">
              {problem.difficulty || 'Problem'} {currentQuestion + 1}
            </span>
          </div>
          
          <h2 className="text-base font-medium mb-5 leading-relaxed text-[var(--text-primary)]">
            {problem.questionDescription}
          </h2>
          
          {problem.sampleTestCases && problem.sampleTestCases.length > 0 && (
            <div className="mt-5 space-y-2">
              <p className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Sample Test Case:</p>
              <pre className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-4 rounded text-sm text-[#4CAF50] overflow-x-auto font-mono">
                <div className="mb-2"><span className="text-[var(--text-faint)]">Input:</span> {problem.sampleTestCases[0].input}</div>
                <div><span className="text-[var(--text-faint)]">Output:</span> {problem.sampleTestCases[0].output}</div>
              </pre>
            </div>
          )}

          {problem.constraints && problem.constraints.length > 0 && (
            <div className="mt-5">
              <p className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2">Constraints:</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                {problem.constraints.map((c, i) => <li key={i} className="text-[var(--text-tertiary)]">{c}</li>)}
              </ul>
            </div>
          )}

          {problem.hints && problem.hints.length > 0 && (
            <div className="mt-5">
              <p className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2">Hints:</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                {problem.hints.map((h, i) => <li key={i} className="text-[var(--text-tertiary)]">{h}</li>)}
              </ul>
            </div>
          )}
        </div>

        {/* Answer */}
        <div className="window p-5 mb-5">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold text-[var(--text-primary)]">Your Solution:</label>
            <div className="flex items-center gap-2">
              <div className="relative">
                <select
                  value={selectedLang}
                  onChange={e => setSelectedLang(Number(e.target.value))}
                  className="appearance-none bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded px-3 py-1.5 pr-7 text-[12px] text-[var(--text-primary)] font-medium focus:outline-none focus:border-[#5E6AD2] cursor-pointer"
                >
                  <option value={71}>Python 3</option>
                  <option value={62}>Java</option>
                  <option value={54}>C++</option>
                  <option value={50}>C</option>
                  <option value={63}>JavaScript</option>
                  <option value={74}>TypeScript</option>
                  <option value={51}>C#</option>
                  <option value={72}>Ruby</option>
                  <option value={60}>Go</option>
                  <option value={73}>Rust</option>
                  <option value={78}>Kotlin</option>
                  <option value={76}>SQL</option>
                  <option value={68}>PHP</option>
                  <option value={85}>Dart</option>
                </select>
                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-faint)] pointer-events-none" />
              </div>
              <button
                onClick={runCode}
                disabled={!answers[currentQuestion]?.trim() || compiling}
                className="flex items-center gap-1.5 bg-[#4CAF50] hover:bg-[#43A047] text-white px-3 py-1.5 rounded text-[12px] font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {compiling ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                {compiling ? 'Running...' : 'Run Code'}
              </button>
            </div>
          </div>
          <div className="rounded-lg overflow-hidden border border-[var(--border-subtle)]">
            <Editor
              height="280px"
              language={LANG_MONACO[selectedLang] || 'plaintext'}
              theme="vs-dark"
              value={answers[currentQuestion] || ''}
              onChange={(val) => setAnswers({ ...answers, [currentQuestion]: val || '' })}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 4,
                wordWrap: 'on',
                padding: { top: 12 },
                renderLineHighlight: 'line',
                cursorBlinking: 'smooth',
                smoothScrolling: true,
                contextmenu: false,
                domReadOnly: false,
              }}
            />
          </div>
          <p className="text-xs text-[var(--text-faint)] mt-2">{answers[currentQuestion] ? 'Answer saved' : 'No answer provided yet'}</p>

          {/* Stdin input */}
          <div className="mt-3">
            <label className="block text-[11px] font-bold text-[var(--text-faint)] uppercase tracking-widest mb-1.5">Input (stdin)</label>
            <textarea
              value={codeStdin}
              onChange={e => setCodeStdin(e.target.value)}
              placeholder="Optional: provide input for your program..."
              className="w-full h-16 p-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded font-mono text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:border-[#5E6AD2] focus:outline-none transition-colors resize-none"
            />
          </div>

          {/* Output terminal */}
          {(codeOutput !== null || codeError !== null || compiling) && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Terminal size={12} className="text-[var(--text-faint)]" />
                  <span className="text-[11px] font-bold text-[var(--text-faint)] uppercase tracking-widest">Output</span>
                </div>
                {compileTime && (
                  <div className="flex items-center gap-3 text-[10px] text-[var(--text-faint)]">
                    <span>Time: {compileTime}s</span>
                    {compileMemory && <span>Memory: {compileMemory}</span>}
                  </div>
                )}
              </div>
              <div className="bg-[#0D1117] border border-[var(--border-subtle)] rounded p-4 min-h-[60px] max-h-48 overflow-auto">
                {compiling ? (
                  <div className="flex items-center gap-2 text-[var(--text-faint)] text-[12px]">
                    <Loader2 size={14} className="animate-spin" />
                    <span>Compiling and executing...</span>
                  </div>
                ) : codeError ? (
                  <pre className="text-[#F87171] text-[12px] font-mono whitespace-pre-wrap">{codeError}</pre>
                ) : (
                  <pre className="text-[#4ADE80] text-[12px] font-mono whitespace-pre-wrap">{codeOutput}</pre>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between border-t border-[var(--border-subtle)] pt-5">
          <button disabled={currentQuestion === 0} onClick={handlePrevious} className="btn-secondary px-5 py-2.5 text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed">
            ← Previous
          </button>
          <div className="flex gap-3">
            <button onClick={() => {
              if (window.confirm(`Submit test? You have answered ${Object.keys(answers).length} of ${test.problems.length} questions.`)) {
                doSubmit('manual');
              }
            }} className="btn-secondary px-5 py-2.5 text-sm font-medium text-[#DC2626] border-[#DC2626]/30 hover:bg-[#DC2626]/10">
              Submit Test
            </button>
            {currentQuestion < test.problems.length - 1 && (
              <button onClick={handleNext} className="btn-primary px-6 py-2.5 text-sm font-semibold">Next →</button>
            )}
          </div>
        </div>

        {/* Question grid */}
        <div className="mt-6 window p-5 mb-8">
          <h3 className="text-sm font-semibold mb-3">Question Status:</h3>
          <div className="flex flex-wrap gap-2">
            {test.problems.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentQuestion(idx)}
                className={`w-9 h-9 rounded text-xs font-bold transition-all ${
                  idx === currentQuestion ? 'bg-[#F54E00] text-white'
                  : answers[idx] ? 'bg-[#4CAF50] text-white'
                  : 'bg-[var(--border-subtle)] text-[var(--text-tertiary)] hover:bg-[var(--border-active)]'
                }`}
              >
                {idx + 1}
              </button>
            ))}
          </div>
          <p className="text-xs text-[var(--text-faint)] mt-3 tabular-nums">
            Answered: {Object.keys(answers).length} / {test.problems.length}
          </p>
        </div>
      </div>
    </div>
  );
}