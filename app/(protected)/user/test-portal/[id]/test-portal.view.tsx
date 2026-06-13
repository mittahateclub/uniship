'use client';

import { useState, useEffect, useCallback, useRef, use } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, setDoc, getDocs, where, updateDoc } from 'firebase/firestore';
import { authHeaders } from '@/lib/auth-client';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import Editor from '@monaco-editor/react';
import {
  Shield, AlertTriangle, Maximize, Eye, Clock,
  Wifi, CheckCircle2, XCircle, Monitor, Lock,
  MessageCircle, Send, ShieldCheck, MonitorPlay,
  Play, Terminal, Loader2, ChevronDown,
} from '@/components/icons';

// ── Interfaces ──
interface Problem {
  questionDescription: string;
  difficulty?: string;
  topic?: string;
  correctAnswer?: string;
  expectedOutput?: string;
  sampleTestCases?: Array<{ input: string; output: string }>;
  hiddenTestCases?: Array<{ input: string; output: string }>;
  constraints?: string[];
  hints?: string[];
  functionName?: string;
  inputType?: string;
  outputType?: string;
  options?: string[];
}

interface Section {
  type: 'aptitude' | 'mcq' | 'coding';
  title: string;
  questions: Problem[];
}

interface FlatQuestion extends Problem {
  _sectionType: 'aptitude' | 'mcq' | 'coding';
  _sectionTitle: string;
  _sectionIndex: number;
  _originalIndex: number; // index within its section
}

interface TestData {
  sourceFileName: string;
  title?: string;
  duration?: number;
  problems: Problem[];
  sections?: Section[];
  universityId: string;
  published: boolean;
  createdAt: string;
  sourceType?: string;
}

type QuestionVerdict = 'AC' | 'WA' | 'TLE' | 'CE' | 'RE' | 'UNGRADED' | 'UNANSWERED';
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
const HEARTBEAT_INTERVAL_MS = 10000;

type SubmitReason = 'manual' | 'time_up' | 'max_violations' | 'session_frozen' | 'tab_away' | 'esc_pressed';
const VIOLATION_SUBMIT_REASONS = new Set<SubmitReason>(['max_violations', 'session_frozen', 'tab_away', 'esc_pressed']);

const isViolationSubmitReason = (reason: SubmitReason) => VIOLATION_SUBMIT_REASONS.has(reason);

const getSubmitReasonKeyword = (reason: SubmitReason): string => {
  switch (reason) {
    case 'max_violations': return 'max violations reached';
    case 'session_frozen': return 'session frozen';
    case 'tab_away': return 'tab away';
    case 'esc_pressed': return 'ESC pressed';
    default: return '';
  }
};

const normalizeViolationKeyword = (raw: string): string => {
  const key = raw.trim().toLowerCase();
  if (!key) return '';
  if (key.includes('esc')) return 'ESC pressed';
  if (key.includes('screen share')) return 'screen share stopped';
  if (key.includes('tab switch') || key.includes('tab away')) return 'tab switch';
  if (key.includes('window blur')) return 'window blur';
  if (key.includes('fullscreen')) return 'fullscreen exited';
  return raw.trim();
};

const buildFlagReasonKeywords = (reason: SubmitReason, violationEntries: Violation[]): string[] => {
  if (!isViolationSubmitReason(reason)) return [];
  const keywords = [
    getSubmitReasonKeyword(reason),
    ...violationEntries.map(v => normalizeViolationKeyword(v.type)),
  ].filter(Boolean);
  return [...new Set(keywords)];
};

// Language ID → Monaco language mapping
const LANG_MONACO: Record<number, string> = {
  71: 'python', 62: 'java', 54: 'cpp', 50: 'c', 63: 'javascript',
  74: 'typescript', 51: 'csharp', 72: 'ruby', 60: 'go', 73: 'rust',
  78: 'kotlin', 76: 'sql', 68: 'php', 85: 'dart',
};

const SEVERITY_CONFIG = {
  low:    { label: 'Low',    color: '#F1A82C', points: 1 },
  medium: { label: 'Medium', color: 'var(--accent-orange)', points: 2 },
  high:   { label: 'High',   color: 'var(--status-danger)', points: 3 },
};

const normalizeJudgeText = (value: string) => value.trim().replace(/\r\n/g, '\n').replace(/\s+/g, ' ').toLowerCase();

// ── Phase type ──
type Phase = 'loading' | 'preflight' | 'rules' | 'active' | 'frozen' | 'submitted';

export default function TakeTest({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();

  // Core state
  const [test, setTest] = useState<TestData | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [alreadyAttempted, setAlreadyAttempted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [submitReason, setSubmitReason] = useState<SubmitReason | ''>('');
  const [resultSummary, setResultSummary] = useState<{
    score: number;
    totalQuestions: number;
    attemptedQuestions: number;
    percentage: number;
    mode: 'auto' | 'attempted';
    resultId: string;
  } | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [flatQuestions, setFlatQuestions] = useState<FlatQuestion[]>([]);

  // Proctoring state
  const [violations, setViolations] = useState<Violation[]>([]);
  const [violationPoints, setViolationPoints] = useState(0);
  const [warningVisible, setWarningVisible] = useState(false);
  const [warningData, setWarningData] = useState<{ message: string; severity: string }>({ message: '', severity: 'low' });
  // Preflight checks
  const [checks, setChecks] = useState({ internet: 'pending' as string, screen: 'pending' as string });

  // Refs
  const submittedRef = useRef(false);
  const hiddenCasesRef = useRef<Array<Array<{ input: string; output: string }>>>([]);
  const violationsRef = useRef<Violation[]>([]);
  const violationPointsRef = useRef(0);
  const highViolationsRef = useRef(0);
  const savedThemeRef = useRef<string | null>(null);
  const sessionIdRef = useRef(crypto.randomUUID());
  const screenStreamRef = useRef<MediaStream | null>(null);
  const chatOpenRef = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const escPressedOnceRef = useRef(false);
  const tabAwayStartRef = useRef<number | null>(null);
  const tabAwayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Compiler state
  const [selectedLang, setSelectedLang] = useState(71);
  const [questionLanguages, setQuestionLanguages] = useState<Record<number, number>>({});
  const [codeStdin, setCodeStdin] = useState('');
  const [codeOutput, setCodeOutput] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [compileTime, setCompileTime] = useState<string | null>(null);
  const [compileMemory, setCompileMemory] = useState<string | null>(null);
  const [judgeSubmitting, setJudgeSubmitting] = useState(false);
  const [judgeSummary, setJudgeSummary] = useState<{ verdict: string; passed: number; total: number; failedCase: number | null } | null>(null);
  const [judgeCaseResults, setJudgeCaseResults] = useState<Array<{ caseNumber: number; statusCode: string; status: string; stderr: string | null }> | null>(null);

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

          // Build flat question list from sections or legacy problems
          const flat: FlatQuestion[] = [];
          const allHiddenCases: Array<Array<{ input: string; output: string }>> = [];

          if (data.sections && data.sections.length > 0) {
            data.sections.forEach((section, sIdx) => {
              (section.questions || []).forEach((q, qIdx) => {
                allHiddenCases.push(q.hiddenTestCases || []);
                flat.push({
                  ...q,
                  hiddenTestCases: undefined, // strip from state
                  _sectionType: section.type,
                  _sectionTitle: section.title,
                  _sectionIndex: sIdx,
                  _originalIndex: qIdx,
                });
              });
            });
          } else {
            // Legacy: all problems are coding
            (data.problems || []).forEach((p, idx) => {
              allHiddenCases.push(p.hiddenTestCases || []);
              flat.push({
                ...p,
                hiddenTestCases: undefined,
                _sectionType: 'coding',
                _sectionTitle: 'Coding',
                _sectionIndex: 0,
                _originalIndex: idx,
              });
            });
          }

          hiddenCasesRef.current = allHiddenCases;

          // Build sanitized TestData (strip hidden cases from problems too)
          const sanitized: TestData = {
            ...data,
            problems: (data.problems || []).map(({ hiddenTestCases: _h, ...rest }) => rest),
            sections: data.sections?.map(s => ({
              ...s,
              questions: s.questions.map(({ hiddenTestCases: _h, ...rest }) => rest),
            })),
          };
          setTest(sanitized);
          setFlatQuestions(flat);
          if (data.duration) setTimeLeft(data.duration * 60);

          // Check if student already attempted this test
          if (user) {
            try {
              const existingResults = await getDocs(query(
                collection(db, 'test_results'),
                where('testId', '==', id),
                where('userId', '==', user.uid),
              ));
              if (!existingResults.empty) {
                // Check if any result does NOT have reattemptAllowed flag
                const hasBlockingResult = existingResults.docs.some(d => !d.data().reattemptAllowed);
                if (hasBlockingResult) {
                  setAlreadyAttempted(true);
                }
              }
            } catch { /* index may be missing, allow attempt */ }
          }
        }
      } catch (error) {
        console.error('Error fetching test:', error);
      } finally {
        if (!test) {
          setPhase(prev => prev === 'loading' ? 'preflight' : prev);
        }
      }
    }
    fetchTestData();
  }, [id]);

  // ── Submit handler ──
  const doSubmit = useCallback(async (reason: SubmitReason, options?: { violationsSnapshot?: Violation[] }) => {
    if (submittedRef.current || !test || !user || flatQuestions.length === 0) return;
    submittedRef.current = true;

    // Stop media
    screenStreamRef.current?.getTracks().forEach(t => t.stop());

    try {
      // Unlock keyboard before exiting fullscreen
      if ('keyboard' in navigator && typeof (navigator as any).keyboard?.unlock === 'function') {
        try { (navigator as any).keyboard.unlock(); } catch { /* ok */ }
      }
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      const attemptedQuestions = Object.keys(answers).filter((k) => (answers[Number(k)] || '').trim().length > 0).length;
      const violationEntries = options?.violationsSnapshot ?? violationsRef.current;
      const flaggedByViolation = isViolationSubmitReason(reason);
      const flagReasonKeywords = buildFlagReasonKeywords(reason, violationEntries);

      let score = 0;
      let gradable = 0;
      const questionEvaluations: Array<{
        index: number;
        sectionType: string;
        verdict: QuestionVerdict;
        passed: number;
        total: number;
        failedCase: number | null;
        usedHiddenCases: boolean;
      }> = [];

      for (let index = 0; index < flatQuestions.length; index += 1) {
        const question = flatQuestions[index];
        const answer = (answers[index] || '').trim();

        if (!answer) {
          questionEvaluations.push({
            index,
            sectionType: question._sectionType,
            verdict: 'UNANSWERED',
            passed: 0,
            total: question._sectionType === 'coding' ? (hiddenCasesRef.current[index] || []).length || (question.sampleTestCases || []).length : 1,
            failedCase: null,
            usedHiddenCases: false,
          });
          continue;
        }

        // ── Aptitude: text comparison ──
        if (question._sectionType === 'aptitude') {
          gradable += 1;
          const correct = (question.correctAnswer || '').trim().toLowerCase();
          const isCorrect = correct.length > 0 && answer.toLowerCase() === correct;
          if (isCorrect) score += 1;
          questionEvaluations.push({
            index,
            sectionType: 'aptitude',
            verdict: isCorrect ? 'AC' : (correct.length > 0 ? 'WA' : 'UNGRADED'),
            passed: isCorrect ? 1 : 0,
            total: 1,
            failedCase: null,
            usedHiddenCases: false,
          });
          continue;
        }

        // ── MCQ: letter comparison ──
        if (question._sectionType === 'mcq') {
          gradable += 1;
          const correct = (question.correctAnswer || '').trim().toUpperCase();
          const isCorrect = correct.length > 0 && answer.toUpperCase() === correct;
          if (isCorrect) score += 1;
          questionEvaluations.push({
            index,
            sectionType: 'mcq',
            verdict: isCorrect ? 'AC' : (correct.length > 0 ? 'WA' : 'UNGRADED'),
            passed: isCorrect ? 1 : 0,
            total: 1,
            failedCase: null,
            usedHiddenCases: false,
          });
          continue;
        }

        // ── Coding: compiler evaluation ──
        const hiddenCases = (hiddenCasesRef.current[index] || []).map((tc) => ({
          input: tc.input,
          expectedOutput: tc.output,
          isHidden: true,
        }));
        const sampleCases = (question.sampleTestCases || []).map((tc: { input: string; output: string }) => ({
          input: tc.input,
          expectedOutput: tc.output,
          isHidden: false,
        }));

        const casesForScoring = hiddenCases.length > 0 ? hiddenCases : sampleCases;
        if (casesForScoring.length === 0) {
          questionEvaluations.push({
            index,
            sectionType: 'coding',
            verdict: 'UNGRADED',
            passed: 0,
            total: 0,
            failedCase: null,
            usedHiddenCases: false,
          });
          continue;
        }

        gradable += 1;

        try {
          const compileRes = await fetch('/api/compile', {
            method: 'POST',
            headers: await authHeaders(),
            body: JSON.stringify({
              mode: 'submit',
              source_code: answer,
              language_id: questionLanguages[index] || 71,
              testCases: casesForScoring,
              memoryLimitKb: 262144,
            }),
          });

          const compileData = await compileRes.json();
          if (!compileRes.ok || compileData.error) {
            questionEvaluations.push({
              index,
              sectionType: 'coding',
              verdict: 'RE',
              passed: 0,
              total: casesForScoring.length,
              failedCase: null,
              usedHiddenCases: hiddenCases.length > 0,
            });
            continue;
          }

          const verdict = (compileData.summary?.verdict || 'RE') as QuestionVerdict;
          if (verdict === 'AC') {
            score += 1;
          }

          questionEvaluations.push({
            index,
            sectionType: 'coding',
            verdict,
            passed: compileData.summary?.passed ?? 0,
            total: compileData.summary?.total ?? casesForScoring.length,
            failedCase: compileData.summary?.failedCase ?? null,
            usedHiddenCases: hiddenCases.length > 0,
          });
        } catch {
          questionEvaluations.push({
            index,
            sectionType: 'coding',
            verdict: 'RE',
            passed: 0,
            total: casesForScoring.length,
            failedCase: null,
            usedHiddenCases: hiddenCases.length > 0,
          });
        }
      }

      const mode: 'auto' | 'attempted' = gradable > 0 ? 'auto' : 'attempted';
      const finalScore = mode === 'auto' ? score : attemptedQuestions;
      const totalQuestions = flatQuestions.length;
      const percentage = totalQuestions > 0 ? Math.round((finalScore / totalQuestions) * 1000) / 10 : 0;

      // Build question snapshots for post-test review
      const questionSnapshots = flatQuestions.map((q, index) => ({
        questionDescription: q.questionDescription,
        sectionType: q._sectionType,
        sectionTitle: q._sectionTitle,
        options: q.options || null,
        correctAnswer: q.correctAnswer || null,
        sampleTestCases: q.sampleTestCases || null,
        studentAnswer: (answers[index] || '').trim(),
        difficulty: q.difficulty || null,
      }));

      // Reset reattemptAllowed on all prior results so admin panel shows "Reassign Test" again
      try {
        const priorResults = await getDocs(query(
          collection(db, 'test_results'),
          where('testId', '==', id),
          where('userId', '==', user.uid),
        ));
        if (!priorResults.empty) {
          await Promise.all(priorResults.docs.map(d =>
            updateDoc(doc(db, 'test_results', d.id), { reattemptAllowed: false })
          ));
        }
      } catch { /* not critical */ }

      const resultDocRef = await addDoc(collection(db, 'test_results'), {
        testId: id,
        testTitle: test.title || test.sourceFileName,
        userId: user.uid,
        userEmail: user.email,
        answers,
        attemptedQuestions,
        score: finalScore,
        totalQuestions,
        percentage,
        scoringMode: mode,
        questionEvaluations,
        questionSnapshots,
        submittedAt: serverTimestamp(),
        universityId: test.universityId,
        sessionId: sessionIdRef.current,
        flagged: flaggedByViolation,
        reattemptAllowed: false,
        proctoring: {
          totalViolations: violationEntries.length,
          violationPoints: violationPointsRef.current,
          violationLog: violationEntries.map(v => `[${v.severity.toUpperCase()}] ${v.type} — ${v.timestamp}`),
          submitReason: reason,
          flagReasonKeywords,
        },
      });
      setResultSummary({
        score: finalScore,
        totalQuestions,
        attemptedQuestions,
        percentage,
        mode,
        resultId: resultDocRef.id,
      });
      setSubmitReason(reason);
      setPhase('submitted');
      setDoc(doc(db, 'exam_sessions', sessionIdRef.current), {
        status: 'submitted',
        submittedAt: serverTimestamp(),
        lastHeartbeat: serverTimestamp(),
        isAttempting: false,
        flagged: flaggedByViolation,
        submitReason: reason,
        flagReasonKeywords,
      }, { merge: true }).catch(() => {});
    } catch (error) {
      console.error('Error submitting test:', error);
      submittedRef.current = false;
    }
  }, [test, user, answers, id, questionLanguages, flatQuestions]);

  // ── Add violation ──
  const addViolation = useCallback((
    type: string,
    severity: 'low' | 'medium' | 'high',
    userMessage: string,
    options?: { immediateSubmitReason?: SubmitReason; forceMaxWarning?: boolean }
  ) => {
    if (submittedRef.current) return;
    const entry: Violation = { type, severity, timestamp: new Date().toLocaleTimeString(), message: userMessage };
    const nextViolations = [...violationsRef.current, entry];
    violationsRef.current = nextViolations;
    setViolations(nextViolations);
    const pts = SEVERITY_CONFIG[severity].points;
    violationPointsRef.current += pts;
    setViolationPoints(violationPointsRef.current);
    if (options?.forceMaxWarning) {
      violationPointsRef.current = MAX_VIOLATIONS;
      setViolationPoints(MAX_VIOLATIONS);
    }

    if (severity === 'high') highViolationsRef.current += 1;

    setWarningData({ message: userMessage, severity });
    setWarningVisible(true);
    setTimeout(() => setWarningVisible(false), 5000);

    if (options?.immediateSubmitReason) {
      doSubmit(options.immediateSubmitReason, { violationsSnapshot: nextViolations });
      return;
    }

    // Session freeze on high severity
    if (severity === 'high' && highViolationsRef.current >= HIGH_SEVERITY_LIMIT) {
      setPhase('frozen');
      setTimeout(() => doSubmit('session_frozen', { violationsSnapshot: nextViolations }), 5000);
      return;
    }
    if (violationPointsRef.current >= MAX_VIOLATIONS) {
      doSubmit('max_violations', { violationsSnapshot: nextViolations });
    }
  }, [doSubmit]);

  // ── Preflight: System Readiness Check ──
  const runPreflight = useCallback(async () => {
    // Internet
    setChecks(c => ({ ...c, internet: 'checking' }));
    try {
      const start = performance.now();
      // Ping own origin — any response (even 405) proves connectivity
      const res = await fetch('/api/compile', { method: 'HEAD', cache: 'no-store' });
      const latency = Math.round(performance.now() - start);
      // Any HTTP response means the network is reachable
      if (res.status > 0) {
        setChecks(c => ({ ...c, internet: latency < 3000 ? 'pass' : 'slow' }));
      } else {
        setChecks(c => ({ ...c, internet: 'fail' }));
      }
    } catch {
      setChecks(c => ({ ...c, internet: 'fail' }));
    }

    // Screen sharing — require entire screen (monitor), reject tab/window
    setChecks(c => ({ ...c, screen: 'checking' }));
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: 1920, height: 1080, displaySurface: 'monitor' } as any,
        preferCurrentTab: false,
        selfBrowserSurface: 'exclude',
        surfaceSwitching: 'exclude',
      } as any);
      // Verify the user actually selected the entire screen
      const videoTrack = screenStream.getVideoTracks()[0];
      const settings = videoTrack?.getSettings() as any;
      if (settings?.displaySurface && settings.displaySurface !== 'monitor') {
        // User selected a tab or window instead of entire screen
        screenStream.getTracks().forEach(t => t.stop());
        setChecks(c => ({ ...c, screen: 'fail_surface' }));
      } else {
        screenStreamRef.current = screenStream;
        setChecks(c => ({ ...c, screen: 'pass' }));
      }
    } catch {
      setChecks(c => ({ ...c, screen: 'fail' }));
    }
  }, []);

  useEffect(() => {
    if (phase === 'preflight') runPreflight();
  }, [phase, runPreflight]);

  // ── Timer ──
  useEffect(() => {
    if ((phase !== 'active' && phase !== 'submitted') || timeLeft === null) return;
    if (timeLeft <= 0) {
      if (phase === 'active') doSubmit('time_up');
      return;
    }
    const t = setInterval(() => setTimeLeft(v => (v !== null ? v - 1 : null)), 1000);
    return () => clearInterval(t);
  }, [phase, timeLeft, doSubmit]);

  // ── Heartbeat for active attempt detection ──
  useEffect(() => {
    if (phase !== 'active') return;
    const touchSession = () => {
      setDoc(doc(db, 'exam_sessions', sessionIdRef.current), {
        status: 'active',
        isAttempting: true,
        lastHeartbeat: serverTimestamp(),
      }, { merge: true }).catch(() => {});
    };
    touchSession();
    const heartbeat = setInterval(touchSession, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(heartbeat);
  }, [phase]);

  // ── Fullscreen enforcement ──
  useEffect(() => {
    if (phase !== 'active') return;
    const handleFS = () => {
      if (!document.fullscreenElement && !submittedRef.current) {
        addViolation('Exited fullscreen', 'medium', 'You exited fullscreen mode. Please remain in fullscreen.');
        document.documentElement.requestFullscreen()
          .then(() => {
            // Re-lock ESC key after re-entering fullscreen
            if ('keyboard' in navigator && typeof (navigator as any).keyboard?.lock === 'function') {
              (navigator as any).keyboard.lock(['Escape']).catch(() => {});
            }
          })
          .catch(() => {});
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
      // Temporary relaxation: allow copy/paste shortcuts.
      if ((e.ctrlKey || e.metaKey) && ['x','a','p','s'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        addViolation(`Shortcut ${e.key}`, 'medium', `Keyboard shortcut blocked: ${e.metaKey ? 'Cmd' : 'Ctrl'}+${e.key.toUpperCase()}`);
      }
      if (['F12','PrintScreen'].includes(e.key)) { e.preventDefault(); addViolation(e.key, 'high', `${e.key} is not allowed during the exam.`); }
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!escPressedOnceRef.current) {
          escPressedOnceRef.current = true;
          addViolation(
            'ESC pressed',
            'high',
            'Escape key detected! Pressing Escape again will auto-submit your test immediately.',
          );
        } else {
          addViolation(
            'ESC pressed',
            'high',
            'Escape key pressed again. Your test is being auto-submitted.',
            { immediateSubmitReason: 'esc_pressed', forceMaxWarning: true }
          );
        }
      }
    };
    const events = ['cut','contextmenu'] as const;
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
    if (phase !== 'active' && phase !== 'frozen' && phase !== 'submitted') return;
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
        lastHeartbeat: serverTimestamp(),
        status: 'active',
        isAttempting: true,
        browser: navigator.userAgent,
        screenRes: `${screen.width}x${screen.height}`,
      });
    } catch (e) { console.error('Session creation failed:', e); }
    try {
      await document.documentElement.requestFullscreen();
      // Lock ESC key in fullscreen so the browser doesn't exit fullscreen on first press
      if ('keyboard' in navigator && typeof (navigator as any).keyboard?.lock === 'function') {
        try { await (navigator as any).keyboard.lock(['Escape']); } catch { /* not supported or denied */ }
      }
    } catch { /* ok */ }
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
        senderId: user.uid,
        message: msg,
        timestamp: serverTimestamp(),
        userEmail: user.email,
      });
    } catch (e) { console.error('Failed to send message:', e); }
  };

  // ── Run code against compiler ──
  const runCode = async () => {
    const code = answers[currentQuestion];
    if (!code?.trim() || compiling || !test || flatQuestions.length === 0) return;
    const question = flatQuestions[currentQuestion];
    if (question._sectionType !== 'coding') return;

    const sampleInput = question.sampleTestCases?.[0]?.input || '';
    const effectiveStdin = codeStdin.trim().length > 0 ? codeStdin : sampleInput;
    if (!codeStdin.trim() && sampleInput.trim()) {
      setCodeStdin(sampleInput);
    }

    setCompiling(true);
    setCodeOutput(null);
    setCodeError(null);
    setCompileTime(null);
    setCompileMemory(null);
    setJudgeSummary(null);
    setJudgeCaseResults(null);
    try {
      const res = await fetch('/api/compile', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          mode: 'run',
          source_code: code,
          language_id: selectedLang,
          stdin: effectiveStdin,
          memoryLimitKb: 262144,

        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setCodeError(data.error || `Server error (${res.status})`);
      } else if (data.statusCode === 'CE' || data.statusCode === 'RE' || data.statusCode === 'TLE') {
        setCodeError(data.friendlyError || data.compile_output || data.stderr || data.status?.description || 'Execution failed');
      } else if (data.stderr) {
        setCodeError(data.friendlyError || data.stderr);
        if (data.stdout) setCodeOutput(data.stdout);
      } else {
        setCodeOutput(data.stdout || '(no output)');
      }
      if (data.time) setCompileTime(data.time);
      if (typeof data.memory === 'number') setCompileMemory(`${(data.memory / 1024).toFixed(1)} MB`);
    } catch {
      setCodeError('Failed to connect to compiler');
    } finally {
      setCompiling(false);
    }
  };

  const submitCode = async () => {
    const code = answers[currentQuestion];
    if (!code?.trim() || judgeSubmitting || compiling || !test || flatQuestions.length === 0) return;
    const question = flatQuestions[currentQuestion];
    if (question._sectionType !== 'coding') return;

    let hiddenCases = (hiddenCasesRef.current[currentQuestion] || []).map((tc) => ({
      input: tc.input,
      expectedOutput: tc.output,
      isHidden: true,
    }));
    let fallbackSampleCases = (question.sampleTestCases || []).map((tc) => ({
      input: tc.input,
      expectedOutput: tc.output,
      isHidden: false,
    }));

    const fallbackExpectedOutput =
      (question.expectedOutput || '').trim() ||
      (question.sampleTestCases?.[0]?.output || '').trim();

    if (hiddenCases.length === 0 && fallbackSampleCases.length === 0 && fallbackExpectedOutput) {
      fallbackSampleCases = [
        {
          input: question.sampleTestCases?.[0]?.input || codeStdin || '',
          expectedOutput: fallbackExpectedOutput,
          isHidden: false,
        },
      ];
    }

    const testCases = hiddenCases.length > 0 ? hiddenCases : fallbackSampleCases;

    if (testCases.length === 0) {
      setCodeError('No test cases or answer key configured for this question yet. Ask your admin to add one of them.');
      setJudgeSummary(null);
      setJudgeCaseResults(null);
      return;
    }

    setJudgeSubmitting(true);
    setCodeError(null);
    setCodeOutput(null);
    setCompileTime(null);
    setCompileMemory(null);
    setJudgeSummary(null);
    setJudgeCaseResults(null);

    try {
      const res = await fetch('/api/compile', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          mode: 'submit',
          source_code: code,
          language_id: selectedLang,
          testCases,
          memoryLimitKb: 262144,

        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setCodeError(data.error || `Server error (${res.status})`);
      } else {
        setJudgeSummary(data.summary || null);
        setJudgeCaseResults((data.cases || []).map((c: any) => ({
          caseNumber: c.caseNumber,
          statusCode: c.statusCode,
          status: c.status,
          stderr: c.stderr || null,
        })));
      }
    } catch {
      setCodeError('Failed to submit code for judging');
    } finally {
      setJudgeSubmitting(false);
    }
  };

  const handleNext = () => { if (flatQuestions.length > 0 && currentQuestion < flatQuestions.length - 1) setCurrentQuestion(p => p + 1); };
  const handlePrevious = () => { if (currentQuestion > 0) setCurrentQuestion(p => p - 1); };
  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  useEffect(() => {
    setSelectedLang(questionLanguages[currentQuestion] || 71);
    setCodeStdin('');
    setCodeOutput(null);
    setCodeError(null);
  }, [currentQuestion]); // eslint-disable-line react-hooks/exhaustive-deps

  const allChecksPassed = (checks.internet === 'pass' || checks.internet === 'slow') && checks.screen === 'pass';

  // ─────────── RENDER ───────────

  // Loading
  if (phase === 'loading') return <div className="flex items-center justify-center py-24"><div className="loading-dots"><span /><span /><span /></div></div>;
  if (!test) return <div className="flex items-center justify-center py-24 text-[var(--text-tertiary)]">Test not found.</div>;
  if (flatQuestions.length === 0) return <div className="flex items-center justify-center py-24 text-[var(--text-tertiary)]">No problems found.</div>;

  // ── Already attempted screen ──
  if (alreadyAttempted) {
    return (
      <div className="max-w-lg mx-auto animate-fade-in py-12">
        <div className="window p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-[var(--status-danger)]/10 flex items-center justify-center mx-auto mb-5">
            <Lock size={28} className="text-[var(--status-danger)]" />
          </div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Test Already Attempted</h1>
          <p className="text-[var(--text-tertiary)] text-[13px] mb-6">
            You have already submitted this test. Each test can only be attempted once. Contact your administrator if you need a reattempt.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => router.push('/user/results')} className="btn-primary px-6 py-2.5 text-[13px]">
              View Results
            </button>
            <button onClick={() => router.push('/user/test-portal')} className="btn-secondary px-6 py-2.5 text-[13px]">
              Back to Tests
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Submitted screen ──
  if (phase === 'submitted') {
    const wasForced = submitReason !== 'manual';
    return (
      <div className="fixed inset-0 z-[9999] bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 ${wasForced ? 'bg-[var(--status-danger)]/10' : 'bg-[var(--status-success)]/10'}`}>
            {wasForced ? <AlertTriangle size={28} className="text-[var(--status-danger)]" /> : <CheckCircle2 size={28} className="text-[var(--status-success)]" />}
          </div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
            {wasForced ? 'Test Auto-Submitted' : 'Test Submitted Successfully'}
          </h1>
          <p className="text-[var(--text-tertiary)] text-[13px] mb-1">
            {submitReason === 'max_violations' && 'Your test was terminated due to excessive integrity violations.'}
            {submitReason === 'session_frozen' && 'Your session was frozen and auto-submitted due to a critical security breach.'}
            {submitReason === 'time_up' && 'Time expired. Your answers have been saved.'}
            {submitReason === 'tab_away' && 'Your test was auto-submitted because you left the test tab for over 30 seconds.'}
            {submitReason === 'esc_pressed' && 'Your test was auto-submitted because the Escape key was pressed.'}
            {submitReason === 'manual' && 'Your answers have been saved successfully.'}
          </p>
          {violations.length > 0 && (
            <p className="text-[var(--text-faint)] text-[12px] mb-6">
              Integrity report: {violations.length} violation{violations.length > 1 ? 's' : ''} recorded ({violationPoints} severity points)
            </p>
          )}

          {resultSummary && (
            <div className="mb-6 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 text-left">
              <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)] mb-2">Exam Result</p>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[var(--text-tertiary)]">Score</span>
                <span className="text-[14px] font-semibold text-[var(--text-primary)] tabular-nums">
                  {resultSummary.score} / {resultSummary.totalQuestions}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[13px] text-[var(--text-tertiary)]">Percentage</span>
                <span className="text-[14px] font-semibold text-[var(--status-success)] tabular-nums">{resultSummary.percentage}%</span>
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
            {resultSummary?.resultId && (
              <button onClick={() => router.push(`/user/results/review/${resultSummary.resultId}`)} className="btn-secondary px-6 py-2.5 text-[13px]">
                Review Questions
              </button>
            )}
            <button onClick={() => router.push('/user/results')} className="btn-primary px-6 py-2.5 text-[13px]">
              View Results
            </button>
            <button onClick={() => router.push('/user/test-portal')} className="btn-secondary px-6 py-2.5 text-[13px]">
              Back to Tests
            </button>
          </div>

          {/* Post-submission chat — available until test duration ends */}
          {timeLeft !== null && timeLeft > 0 && (
            <div className="mt-6">
              <p className="text-[11px] text-[var(--text-faint)] mb-2">
                Chat with proctor available for {formatTime(timeLeft)}
              </p>
              <button onClick={toggleChat} className="inline-flex items-center gap-2 text-[12px] font-semibold text-[#4B8BBE] hover:text-[#4C5ABF] transition-colors">
                <MessageCircle size={14} />
                {chatOpen ? 'Close Chat' : 'Open Chat'}
                {newMsgCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-[var(--status-danger)] text-white text-[8px] font-semibold flex items-center justify-center">
                    {newMsgCount}
                  </span>
                )}
              </button>
            </div>
          )}

          {/* Chat panel on submitted screen */}
          {chatOpen && (
            <div className="mt-4 mx-auto w-full max-w-sm rounded-lg border border-[var(--border-subtle)] shadow-xl bg-[var(--bg-primary)] flex flex-col overflow-hidden" style={{ height: '320px' }}>
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
                <div className="flex items-center gap-2">
                  <MessageCircle size={14} className="text-[#4B8BBE]" />
                  <span className="text-[12px] font-semibold text-[var(--text-primary)]">Live Support</span>
                </div>
                <button onClick={toggleChat} className="text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors">
                  <XCircle size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {chatMessages.length === 0 && (
                  <div className="text-center py-8">
                    <MessageCircle size={20} className="mx-auto text-[var(--text-faint)] mb-2" />
                    <p className="text-[11px] text-[var(--text-faint)]">Send a message to the proctor.</p>
                  </div>
                )}
                {chatMessages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.sender === 'student' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] px-3 py-1.5 rounded-lg text-[12px] ${
                      msg.sender === 'student'
                        ? 'bg-[#4B8BBE] text-white rounded-br-none'
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
                  className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded px-3 py-1.5 text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[#4B8BBE]"
                />
                <button onClick={sendChatMessage} disabled={!chatInput.trim()} className="p-1.5 rounded bg-[#4B8BBE] text-white disabled:opacity-40 transition-opacity">
                  <Send size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Frozen screen ──
  if (phase === 'frozen') {
    return (
      <div className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-20 h-20 rounded-full bg-[var(--status-danger)]/20 flex items-center justify-center mx-auto mb-5 animate-pulse">
            <Lock size={32} className="text-[var(--status-danger)]" />
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">Session Paused — Security Review</h1>
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
          {status === 'pass' && <><CheckCircle2 size={14} className="text-[var(--status-success)]" /><span className="text-[11px] font-semibold text-[var(--status-success)]">Ready</span></>}
          {status === 'slow' && <><AlertTriangle size={14} className="text-[#F1A82C]" /><span className="text-[11px] font-semibold text-[#F1A82C]">Slow</span></>}
          {status === 'fail' && <><XCircle size={14} className="text-[var(--status-danger)]" /><span className="text-[11px] font-semibold text-[var(--status-danger)]">Failed</span></>}
          {status === 'fail_surface' && <><XCircle size={14} className="text-[var(--status-danger)]" /><span className="text-[11px] font-semibold text-[var(--status-danger)]">Entire Screen Required</span></>}
        </div>
      </div>
    );

    return (
      <div className="max-w-lg mx-auto animate-fade-in py-12">
        <div className="window p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-[#4B8BBE]/10 flex items-center justify-center">
              <Monitor size={20} className="text-[#4B8BBE]" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[var(--text-primary)]">System Readiness Check</h1>
              <p className="text-[var(--text-tertiary)] text-[12px]">Verifying your hardware before the exam</p>
            </div>
          </div>

          {/* Checklist */}
          <div className="mb-6">
            <CheckRow label="Internet Connection" icon={Wifi} status={checks.internet} />
            <CheckRow label="Screen Sharing" icon={MonitorPlay} status={checks.screen} />
          </div>

          {/* Security indicators */}
          <div className="bg-[var(--status-success)]/5 border border-[var(--status-success)]/20 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck size={14} className="text-[var(--status-success)]" />
              <span className="text-[11px] font-semibold text-[var(--status-success)] uppercase tracking-wider">Secure Connection</span>
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
            <p className="text-[12px] text-[var(--status-danger)] mb-4">Screen sharing denied. Please allow screen sharing and reload the page.</p>
          )}
          {checks.screen === 'fail_surface' && (
            <p className="text-[12px] text-[var(--status-danger)] mb-4">You must share your <strong>entire screen</strong>, not a single tab or window. Please reload and select &quot;Entire Screen&quot;.</p>
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
            <div className="w-10 h-10 rounded-lg bg-[var(--accent-orange)]/10 flex items-center justify-center">
              <Shield size={20} className="text-[var(--accent-orange)]" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[var(--text-primary)]">{test.title || test.sourceFileName}</h1>
              <p className="text-[var(--text-tertiary)] text-[12px]">Proctored Assessment — Read carefully</p>
            </div>
          </div>

          <div className="flex items-center gap-4 mb-6 text-[13px] text-[var(--text-secondary)]">
            <span className="flex items-center gap-1.5"><Eye size={14} className="text-[var(--text-faint)]" /> {flatQuestions.length} questions</span>
            {test.duration && <span className="flex items-center gap-1.5"><Clock size={14} className="text-[var(--text-faint)]" /> {test.duration} min</span>}
          </div>

          <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg p-5 mb-5">
            <p className="text-[10px] font-semibold text-[var(--text-faint)] uppercase tracking-[0.07em] mb-4">Monitoring & Enforcement</p>
            <div className="space-y-3 text-[12px] text-[var(--text-tertiary)]">
              <div className="flex items-start gap-2.5">
                <Maximize size={13} className="text-[var(--accent-orange)] mt-0.5 shrink-0" />
                <span>The test runs in <strong className="text-[var(--text-primary)]">fullscreen</strong>. Exiting fullscreen triggers a violation.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Monitor size={13} className="text-[var(--accent-orange)] mt-0.5 shrink-0" />
                <span><strong className="text-[var(--text-primary)]">Tab switching</strong>, copy-paste, right-click, and keyboard shortcuts are blocked and logged.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <MonitorPlay size={13} className="text-[var(--accent-orange)] mt-0.5 shrink-0" />
                <span>Your <strong className="text-[var(--text-primary)]">screen is being recorded</strong> and monitored. Stopping screen share triggers a violation.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <MessageCircle size={13} className="text-[var(--accent-orange)] mt-0.5 shrink-0" />
                <span><strong className="text-[var(--text-primary)]">Live support</strong> is available during the exam via the chat button.</span>
              </div>
            </div>
          </div>

          <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg p-5 mb-6">
            <p className="text-[10px] font-semibold text-[var(--text-faint)] uppercase tracking-[0.07em] mb-3">Violation Severity</p>
            <div className="space-y-2">
              {[
                { level: 'Low', color: '#F1A82C', desc: 'Ambient noise, minor disruption', action: '1 point' },
                { level: 'Medium', color: 'var(--accent-orange)', desc: 'Fullscreen exit, copy/paste attempt, window blur', action: '2 points' },
                { level: 'High', color: 'var(--status-danger)', desc: 'Tab switching, unauthorized key, screen share stopped', action: '3 points — session freeze after 3' },
              ].map(v => (
                <div key={v.level} className="flex items-center gap-3 text-[11px]">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: v.color }} />
                  <span className="font-semibold text-[var(--text-primary)] w-14">{v.level}</span>
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
  const currentQ = flatQuestions[currentQuestion];
  const answeredCount = flatQuestions.reduce((count, _p, idx) => (
    (answers[idx] || '').trim().length > 0 ? count + 1 : count
  ), 0);
  const isCoding = currentQ._sectionType === 'coding';
  const isMcq = currentQ._sectionType === 'mcq';
  const sectionColorMap = { aptitude: '#14B8A6', mcq: '#F59E0B', coding: '#4B8BBE' };

  return (
    <div className="fixed inset-0 z-[9999] bg-[var(--bg-primary)] overflow-y-auto animate-fade-in select-none" style={{ userSelect: 'none' }}>
      {/* Warning toast */}
      {warningVisible && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[9999] max-w-md w-full px-4">
          <div className="rounded-lg shadow-lg border px-4 py-3 flex items-start gap-3 text-[13px]" style={{
            background: `${SEVERITY_CONFIG[warningData.severity as keyof typeof SEVERITY_CONFIG]?.color || 'var(--accent-orange)'}15`,
            borderColor: `${SEVERITY_CONFIG[warningData.severity as keyof typeof SEVERITY_CONFIG]?.color || 'var(--accent-orange)'}30`,
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

      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-[var(--bg-primary)]/95 backdrop-blur border-b border-[var(--border-subtle)] px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 bg-[var(--status-success)]/10 px-2 py-0.5 rounded">
                  <Shield size={11} className="text-[var(--status-success)]" />
                  <span className="text-[10px] font-semibold text-[var(--status-success)] uppercase tracking-wider">Secure Environment Active</span>
                </div>
                <span className="w-px h-4 bg-[var(--border-subtle)] hidden sm:block" />
                <span className="text-[11px] text-[var(--text-faint)] hidden sm:block">Monitoring Enabled</span>
                <span className="w-px h-4 bg-[var(--border-subtle)] hidden sm:block" />
                <div className="hidden sm:flex items-center gap-1 text-[10px] text-[var(--status-success)]">
                  <Lock size={9} />
                  <span>SSL</span>
                </div>
                <div className="hidden sm:flex items-center gap-1 text-[10px] text-[var(--status-success)]">
                  <MonitorPlay size={9} />
                  <span>Screen</span>
                </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="w-px h-4 bg-[var(--border-subtle)]" />
            {/* Violations — only for proctored tests */}
            {violations.length > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-[var(--accent-orange)]">
                <AlertTriangle size={11} />
                {violationPoints}/{MAX_VIOLATIONS}
              </span>
            )}
            {/* Timer */}
            {timeLeft !== null && (
              <span className={`flex items-center gap-1 text-[12px] font-semibold tabular-nums ${timeLeft <= 60 ? 'text-[var(--status-danger)] animate-pulse' : timeLeft <= 300 ? 'text-[var(--accent-orange)]' : 'text-[var(--text-primary)]'}`}>
                <Clock size={12} />
                {formatTime(timeLeft)}
              </span>
            )}
                <span className="w-px h-4 bg-[var(--border-subtle)]" />
                {/* Live Support */}
                <button onClick={toggleChat} className="relative flex items-center gap-1 text-[11px] font-semibold text-[#4B8BBE] hover:text-[#4C5ABF] transition-colors">
                  <MessageCircle size={12} />
                  <span className="hidden sm:inline">Support</span>
                  {newMsgCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[var(--status-danger)] text-white text-[8px] font-semibold flex items-center justify-center">
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
              <MessageCircle size={14} className="text-[#4B8BBE]" />
              <span className="text-[12px] font-semibold text-[var(--text-primary)]">Live Support</span>
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
                    ? 'bg-[#4B8BBE] text-white rounded-br-none'
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
              className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded px-3 py-1.5 text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[#4B8BBE]"
            />
            <button onClick={sendChatMessage} disabled={!chatInput.trim()} className="p-1.5 rounded bg-[#4B8BBE] text-white disabled:opacity-40 transition-opacity">
              <Send size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className={`${isCoding ? 'max-w-7xl' : 'max-w-4xl'} mx-auto pt-14 pb-8 px-4`}>
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded" style={{ background: `${sectionColorMap[currentQ._sectionType]}20`, color: sectionColorMap[currentQ._sectionType] }}>
              {currentQ._sectionTitle}
            </span>
            <p className="text-[var(--text-tertiary)] text-[13px]">
              Question {currentQuestion + 1} of {flatQuestions.length}
            </p>
          </div>
          <span className="text-[11px] text-[var(--text-faint)]">
            {answeredCount}/{flatQuestions.length} answered
          </span>
        </div>

        {isCoding ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-5 items-start">
            <div className="window p-6 sm:p-8">
              <div className="flex justify-between items-start mb-5">
                <div className="flex items-center gap-2">
                  <span className="inline-block text-white px-2.5 py-0.5 text-[11px] font-semibold uppercase rounded" style={{ background: sectionColorMap[currentQ._sectionType] }}>
                    Question {currentQuestion + 1}
                  </span>
                  {currentQ.topic && (
                    <span className="inline-block bg-[var(--bg-surface)] text-[var(--text-secondary)] px-2.5 py-0.5 text-[11px] font-medium rounded border border-[var(--border-subtle)]">
                      {currentQ.topic}
                    </span>
                  )}
                </div>
              </div>

              <h2 className="text-base font-medium mb-5 leading-relaxed text-[var(--text-primary)]">
                {currentQ.questionDescription}
              </h2>

              {currentQ.sampleTestCases && currentQ.sampleTestCases.length > 0 && (
                <div className="mt-5 space-y-2">
                  <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.07em]">Sample Test Case:</p>
                  <pre className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-4 rounded text-sm text-[var(--status-success)] overflow-x-auto font-mono">
                    <div className="mb-2"><span className="text-[var(--text-faint)]">Input:</span> {currentQ.sampleTestCases[0].input}</div>
                    <div><span className="text-[var(--text-faint)]">Output:</span> {currentQ.sampleTestCases[0].output}</div>
                  </pre>
                </div>
              )}

              {currentQ.constraints && currentQ.constraints.length > 0 && (
                <div className="mt-5">
                  <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.07em] mb-2">Constraints:</p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {currentQ.constraints.map((c, i) => <li key={i} className="text-[var(--text-tertiary)]">{c}</li>)}
                  </ul>
                </div>
              )}

              {currentQ.hints && currentQ.hints.length > 0 && (
                <div className="mt-5">
                  <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.07em] mb-2">Hints:</p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {currentQ.hints.map((h, i) => <li key={i} className="text-[var(--text-tertiary)]">{h}</li>)}
                  </ul>
                </div>
              )}
            </div>

            <div className="window p-5">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-[var(--text-primary)]">Your Solution:</label>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <select
                      value={selectedLang}
                      onChange={e => {
                        const lang = Number(e.target.value);
                        setSelectedLang(lang);
                        setQuestionLanguages(prev => ({ ...prev, [currentQuestion]: lang }));
                        setCodeOutput(null);
                        setCodeError(null);
                      }}
                      className="appearance-none bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded px-3 py-1.5 pr-7 text-[12px] text-[var(--text-primary)] font-medium focus:outline-none focus:border-[#4B8BBE] cursor-pointer"
                    >
                      <option value={71}>Python 3</option>
                      <option value={62}>Java</option>
                      <option value={54}>C++</option>
                      <option value={50}>C</option>
                    </select>
                    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-faint)] pointer-events-none" />
                  </div>
                  <button
                    onClick={runCode}
                    disabled={!answers[currentQuestion]?.trim() || compiling}
                    className="flex items-center gap-1.5 bg-[var(--status-success)] hover:bg-[var(--status-success)] text-white px-3 py-1.5 rounded text-[12px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {compiling ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                    {compiling ? 'Running...' : 'Run Code'}
                  </button>
                  <button
                    onClick={submitCode}
                    disabled={!answers[currentQuestion]?.trim() || judgeSubmitting || compiling}
                    className="flex items-center gap-1.5 bg-[#4B8BBE] hover:bg-[#4C5ABF] text-white px-3 py-1.5 rounded text-[12px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {judgeSubmitting ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                    {judgeSubmitting ? 'Submitting...' : 'Submit Code'}
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
                <label className="block text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-[0.07em] mb-1.5">Input (stdin)</label>
                <textarea
                  value={codeStdin}
                  onChange={e => setCodeStdin(e.target.value)}
                  placeholder="Optional: provide input for your program..."
                  className="w-full h-16 p-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded font-mono text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:border-[#4B8BBE] focus:outline-none transition-colors resize-none"
                />
              </div>

              {/* Output terminal */}
              {(codeOutput !== null || codeError !== null || compiling) && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <Terminal size={12} className="text-[var(--text-faint)]" />
                      <span className="text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-[0.07em]">Output</span>
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
                      <pre className="text-[var(--status-danger)] text-[12px] font-mono whitespace-pre-wrap">{codeError}</pre>
                    ) : (
                      <pre className="text-[var(--status-success)] text-[12px] font-mono whitespace-pre-wrap">{codeOutput}</pre>
                    )}
                  </div>
                </div>
              )}

              {judgeSummary && (
                <div className="mt-3 rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-[0.07em]">Submission Verdict</span>
                    <span className={`text-[12px] font-semibold ${judgeSummary.verdict === 'AC' ? 'text-[var(--status-success)]' : 'text-[var(--status-danger)]'}`}>
                      {judgeSummary.verdict}
                    </span>
                  </div>
                  <p className="text-[12px] text-[var(--text-secondary)]">
                    Passed {judgeSummary.passed} / {judgeSummary.total} test cases
                    {judgeSummary.failedCase ? ` (failed at case #${judgeSummary.failedCase})` : ''}
                  </p>
                  {judgeCaseResults && judgeCaseResults.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {judgeCaseResults.map((c) => (
                        <div key={c.caseNumber} className="flex items-start justify-between gap-3 text-[11px]">
                          <span className="text-[var(--text-tertiary)]">Case {c.caseNumber}</span>
                          <span className={`font-semibold ${c.statusCode === 'AC' ? 'text-[var(--status-success)]' : 'text-[var(--status-danger)]'}`}>{c.statusCode}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {judgeCaseResults?.find((c) => c.stderr)?.stderr && (
                    <pre className="mt-2 text-[var(--status-danger)] text-[11px] font-mono whitespace-pre-wrap">{judgeCaseResults.find((c) => c.stderr)?.stderr}</pre>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="window p-6 sm:p-8 mb-5">
              <div className="flex justify-between items-start mb-5">
                <div className="flex items-center gap-2">
                  <span className="inline-block text-white px-2.5 py-0.5 text-[11px] font-semibold uppercase rounded" style={{ background: sectionColorMap[currentQ._sectionType] }}>
                    Question {currentQuestion + 1}
                  </span>
                  {currentQ.topic && (
                    <span className="inline-block bg-[var(--bg-surface)] text-[var(--text-secondary)] px-2.5 py-0.5 text-[11px] font-medium rounded border border-[var(--border-subtle)]">
                      {currentQ.topic}
                    </span>
                  )}
                </div>
              </div>

              <h2 className="text-base font-medium mb-5 leading-relaxed text-[var(--text-primary)]">
                {currentQ.questionDescription}
              </h2>

              {/* MCQ Options */}
              {isMcq && currentQ.options && currentQ.options.length > 0 && (
                <div className="mt-4 space-y-2">
                  {currentQ.options.map((option, oIdx) => {
                    const letter = String.fromCharCode(65 + oIdx); // A, B, C, D...
                    const selected = (answers[currentQuestion] || '').toUpperCase() === letter;
                    return (
                      <button
                        key={oIdx}
                        type="button"
                        onClick={() => setAnswers({ ...answers, [currentQuestion]: letter })}
                        className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg border transition-all text-[13px] ${
                          selected
                            ? 'border-[#4B8BBE] bg-[#4B8BBE]/10 text-[var(--text-primary)]'
                            : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-[var(--border-active)] hover:bg-[var(--bg-surface)]'
                        }`}
                      >
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-semibold shrink-0 ${
                          selected ? 'bg-[#4B8BBE] text-white' : 'bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-tertiary)]'
                        }`}>
                          {letter}
                        </span>
                        <span>{option}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {currentQ.hints && currentQ.hints.length > 0 && (
                <div className="mt-5">
                  <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.07em] mb-2">Hints:</p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {currentQ.hints.map((h, i) => <li key={i} className="text-[var(--text-tertiary)]">{h}</li>)}
                  </ul>
                </div>
              )}
            </div>

            {/* Answer — Aptitude */}
            {currentQ._sectionType === 'aptitude' && (
              <div className="window p-5 mb-5">
                <label className="text-sm font-semibold text-[var(--text-primary)] mb-2 block">Your Answer:</label>
                <input
                  type="text"
                  value={answers[currentQuestion] || ''}
                  onChange={e => setAnswers({ ...answers, [currentQuestion]: e.target.value })}
                  placeholder="Type your answer..."
                  className="w-full px-4 py-3 text-[14px] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--border-active)] transition-colors"
                />
                <p className="text-xs text-[var(--text-faint)] mt-2">{answers[currentQuestion] ? 'Answer saved' : 'No answer provided yet'}</p>
              </div>
            )}

            {/* Answer — MCQ (already handled via option buttons above, just show status) */}
            {isMcq && (
              <div className="window p-5 mb-5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-[var(--text-primary)]">Selected Answer:</label>
                  <span className={`text-[13px] font-semibold ${answers[currentQuestion] ? 'text-[#4B8BBE]' : 'text-[var(--text-faint)]'}`}>
                    {answers[currentQuestion] ? `Option ${answers[currentQuestion]}` : 'None selected'}
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        {/* Navigation */}
        <div className="flex justify-between border-t border-[var(--border-subtle)] pt-5">
          <button disabled={currentQuestion === 0} onClick={handlePrevious} className="btn-secondary px-5 py-2.5 text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed">
            ← Previous
          </button>
          <div className="flex gap-3">
            <button
              onClick={() => setReviewOpen(true)}
              className="btn-secondary px-5 py-2.5 text-sm font-medium text-[var(--status-danger)] border-[var(--status-danger)]/30 hover:bg-[var(--status-danger)]/10"
            >
              Review & Submit
            </button>
            {currentQuestion < flatQuestions.length - 1 && (
              <button onClick={handleNext} className="btn-primary px-6 py-2.5 text-sm font-semibold">Next →</button>
            )}
          </div>
        </div>

        {/* Question grid */}
        <div className="mt-6 window p-5 mb-8">
          <h3 className="text-sm font-semibold mb-3">Question Status:</h3>
          <div className="flex flex-wrap gap-2">
            {flatQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentQuestion(idx)}
                className={`w-9 h-9 rounded text-xs font-semibold transition-all ${
                  idx === currentQuestion ? 'text-white'
                  : answers[idx] ? 'bg-[var(--status-success)] text-white'
                  : 'bg-[var(--border-subtle)] text-[var(--text-tertiary)] hover:bg-[var(--border-active)]'
                }`}
                style={idx === currentQuestion ? { background: sectionColorMap[q._sectionType] } : undefined}
              >
                {idx + 1}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3">
            <p className="text-xs text-[var(--text-faint)] tabular-nums">
              Answered: {answeredCount} / {flatQuestions.length}
            </p>
            <div className="flex items-center gap-3 text-[10px] text-[var(--text-faint)]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#14B8A6]" /> Aptitude</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#F59E0B]" /> MCQ</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#4B8BBE]" /> Coding</span>
            </div>
          </div>
        </div>

        {reviewOpen && (
          <div className="fixed inset-0 z-[10001] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-3xl rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] shadow-xl max-h-[85vh] overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
                <div>
                  <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">Review Before Final Submission</h3>
                  <p className="text-[12px] text-[var(--text-tertiary)] mt-0.5">
                    You answered {answeredCount} of {flatQuestions.length} questions.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReviewOpen(false)}
                  className="text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <XCircle size={18} />
                </button>
              </div>

              <div className="px-5 py-4 overflow-y-auto max-h-[55vh] space-y-2">
                {flatQuestions.map((q, idx) => {
                  const answer = (answers[idx] || '').trim();
                  const answered = answer.length > 0;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setCurrentQuestion(idx);
                        setReviewOpen(false);
                      }}
                      className="w-full text-left rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 hover:border-[var(--border-active)] transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: `${sectionColorMap[q._sectionType]}20`, color: sectionColorMap[q._sectionType] }}>
                            {q._sectionType}
                          </span>
                          <p className="text-[12px] font-semibold text-[var(--text-primary)]">
                            Q{idx + 1}. {q.questionDescription?.slice(0, 80) || 'Question'}{(q.questionDescription || '').length > 80 ? '...' : ''}
                          </p>
                        </div>
                        <span className={`text-[10px] font-semibold uppercase tracking-[0.07em] shrink-0 ${answered ? 'text-[var(--status-success)]' : 'text-[var(--accent-orange)]'}`}>
                          {answered ? 'Answered' : 'Unanswered'}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--text-faint)]">
                        {answered
                          ? q._sectionType === 'mcq'
                            ? `Selected: Option ${answer}`
                            : `${answer.slice(0, 120)}${answer.length > 120 ? '...' : ''}`
                          : 'No answer provided yet.'}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="px-5 py-4 border-t border-[var(--border-subtle)] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setReviewOpen(false)}
                  className="btn-secondary px-5 py-2.5 text-sm font-medium"
                >
                  Continue Editing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReviewOpen(false);
                    doSubmit('manual');
                  }}
                  className="btn-primary px-5 py-2.5 text-sm font-semibold bg-[var(--status-danger)] hover:bg-[var(--status-danger)] border-[var(--status-danger)]"
                >
                  Final Submit
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
