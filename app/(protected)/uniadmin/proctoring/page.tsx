'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
  doc, getDoc, collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, updateDoc, deleteDoc, getDocs,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Shield, Eye, Clock, AlertTriangle, MessageCircle, Send,
  Monitor, Users, XCircle, CheckCircle2, RefreshCw, ChevronRight,
  Mic, Camera, MonitorPlay, ShieldCheck, RotateCcw, Calendar, LogIn, X,
} from 'lucide-react';

interface ExamSession {
  id: string;
  testId: string;
  testTitle: string;
  userId: string;
  userEmail: string;
  universityId: string;
  status: 'active' | 'submitted';
  startedAt: any;
  browser?: string;
  screenRes?: string;
}

interface ChatMessage {
  id: string;
  sender: 'student' | 'proctor';
  message: string;
  timestamp: any;
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
  submittedAt: any;
  proctoring: {
    totalViolations: number;
    violationPoints: number;
    violationLog: string[];
    submitReason: string;
  };
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
  const [upcomingTests, setUpcomingTests] = useState<UpcomingTest[]>([]);
  const [activeTestId, setActiveTestId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Get admin's universityId
  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return; }
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
      // If selected session is no longer active, deselect
      if (selectedSession && !data.find(s => s.id === selectedSession.id)) {
        setSelectedSession(null);
      }
    });
    return () => unsub();
  }, [universityId, selectedSession]);

  // Fetch recent submitted results
  useEffect(() => {
    if (!universityId) return;
    (async () => {
      try {
        const q = query(
          collection(db, 'test_results'),
          where('universityId', '==', universityId),
          orderBy('submittedAt', 'desc'),
        );
        const snap = await getDocs(q);
        setRecentResults(snap.docs.slice(0, 20).map(d => ({ id: d.id, ...d.data() } as TestResult)));
      } catch { /* index may be missing */ }
    })();
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
    if (!selectedSession) { setChatMessages([]); return; }
    const q = query(
      collection(db, 'exam_sessions', selectedSession.id, 'messages'),
      orderBy('timestamp', 'asc'),
    );
    const unsub = onSnapshot(q, (snapshot) => {
      setChatMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage)));
    });
    return () => unsub();
  }, [selectedSession]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const sendMessage = async () => {
    if (!chatInput.trim() || !selectedSession || !user) return;
    const msg = chatInput.trim();
    setChatInput('');
    await addDoc(collection(db, 'exam_sessions', selectedSession.id, 'messages'), {
      sender: 'proctor',
      message: msg,
      timestamp: serverTimestamp(),
      userEmail: user.email,
    });
  };

  // Allow re-attempt: delete the test_result so the student can take the test again
  const allowReattempt = async (result: TestResult) => {
    setReattemptLoading(result.id);
    try {
      await deleteDoc(doc(db, 'test_results', result.id));
      setRecentResults(prev => prev.filter(r => r.id !== result.id));
    } catch (e) {
      console.error('Failed to allow reattempt:', e);
    }
    setReattemptLoading(null);
  };

  const formatTime = (ts: any) => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const filteredSessions = activeTestId
    ? sessions.filter(s => s.testId === activeTestId)
    : sessions;

  if (authLoading || !universityId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-dots"><span /><span /><span /></div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-lg bg-[#5E6AD2]/10 flex items-center justify-center">
            <Shield size={18} className="text-[#5E6AD2]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-[-0.02em]">Proctoring Dashboard</h1>
            <p className="text-[var(--text-tertiary)] text-[12px]">Monitor live exams, respond to student queries, and manage submissions</p>
          </div>
        </div>
      </div>

      {/* Upcoming tests within 24h */}
      {upcomingTests.length > 0 && (
        <div className="window mb-6 overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-[#5E6AD2]" />
              <span className="text-[12px] font-bold text-[var(--text-primary)]">Upcoming in 24 Hours</span>
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
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    isLive ? 'bg-[#4CAF50]/10' : 'bg-[#5E6AD2]/10'
                  }`}>
                    {isLive ? <Monitor size={14} className="text-[#4CAF50]" /> : <Clock size={14} className="text-[#5E6AD2]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-semibold text-[var(--text-primary)] truncate">{test.title}</span>
                      {isLive ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-[#4CAF50] bg-[#4CAF50]/10 px-1.5 py-0.5 rounded shrink-0">
                          <div className="w-1 h-1 rounded-full bg-[#4CAF50] animate-pulse" />
                          LIVE NOW
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold text-[#5E6AD2] bg-[#5E6AD2]/10 px-1.5 py-0.5 rounded shrink-0">
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
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                        activeTestId === test.id
                          ? 'bg-[#4CAF50] text-white'
                          : 'bg-[#4CAF50]/10 text-[#4CAF50] hover:bg-[#4CAF50]/20'
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

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="window p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Live Sessions</p>
              <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{filteredSessions.length}</p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-[#4CAF50]/10 flex items-center justify-center">
              <Monitor size={16} className="text-[#4CAF50]" />
            </div>
          </div>
        </div>
        <div className="window p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Recent Submissions</p>
              <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{recentResults.length}</p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-[#5E6AD2]/10 flex items-center justify-center">
              <CheckCircle2 size={16} className="text-[#5E6AD2]" />
            </div>
          </div>
        </div>
        <div className="window p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Flagged</p>
              <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">
                {recentResults.filter(r => r.proctoring?.submitReason !== 'manual').length}
              </p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-[#DC2626]/10 flex items-center justify-center">
              <AlertTriangle size={16} className="text-[#DC2626]" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Live sessions list */}
        <div className="lg:col-span-1">
          <div className="window">
            <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#4CAF50] animate-pulse" />
                <span className="text-[12px] font-bold text-[var(--text-primary)]">Live Sessions</span>
              </div>
              <span className="text-[10px] text-[var(--text-faint)]">{filteredSessions.length} active</span>
            </div>

            {/* Active test filter banner */}
            {activeTestId && (
              <div className="px-4 py-2 bg-[#4CAF50]/5 border-b border-[#4CAF50]/20 flex items-center justify-between">
                <span className="text-[10px] font-medium text-[#4CAF50]">
                  Filtering: {upcomingTests.find(t => t.id === activeTestId)?.title || 'Selected Test'}
                </span>
                <button onClick={() => setActiveTestId(null)} className="text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors">
                  <X size={12} />
                </button>
              </div>
            )}

            {filteredSessions.length === 0 ? (
              <div className="p-8 text-center">
                <Monitor size={24} className="mx-auto text-[var(--text-faint)] mb-2" />
                <p className="text-[12px] text-[var(--text-faint)]">{activeTestId ? 'No students have started this test yet' : 'No active exam sessions'}</p>
                <p className="text-[11px] text-[var(--text-faint)] mt-1">{activeTestId ? 'Sessions will appear here in real-time when students begin' : 'Sessions appear here when students start tests'}</p>
              </div>
            ) : (
              <div className="max-h-[400px] overflow-y-auto">
                {filteredSessions.map(session => (
                  <button
                    key={session.id}
                    onClick={() => setSelectedSession(session)}
                    className={`w-full text-left px-4 py-3 border-b border-[var(--border-subtle)] last:border-0 transition-colors hover:bg-[var(--bg-elevated)] ${
                      selectedSession?.id === session.id ? 'bg-[var(--bg-elevated)] border-l-2 border-l-[#5E6AD2]' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] font-semibold text-[var(--text-primary)] truncate max-w-[180px]">
                        {session.userEmail}
                      </span>
                      <ChevronRight size={12} className="text-[var(--text-faint)]" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[var(--text-tertiary)] truncate">{session.testTitle}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-[#4CAF50] bg-[#4CAF50]/10 px-1.5 py-0.5 rounded">
                        <div className="w-1 h-1 rounded-full bg-[#4CAF50] animate-pulse" />
                        LIVE
                      </span>
                      <span className="text-[10px] text-[var(--text-faint)]">
                        Started {formatTime(session.startedAt)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Recent Submissions */}
          <div className="window mt-4">
            <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
              <span className="text-[12px] font-bold text-[var(--text-primary)]">Recent Submissions</span>
            </div>
            {recentResults.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-[11px] text-[var(--text-faint)]">No recent submissions</p>
              </div>
            ) : (
              <div className="max-h-[300px] overflow-y-auto">
                {recentResults.map(result => {
                  const wasForced = result.proctoring?.submitReason !== 'manual';
                  return (
                    <div key={result.id} className="px-4 py-3 border-b border-[var(--border-subtle)] last:border-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[12px] font-medium text-[var(--text-primary)] truncate max-w-[160px]">
                          {result.userEmail}
                        </span>
                        {wasForced && (
                          <span className="text-[9px] font-bold text-[#DC2626] bg-[#DC2626]/10 px-1.5 py-0.5 rounded uppercase">
                            {result.proctoring?.submitReason === 'max_violations' ? 'Violations' :
                             result.proctoring?.submitReason === 'session_frozen' ? 'Frozen' :
                             result.proctoring?.submitReason === 'time_up' ? 'Time Up' :
                             result.proctoring?.submitReason === 'face_away' ? 'Face Away' :
                             result.proctoring?.submitReason === 'tab_away' ? 'Tab Switch' : 'Auto'}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[var(--text-tertiary)] truncate">{result.testTitle}</p>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2 text-[10px] text-[var(--text-faint)]">
                          <span>{result.attemptedQuestions}/{result.totalQuestions} answered</span>
                          {result.proctoring?.totalViolations > 0 && (
                            <>
                              <span className="w-px h-3 bg-[var(--border-subtle)]" />
                              <span className="text-[#F54E00]">{result.proctoring.violationPoints} pts</span>
                            </>
                          )}
                        </div>
                        <button
                          onClick={() => allowReattempt(result)}
                          disabled={reattemptLoading === result.id}
                          className="flex items-center gap-1 text-[10px] font-bold text-[#5E6AD2] hover:text-[#4C5ABF] transition-colors disabled:opacity-40"
                          title="Allow student to re-attempt this test"
                        >
                          <RotateCcw size={10} className={reattemptLoading === result.id ? 'animate-spin' : ''} />
                          Re-attempt
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Chat / Session detail */}
        <div className="lg:col-span-2">
          {selectedSession ? (
            <div className="window flex flex-col" style={{ height: '720px' }}>
              {/* Session header */}
              <div className="px-5 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[13px] font-bold text-[var(--text-primary)]">{selectedSession.userEmail}</span>
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-[#4CAF50] bg-[#4CAF50]/10 px-1.5 py-0.5 rounded">
                        <div className="w-1 h-1 rounded-full bg-[#4CAF50] animate-pulse" />
                        LIVE
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--text-tertiary)]">{selectedSession.testTitle}</p>
                  </div>
                  <button onClick={() => setSelectedSession(null)} className="text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors">
                    <XCircle size={18} />
                  </button>
                </div>
                {/* Session details */}
                <div className="flex items-center gap-3 mt-2 text-[10px] text-[var(--text-faint)]">
                  <span className="flex items-center gap-1"><Clock size={9} /> Started {formatTime(selectedSession.startedAt)}</span>
                  {selectedSession.browser && (
                    <span className="flex items-center gap-1"><Monitor size={9} /> {selectedSession.browser.slice(0, 40)}...</span>
                  )}
                  {selectedSession.screenRes && (
                    <span className="flex items-center gap-1"><MonitorPlay size={9} /> {selectedSession.screenRes}</span>
                  )}
                </div>
              </div>

              {/* Chat messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                <div className="text-center py-4">
                  <div className="inline-flex items-center gap-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-full px-3 py-1">
                    <ShieldCheck size={11} className="text-[#4CAF50]" />
                    <span className="text-[10px] text-[var(--text-faint)]">Secure session started — messages are end-to-end between proctor and student</span>
                  </div>
                </div>

                {chatMessages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.sender === 'proctor' ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[70%]">
                      <div className={`px-3 py-2 rounded-lg text-[13px] ${
                        msg.sender === 'proctor'
                          ? 'bg-[#5E6AD2] text-white rounded-br-none'
                          : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-bl-none'
                      }`}>
                        {msg.message}
                      </div>
                      <p className={`text-[9px] mt-0.5 ${msg.sender === 'proctor' ? 'text-right' : ''} text-[var(--text-faint)]`}>
                        {msg.sender === 'proctor' ? 'You' : selectedSession.userEmail.split('@')[0]} · {formatTime(msg.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-[var(--border-subtle)] p-3 flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Reply to student..."
                  className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg px-4 py-2.5 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[#5E6AD2] transition-colors"
                />
                <button
                  onClick={sendMessage}
                  disabled={!chatInput.trim()}
                  className="px-4 py-2.5 rounded-lg bg-[#5E6AD2] text-white text-[13px] font-semibold disabled:opacity-40 transition-opacity flex items-center gap-2 hover:bg-[#4C5ABF]"
                >
                  <Send size={14} />
                  Send
                </button>
              </div>
            </div>
          ) : (
            <div className="window flex flex-col items-center justify-center" style={{ height: '720px' }}>
              <div className="text-center max-w-sm">
                <div className="w-14 h-14 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center mx-auto mb-4">
                  <MessageCircle size={24} className="text-[var(--text-faint)]" />
                </div>
                <h2 className="text-[15px] font-bold text-[var(--text-primary)] mb-1">Select a Session</h2>
                <p className="text-[12px] text-[var(--text-tertiary)] leading-relaxed">
                  Click on an active session from the left panel to view details and chat with the student in real-time.
                </p>
                <div className="mt-6 grid grid-cols-3 gap-3">
                  <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg p-3 text-center">
                    <MessageCircle size={16} className="mx-auto text-[#5E6AD2] mb-1" />
                    <p className="text-[10px] text-[var(--text-faint)]">Reply to queries</p>
                  </div>
                  <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg p-3 text-center">
                    <Eye size={16} className="mx-auto text-[#4CAF50] mb-1" />
                    <p className="text-[10px] text-[var(--text-faint)]">Monitor sessions</p>
                  </div>
                  <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg p-3 text-center">
                    <RotateCcw size={16} className="mx-auto text-[#F54E00] mb-1" />
                    <p className="text-[10px] text-[var(--text-faint)]">Allow re-attempts</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
