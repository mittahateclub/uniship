'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, addDoc, collection, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import {
  Play, CloudUpload, ChevronDown, Clock, CheckCircle2, XCircle,
  BookOpen, AlertTriangle, Loader2, RotateCcw, ArrowLeft, Trophy,
} from 'lucide-react';import dynamic from 'next/dynamic';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

/* ── Monaco language mapping ── */
const MONACO_LANG: Record<string, string> = {
  'Python3': 'python',
  'JavaScript': 'javascript',
  'Java': 'java',
  'C++': 'cpp',
  'C': 'c',
  'TypeScript': 'typescript',
};

/* ── Language IDs matching Judge0 ── */
const LANG_IDS: Record<string, number> = {
  'Python3': 71, 'JavaScript': 93, 'Java': 62, 'C++': 54,
  'C': 50, 'C#': 51, 'TypeScript': 74, 'Go': 60,
  'Ruby': 72, 'Rust': 73, 'PHP': 68, 'Swift': 83,
  'Kotlin': 78,
};

const SUPPORTED_LANGS = ['Python3', 'JavaScript', 'Java', 'C++', 'C'];

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: 'text-teal-400',
  Medium: 'text-amber-400',
  Hard: 'text-red-400',
};

const DEFAULT_STARTER: Record<string, (fn: string) => string> = {
  'Python3': (fn) => `class Solution:\n    def ${fn}(self):\n        pass\n`,
  'JavaScript': (fn) => `/**\n * @return {any}\n */\nvar ${fn} = function() {\n    \n};\n`,
  'Java': (fn) => `class Solution {\n    public void ${fn}() {\n        \n    }\n}\n`,
  'C++': (fn) => `class Solution {\npublic:\n    void ${fn}() {\n        \n    }\n};\n`,
  'C': (fn) => `#include <stdio.h>\n#include <stdlib.h>\n\nvoid ${fn}() {\n    \n}\n`,
};

interface TestCase {
  input: string;
  expectedOutput: string;
  isHidden: boolean;
}

interface Problem {
  id: string;
  title: string;
  difficulty: string;
  description: string;
  functionName: string;
  constraints: string[];
  inputFormat: string;
  outputFormat: string;
  starterCode: Record<string, string>;
  testCases: TestCase[];
  visibleUntil?: { seconds: number } | null;
}

interface RunResult {
  caseNumber: number;
  statusCode: string;
  stdout: string | null;
  stderr: string | null;
  expectedOutput: string;
  inputPreview: string;
  isHidden: boolean;
  time: string | null;
  memory: number | null;
}

export default function PracticeSolvePage() {
  const { user, loading: authLoading } = useAuth();
  const { id } = useParams();
  const router = useRouter();

  const [problem, setProblem] = useState<Problem | null>(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState('Python3');
  const [code, setCode] = useState('');
  const [isLangOpen, setIsLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  // Tabs
  const [consoleTab, setConsoleTab] = useState<'testcases' | 'result'>('testcases');
  const [activeTestCase, setActiveTestCase] = useState(0);

  // Execution
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [results, setResults] = useState<RunResult[] | null>(null);
  const [submitVerdict, setSubmitVerdict] = useState<{
    verdict: string; passed: number; total: number;
  } | null>(null);
  const [showVerdictModal, setShowVerdictModal] = useState(false);
  const [isAlreadySolved, setIsAlreadySolved] = useState(false);



  // Load problem
  useEffect(() => {
    if (!id) return;
    (async () => {
      const snap = await getDoc(doc(db, 'practice_problems', id as string));
      if (snap.exists()) {
        const data = snap.data();
        // Check if the problem has expired
        if (data.visibleUntil && data.visibleUntil.seconds * 1000 < Date.now()) {
          setLoading(false);
          return; // problem stays null → shows not-found state
        }
        setProblem({ id: snap.id, ...data } as Problem);
        setCode(data.starterCode?.['Python3'] || DEFAULT_STARTER['Python3'](data.functionName || 'solve'));

        // Check if user already solved this
        if (user) {
          const subsSnap = await getDocs(query(
            collection(db, 'practice_submissions'),
            where('userId', '==', user.uid),
            where('problemId', '==', snap.id),
            where('verdict', '==', 'AC'),
          ));
          setIsAlreadySolved(!subsSnap.empty);
        }
      }
      setLoading(false);
    })();
  }, [id]);

  // Close lang dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setIsLangOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const switchLanguage = (lang: string) => {
    setLanguage(lang);
    if (problem) {
      setCode(problem.starterCode?.[lang] || DEFAULT_STARTER[lang]?.(problem.functionName) || `// ${lang}\n`);
    }
    setIsLangOpen(false);
    setResults(null);
    setSubmitVerdict(null);
  };



  const executeCode = useCallback(async (isSubmit: boolean) => {
    if (!problem) return;
    if (isSubmit) setIsSubmitting(true); else setIsRunning(true);
    setResults(null);
    setSubmitVerdict(null);

    const testCasesToRun = isSubmit
      ? problem.testCases
      : problem.testCases.filter(tc => !tc.isHidden);

    try {
      const response = await fetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_code: code,
          language_id: LANG_IDS[language] || 71,
          mode: 'submit',
          testCases: testCasesToRun.map(tc => ({
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            isHidden: isSubmit ? tc.isHidden : false,
          })),
        }),
      });

      if (!response.ok) throw new Error('Compilation service error');
      const data = await response.json();

      if (data.error) throw new Error(data.error);

      setResults(data.cases || []);
      setConsoleTab('result');
      setActiveTestCase(0);

      if (isSubmit && data.summary) {
        setSubmitVerdict(data.summary);
        setShowVerdictModal(true);
        if (data.summary.verdict === 'AC') setIsAlreadySolved(true);

        // Save submission to Firestore
        if (user) {
          await addDoc(collection(db, 'practice_submissions'), {
            userId: user.uid,
            problemId: problem.id,
            language,
            code,
            verdict: data.summary.verdict,
            passed: data.summary.passed,
            total: data.summary.total,
            createdAt: serverTimestamp(),
          });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Execution failed';
      setResults([{
        caseNumber: 1,
        statusCode: 'CE',
        stdout: null,
        stderr: msg,
        expectedOutput: '',
        inputPreview: '',
        isHidden: false,
        time: null,
        memory: null,
      }]);
      setConsoleTab('result');
    } finally {
      setIsRunning(false);
      setIsSubmitting(false);
    }
  }, [problem, code, language, user]);



  // Keyboard shortcut: Ctrl/Cmd + Enter to run, Ctrl/Cmd + Shift + Enter to submit
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) executeCode(true);
        else executeCode(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [executeCode]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--bg-primary)]">
        <div className="loading-dots"><span /><span /><span /></div>
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[var(--bg-primary)] gap-4">
        <AlertTriangle size={32} className="text-[var(--text-faint)]" />
        <p className="text-[var(--text-tertiary)] text-[13px]">Problem not found.</p>
        <button onClick={() => router.push('/user/practice')} className="btn-secondary text-[12px]">Back to Practice</button>
      </div>
    );
  }

  const visibleTestCases = problem.testCases.filter(tc => !tc.isHidden);

  const msLeft = problem.visibleUntil ? problem.visibleUntil.seconds * 1000 - Date.now() : null;
  const daysLeft = msLeft !== null && msLeft > 0 ? Math.ceil(msLeft / 86400000) : null;
  const showExpiry = daysLeft !== null && daysLeft <= 3;

  const verdictLabel = (v: string) => {
    if (v === 'AC') return 'Accepted';
    if (v === 'WA') return 'Wrong Answer';
    if (v === 'TLE') return 'Time Limit Exceeded';
    if (v === 'CE') return 'Compilation Error';
    return 'Runtime Error';
  };

  return (
    <div className="flex flex-col h-[calc(100vh-50px)] bg-[var(--bg-primary)] overflow-hidden">
      {/* Verdict Modal */}
      {showVerdictModal && submitVerdict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-8 flex flex-col items-center gap-6">
            {submitVerdict.verdict === 'AC' ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-20 h-20 rounded-full bg-[#4CAF50]/10 flex items-center justify-center">
                  <Trophy size={36} className="text-[#4CAF50]" />
                </div>
                <h2 className="text-2xl font-bold text-[#4CAF50]">Accepted</h2>
                <p className="text-sm text-[var(--text-secondary)]">All test cases passed!</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-20 h-20 rounded-full bg-[#00A8E1]/10 flex items-center justify-center">
                  <XCircle size={36} className="text-[#00A8E1]" />
                </div>
                <h2 className="text-2xl font-bold text-[#00A8E1]">{verdictLabel(submitVerdict.verdict)}</h2>
                <p className="text-sm text-[var(--text-secondary)]">Keep going — you&apos;ve got this!</p>
              </div>
            )}

            {/* Score bar */}
            <div className="w-full space-y-2">
              <div className="flex justify-between text-xs text-[var(--text-faint)]">
                <span>Test cases</span>
                <span className="font-bold text-[var(--text-primary)]">{submitVerdict.passed} / {submitVerdict.total}</span>
              </div>
              <div className="w-full bg-[var(--bg-elevated)] rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full transition-all duration-700 ${submitVerdict.verdict === 'AC' ? 'bg-[#4CAF50]' : 'bg-[#00A8E1]'}`}
                  style={{ width: `${(submitVerdict.passed / submitVerdict.total) * 100}%` }}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 w-full pt-2">
              <button
                onClick={() => {
                  setShowVerdictModal(false);
                  setSubmitVerdict(null);
                  setResults(null);
                  setConsoleTab('testcases');
                }}
                className="flex-1 flex items-center justify-center gap-2 btn-secondary text-sm py-3 rounded-xl"
              >
                <RotateCcw size={15} /> Reattempt
              </button>
              <button
                onClick={() => router.push('/user/practice')}
                className="flex-1 flex items-center justify-center gap-2 btn-primary text-sm py-3 rounded-xl"
              >
                <ArrowLeft size={15} /> All Questions
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Main Split */}
      <div className="flex flex-1 overflow-hidden p-3 gap-3">
        {/* Left: Problem */}
        <div className="flex flex-col w-[45%] bg-[var(--bg-surface)] rounded-xl overflow-hidden border border-[var(--border-subtle)]">
          <div className="flex bg-[var(--bg-elevated)] px-4 text-[13px] font-medium border-b border-[var(--border-subtle)] items-center justify-between">
            <div className="px-4 py-2.5 border-b-2 border-[#4B8BBE] text-[var(--text-primary)] flex items-center gap-2">
              <BookOpen size={14} /> Question
              {isAlreadySolved && <CheckCircle2 size={14} className="text-[#4CAF50]" />}
            </div>
            {showExpiry && (
              <div className="flex items-center gap-1.5 mr-2 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 text-[11px] font-semibold">
                <Clock size={10} /> Expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <h1 className="text-xl font-bold text-[var(--text-primary)] leading-tight">{problem.title}</h1>
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${
                  problem.difficulty === 'Easy' ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' :
                  problem.difficulty === 'Hard' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                  'bg-amber-500/10 text-amber-400 border-amber-500/20'
                }`}>
                  {problem.difficulty}
                </span>
              </div>

              {/* Description */}
              <div
                className="text-[13px] text-[var(--text-secondary)] leading-[1.8] prose-sm max-w-none
                  [&_code]:bg-[var(--bg-elevated)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[12px] [&_code]:font-mono [&_code]:text-[var(--text-primary)]
                  [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_li]:mb-1 [&_strong]:text-[var(--text-primary)]"
                dangerouslySetInnerHTML={{ __html: problem.description }}
              />

              {/* Constraints */}
              {problem.constraints.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-[13px] font-bold text-[var(--text-primary)] mb-3">Constraints</h3>
                  <ul className="space-y-1.5">
                    {problem.constraints.map((c, i) => (
                      <li key={i} className="text-[12px] text-[var(--text-secondary)] font-mono flex items-start gap-2">
                        <span className="text-[var(--text-faint)] mt-0.5">•</span> {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Visible Test Cases as Examples */}
              {visibleTestCases.length > 0 && (
                <div className="mt-6 space-y-4">
                  <h3 className="text-[13px] font-bold text-[var(--text-primary)]">Examples</h3>
                  {visibleTestCases.map((tc, i) => (
                    <div key={i} className="border border-[var(--border-subtle)] rounded-lg overflow-hidden">
                      <div className="px-3 py-1.5 bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)]">
                        <p className="text-[11px] font-semibold text-[var(--text-faint)]">Example {i + 1}</p>
                      </div>
                      <div className="p-3 space-y-3">
                        <div>
                          <span className="text-[11px] text-[var(--text-faint)] font-semibold">Input</span>
                          <pre className="text-[12px] font-mono text-[var(--text-primary)] bg-[var(--bg-primary)] rounded-lg p-3 mt-1.5 whitespace-pre-wrap">{tc.input}</pre>
                        </div>
                        <div>
                          <span className="text-[11px] text-[var(--text-faint)] font-semibold">Output</span>
                          <pre className="text-[12px] font-mono text-teal-400 bg-[var(--bg-primary)] rounded-lg p-3 mt-1.5 whitespace-pre-wrap">{tc.expectedOutput}</pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Editor + Console */}
        <div className="flex flex-col w-[55%] gap-3">
          {/* Code Editor */}
          <div className="flex flex-col flex-1 bg-[var(--bg-surface)] rounded-xl overflow-hidden border border-[var(--border-subtle)]">
            <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)]">
              {/* Language Dropdown */}
              <div className="relative" ref={langRef}>
                <button
                  onClick={() => setIsLangOpen(!isLangOpen)}
                  className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface)] px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] transition-colors"
                >
                  <span className="font-medium">{language}</span>
                  <ChevronDown size={13} className={`transition-transform ${isLangOpen ? 'rotate-180' : ''}`} />
                </button>
                {isLangOpen && (
                  <div className="absolute top-full left-0 mt-1.5 w-44 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl shadow-xl z-50 py-1.5 overflow-hidden">
                    {SUPPORTED_LANGS.map(lang => (
                      <button
                        key={lang}
                        onClick={() => switchLanguage(lang)}
                        className={`w-full text-left px-4 py-2 text-[13px] hover:bg-[var(--bg-surface)] transition-colors ${
                          language === lang ? 'text-[#4B8BBE] font-semibold bg-[#4B8BBE]/5' : 'text-[var(--text-secondary)]'
                        }`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Run / Submit */}
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => executeCode(false)}
                  disabled={isRunning || isSubmitting}
                  className="flex items-center gap-1.5 bg-[#4CAF50] hover:bg-[#43A047] text-white px-4 py-1.5 rounded-lg text-[13px] font-semibold disabled:opacity-50 transition-colors"
                >
                  {isRunning ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                  Run
                </button>
                <button
                  onClick={() => executeCode(true)}
                  disabled={isRunning || isSubmitting}
                  className="flex items-center gap-1.5 bg-[#F59E0B] hover:bg-[#D97706] text-white px-4 py-1.5 rounded-lg text-[13px] font-semibold disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? <Loader2 size={13} className="animate-spin" /> : <CloudUpload size={13} />}
                  Submit
                </button>
              </div>
            </div>
            <MonacoEditor
              height="100%"
              language={MONACO_LANG[language] || 'plaintext'}
              theme="vs-dark"
              value={code}
              onChange={(v) => setCode(v || '')}
              options={{
                fontSize: 13,
                fontFamily: 'JetBrains Mono, Fira Code, Menlo, Monaco, monospace',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 4,
                padding: { top: 12, bottom: 12 },
                lineNumbersMinChars: 3,
                renderLineHighlight: 'line',
                cursorBlinking: 'smooth',
                smoothScrolling: true,
                contextmenu: false,
                quickSuggestions: false,
                suggestOnTriggerCharacters: false,
                parameterHints: { enabled: false },
                wordBasedSuggestions: 'off',
                codeLens: false,
                inlayHints: { enabled: 'off' },
                hover: { enabled: false },
                lightbulb: { enabled: 'off' as unknown as undefined },
              }}
            />
          </div>

          {/* Console */}
          <div className="h-64 bg-[var(--bg-surface)] rounded-xl overflow-hidden border border-[var(--border-subtle)] flex flex-col shrink-0">
            <div className="flex bg-[var(--bg-elevated)] px-3 text-[13px] font-medium border-b border-[var(--border-subtle)]">
              <button
                onClick={() => setConsoleTab('testcases')}
                className={`px-4 py-2.5 transition-colors border-b-2 ${consoleTab === 'testcases' ? 'text-[var(--text-primary)] border-[#4B8BBE]' : 'text-[var(--text-faint)] border-transparent hover:text-[var(--text-secondary)]'}`}
              >
                Testcases
              </button>
              <button
                onClick={() => setConsoleTab('result')}
                className={`px-4 py-2.5 transition-colors flex items-center gap-1.5 border-b-2 ${consoleTab === 'result' ? 'text-[var(--text-primary)] border-[#4B8BBE]' : 'text-[var(--text-faint)] border-transparent hover:text-[var(--text-secondary)]'}`}
              >
                Result
                {results && (
                  results.every(r => r.statusCode === 'AC')
                    ? <CheckCircle2 size={12} className="text-[#4CAF50]" />
                    : <XCircle size={12} className="text-[#00A8E1]" />
                )}
              </button>

            </div>

            {/* Test case selector tabs */}
            {(consoleTab === 'testcases' || consoleTab === 'result') && (
              <div className="flex px-4 pt-2.5 gap-1.5">
                {(consoleTab === 'testcases' ? visibleTestCases : (results || [])).map((item, i) => {
                  const isResult = consoleTab === 'result';
                  const r = isResult ? (item as RunResult) : null;
                  return (
                    <button
                      key={i}
                      onClick={() => setActiveTestCase(i)}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all flex items-center gap-1.5 ${
                        activeTestCase === i
                          ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm'
                          : 'text-[var(--text-faint)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/50'
                      }`}
                    >
                      {isResult && r && (
                        r.statusCode === 'AC'
                          ? <CheckCircle2 size={11} className="text-[#4CAF50]" />
                          : <XCircle size={11} className="text-[#00A8E1]" />
                      )}
                      Case {i + 1}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {consoleTab === 'testcases' && (
                <div className="space-y-3">
                  {visibleTestCases[activeTestCase] ? (
                    <>
                      <div>
                        <p className="text-[11px] text-[var(--text-faint)] font-semibold mb-1.5">Input</p>
                        <pre className="bg-[var(--bg-elevated)] p-3 rounded-lg font-mono text-[12px] text-[var(--text-primary)] whitespace-pre-wrap">
                          {visibleTestCases[activeTestCase].input}
                        </pre>
                      </div>
                      <div>
                        <p className="text-[11px] text-[var(--text-faint)] font-semibold mb-1.5">Expected Output</p>
                        <pre className="bg-[var(--bg-elevated)] p-3 rounded-lg font-mono text-[12px] text-teal-400 whitespace-pre-wrap">
                          {visibleTestCases[activeTestCase].expectedOutput}
                        </pre>
                      </div>
                    </>
                  ) : (
                    <p className="text-[var(--text-faint)] text-[12px] italic">No visible test cases.</p>
                  )}
                </div>
              )}

              {consoleTab === 'result' && (
                results ? (
                  <div>
                    {/* Summary */}
                    <div className="flex items-center justify-between mb-3">
                      <h3 className={`text-[13px] font-bold ${
                        results.every(r => r.statusCode === 'AC') ? 'text-[#4CAF50]' : 'text-[#00A8E1]'
                      }`}>
                        {results.every(r => r.statusCode === 'AC') ? 'All Passed' : 'Failed'}
                      </h3>
                      {results[activeTestCase]?.time && (
                        <span className="text-[11px] text-[var(--text-faint)] flex items-center gap-1">
                          <Clock size={10} />{results[activeTestCase].time}s
                        </span>
                      )}
                    </div>

                    {/* Active case detail */}
                    {results[activeTestCase] && (
                      <div className="space-y-3">
                        {results[activeTestCase].stderr ? (
                          <div className="p-3 bg-[#00A8E1]/5 text-[#00A8E1] rounded-lg text-[12px] font-mono border border-[#00A8E1]/20 whitespace-pre-wrap">
                            {results[activeTestCase].stderr}
                          </div>
                        ) : results[activeTestCase].isHidden ? (
                          <p className="text-[12px] text-[var(--text-faint)] italic">Hidden test case — output not shown.</p>
                        ) : (
                          <>
                            {results[activeTestCase].inputPreview && (
                              <div>
                                <p className="text-[11px] text-[var(--text-faint)] font-semibold mb-1.5">Input</p>
                                <pre className="bg-[var(--bg-elevated)] p-3 rounded-lg font-mono text-[12px] text-[var(--text-primary)] whitespace-pre-wrap">
                                  {results[activeTestCase].inputPreview}
                                </pre>
                              </div>
                            )}
                            <div>
                              <p className="text-[11px] text-[var(--text-faint)] font-semibold mb-1.5">Output</p>
                              <pre className="bg-[var(--bg-elevated)] p-3 rounded-lg font-mono text-[12px] text-[var(--text-primary)] whitespace-pre-wrap">
                                {results[activeTestCase].stdout || '(no output)'}
                              </pre>
                            </div>
                            <div>
                              <p className="text-[11px] text-[var(--text-faint)] font-semibold mb-1.5">Expected</p>
                              <pre className="bg-[var(--bg-elevated)] p-3 rounded-lg font-mono text-[12px] text-teal-400 whitespace-pre-wrap">
                                {results[activeTestCase].expectedOutput}
                              </pre>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-[var(--text-faint)] text-[13px] italic">Click Run to see results</p>
                  </div>
                )
              )}


            </div>
          </div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--border-subtle); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--border-active); }
      `}</style>
    </div>
  );
}
