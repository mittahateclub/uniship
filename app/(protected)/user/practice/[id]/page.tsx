'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import {
  Play, CloudUpload, ChevronDown, Code2, Clock, CheckCircle2, XCircle,
  BookOpen, ArrowLeft, AlertTriangle, Terminal, Loader2,
} from 'lucide-react';
import dynamic from 'next/dynamic';

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
  const [leftTab, setLeftTab] = useState<'description' | 'submissions'>('description');
  const [consoleTab, setConsoleTab] = useState<'testcases' | 'result'>('testcases');
  const [activeTestCase, setActiveTestCase] = useState(0);

  // Execution
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [results, setResults] = useState<RunResult[] | null>(null);
  const [submitVerdict, setSubmitVerdict] = useState<{
    verdict: string; passed: number; total: number;
  } | null>(null);



  // Load problem
  useEffect(() => {
    if (!id) return;
    (async () => {
      const snap = await getDoc(doc(db, 'practice_problems', id as string));
      if (snap.exists()) {
        const data = snap.data();
        setProblem({ id: snap.id, ...data } as Problem);
        setCode(data.starterCode?.['Python3'] || DEFAULT_STARTER['Python3'](data.functionName || 'solve'));
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
        setLeftTab('submissions');

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

  return (
    <div className="flex flex-col h-[calc(100vh-50px)] bg-[var(--bg-primary)] overflow-hidden">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/user/practice')}
            className="text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-2">
            <Code2 size={16} className="text-[#5E6AD2]" />
            <span className="text-[13px] font-bold text-[var(--text-primary)]">UniCode</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => executeCode(false)}
            disabled={isRunning || isSubmitting}
            className="flex items-center gap-1.5 bg-[#4CAF50] hover:bg-[#43A047] text-white px-4 py-1.5 rounded text-[12px] font-semibold disabled:opacity-50 transition-colors"
          >
            {isRunning ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            Run
          </button>
          <button
            onClick={() => executeCode(true)}
            disabled={isRunning || isSubmitting}
            className="flex items-center gap-1.5 bg-[#F59E0B] hover:bg-[#D97706] text-white px-4 py-1.5 rounded text-[12px] font-semibold disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? <Loader2 size={13} className="animate-spin" /> : <CloudUpload size={13} />}
            Submit
          </button>
        </div>

        <div className="text-[10px] text-[var(--text-faint)] flex items-center gap-2">
          <kbd className="px-1 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[9px]">⌘↵</kbd> Run
          <kbd className="px-1 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[9px]">⌘⇧↵</kbd> Submit
        </div>
      </div>

      {/* Main Split */}
      <div className="flex flex-1 overflow-hidden p-2 gap-2">
        {/* Left: Problem Description */}
        <div className="flex flex-col w-1/2 bg-[var(--bg-surface)] rounded-lg overflow-hidden border border-[var(--border-subtle)]">
          <div className="flex bg-[var(--bg-elevated)] px-2 text-[12px] font-medium border-b border-[var(--border-subtle)]">
            <button
              onClick={() => setLeftTab('description')}
              className={`px-4 py-2 border-t-2 transition-colors ${
                leftTab === 'description'
                  ? 'border-[#5E6AD2] text-[var(--text-primary)] bg-[var(--bg-surface)]'
                  : 'border-transparent text-[var(--text-faint)]'
              }`}
            >
              <BookOpen size={12} className="inline mr-1.5" />Description
            </button>
            <button
              onClick={() => setLeftTab('submissions')}
              className={`px-4 py-2 border-t-2 transition-colors ${
                leftTab === 'submissions'
                  ? 'border-[#5E6AD2] text-[var(--text-primary)] bg-[var(--bg-surface)]'
                  : 'border-transparent text-[var(--text-faint)]'
              }`}
            >
              <Clock size={12} className="inline mr-1.5" />Submissions
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
            {leftTab === 'description' ? (
              <div>
                <h1 className="text-lg font-bold text-[var(--text-primary)] mb-2">{problem.title}</h1>
                <span className={`text-[11px] font-bold ${DIFFICULTY_COLORS[problem.difficulty] || 'text-amber-400'}`}>
                  {problem.difficulty}
                </span>

                {/* Description */}
                <div
                  className="mt-4 text-[13px] text-[var(--text-secondary)] leading-relaxed prose-sm max-w-none
                    [&_code]:bg-[var(--bg-elevated)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[12px] [&_code]:font-mono [&_code]:text-[var(--text-primary)]
                    [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_li]:mb-1 [&_strong]:text-[var(--text-primary)]"
                  dangerouslySetInnerHTML={{ __html: problem.description }}
                />

                {/* Constraints */}
                {problem.constraints.length > 0 && (
                  <div className="mt-5">
                    <h3 className="text-[12px] font-bold text-[var(--text-primary)] mb-2">Constraints</h3>
                    <ul className="space-y-1">
                      {problem.constraints.map((c, i) => (
                        <li key={i} className="text-[12px] text-[var(--text-secondary)] font-mono">
                          • {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Visible Test Cases as Examples */}
                {visibleTestCases.length > 0 && (
                  <div className="mt-5 space-y-4">
                    <h3 className="text-[12px] font-bold text-[var(--text-primary)]">Examples</h3>
                    {visibleTestCases.map((tc, i) => (
                      <div key={i} className="border border-[var(--border-subtle)] rounded p-3 bg-[var(--bg-elevated)]">
                        <p className="text-[10px] font-bold text-[var(--text-faint)] mb-2">Example {i + 1}</p>
                        <div className="space-y-2">
                          <div>
                            <span className="text-[10px] text-[var(--text-faint)] font-semibold">Input:</span>
                            <pre className="text-[11px] font-mono text-[var(--text-primary)] bg-[var(--bg-primary)] rounded p-2 mt-1 whitespace-pre-wrap">{tc.input}</pre>
                          </div>
                          <div>
                            <span className="text-[10px] text-[var(--text-faint)] font-semibold">Output:</span>
                            <pre className="text-[11px] font-mono text-[var(--text-primary)] bg-[var(--bg-primary)] rounded p-2 mt-1 whitespace-pre-wrap">{tc.expectedOutput}</pre>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Submissions Tab */
              <div className="flex flex-col items-center justify-center h-full text-center">
                {submitVerdict ? (
                  <div className="w-full text-left p-4 bg-[var(--bg-elevated)] rounded-lg border border-[var(--border-subtle)]">
                    <h2 className={`text-xl font-bold mb-2 ${
                      submitVerdict.verdict === 'AC' ? 'text-[#4CAF50]' : 'text-[#F54E00]'
                    }`}>
                      {submitVerdict.verdict === 'AC' ? 'Accepted' : submitVerdict.verdict === 'WA' ? 'Wrong Answer' : submitVerdict.verdict === 'TLE' ? 'Time Limit Exceeded' : submitVerdict.verdict === 'CE' ? 'Compilation Error' : 'Runtime Error'}
                    </h2>
                    <p className="text-[13px] text-[var(--text-secondary)]">
                      {submitVerdict.passed}/{submitVerdict.total} test cases passed
                    </p>
                    <div className="mt-3 w-full bg-[var(--bg-primary)] rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${submitVerdict.verdict === 'AC' ? 'bg-[#4CAF50]' : 'bg-[#F54E00]'}`}
                        style={{ width: `${(submitVerdict.passed / submitVerdict.total) * 100}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-[var(--text-faint)] text-[13px] italic">No submissions yet for this session.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Editor + Console */}
        <div className="flex flex-col w-1/2 gap-2">
          {/* Code Editor */}
          <div className="flex flex-col flex-1 bg-[var(--bg-surface)] rounded-lg overflow-hidden border border-[var(--border-subtle)]">
            <div className="flex items-center justify-between px-3 py-2 bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)]">
              {/* Language Dropdown */}
              <div className="relative" ref={langRef}>
                <button
                  onClick={() => setIsLangOpen(!isLangOpen)}
                  className="flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface)] px-2.5 py-1 rounded border border-[var(--border-subtle)] transition-colors"
                >
                  <span>{language}</span>
                  <ChevronDown size={12} />
                </button>
                {isLangOpen && (
                  <div className="absolute top-full left-0 mt-1 w-40 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded shadow-xl z-50 py-1">
                    {SUPPORTED_LANGS.map(lang => (
                      <button
                        key={lang}
                        onClick={() => switchLanguage(lang)}
                        className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-[var(--bg-surface)] transition-colors ${
                          language === lang ? 'text-[#5E6AD2] font-semibold' : 'text-[var(--text-secondary)]'
                        }`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-[var(--text-faint)]">
                <Terminal size={10} />
                <span>Judge0</span>
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
          <div className="h-64 bg-[var(--bg-surface)] rounded-lg overflow-hidden border border-[var(--border-subtle)] flex flex-col shrink-0">
            <div className="flex bg-[var(--bg-elevated)] px-2 text-[12px] font-medium border-b border-[var(--border-subtle)]">
              <button
                onClick={() => setConsoleTab('testcases')}
                className={`px-3 py-2 transition-colors ${consoleTab === 'testcases' ? 'text-[var(--text-primary)]' : 'text-[var(--text-faint)]'}`}
              >
                Testcases
              </button>
              <button
                onClick={() => setConsoleTab('result')}
                className={`px-3 py-2 transition-colors flex items-center gap-1 ${consoleTab === 'result' ? 'text-[var(--text-primary)]' : 'text-[var(--text-faint)]'}`}
              >
                Result
                {results && (
                  results.every(r => r.statusCode === 'AC')
                    ? <CheckCircle2 size={11} className="text-[#4CAF50]" />
                    : <XCircle size={11} className="text-[#F54E00]" />
                )}
              </button>

            </div>

            {/* Test case selector tabs */}
            {(consoleTab === 'testcases' || consoleTab === 'result') && (
              <div className="flex px-3 pt-2 gap-1">
                {(consoleTab === 'testcases' ? visibleTestCases : (results || [])).map((item, i) => {
                  const isResult = consoleTab === 'result';
                  const r = isResult ? (item as RunResult) : null;
                  return (
                    <button
                      key={i}
                      onClick={() => setActiveTestCase(i)}
                      className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors flex items-center gap-1 ${
                        activeTestCase === i
                          ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                          : 'text-[var(--text-faint)] hover:text-[var(--text-secondary)]'
                      }`}
                    >
                      {isResult && r && (
                        r.statusCode === 'AC'
                          ? <CheckCircle2 size={10} className="text-[#4CAF50]" />
                          : <XCircle size={10} className="text-[#F54E00]" />
                      )}
                      Case {i + 1}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
              {consoleTab === 'testcases' && (
                <div className="space-y-3">
                  {visibleTestCases[activeTestCase] ? (
                    <>
                      <div>
                        <p className="text-[10px] text-[var(--text-faint)] font-semibold mb-1">Input</p>
                        <pre className="bg-[var(--bg-elevated)] p-2 rounded font-mono text-[11px] text-[var(--text-primary)] whitespace-pre-wrap">
                          {visibleTestCases[activeTestCase].input}
                        </pre>
                      </div>
                      <div>
                        <p className="text-[10px] text-[var(--text-faint)] font-semibold mb-1">Expected Output</p>
                        <pre className="bg-[var(--bg-elevated)] p-2 rounded font-mono text-[11px] text-teal-400 whitespace-pre-wrap">
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
                        results.every(r => r.statusCode === 'AC') ? 'text-[#4CAF50]' : 'text-[#F54E00]'
                      }`}>
                        {results.every(r => r.statusCode === 'AC') ? 'All Passed' : 'Failed'}
                      </h3>
                      {results[activeTestCase]?.time && (
                        <span className="text-[10px] text-[var(--text-faint)]">
                          <Clock size={9} className="inline mr-1" />{results[activeTestCase].time}s
                        </span>
                      )}
                    </div>

                    {/* Active case detail */}
                    {results[activeTestCase] && (
                      <div className="space-y-2">
                        {results[activeTestCase].stderr ? (
                          <div className="p-2.5 bg-[#F54E00]/5 text-[#F54E00] rounded text-[11px] font-mono border border-[#F54E00]/20 whitespace-pre-wrap">
                            {results[activeTestCase].stderr}
                          </div>
                        ) : results[activeTestCase].isHidden ? (
                          <p className="text-[12px] text-[var(--text-faint)] italic">Hidden test case — output not shown.</p>
                        ) : (
                          <>
                            {results[activeTestCase].inputPreview && (
                              <div>
                                <p className="text-[10px] text-[var(--text-faint)] font-semibold mb-1">Input</p>
                                <pre className="bg-[var(--bg-elevated)] p-2 rounded font-mono text-[11px] text-[var(--text-primary)] whitespace-pre-wrap">
                                  {results[activeTestCase].inputPreview}
                                </pre>
                              </div>
                            )}
                            <div>
                              <p className="text-[10px] text-[var(--text-faint)] font-semibold mb-1">Output</p>
                              <pre className="bg-[var(--bg-elevated)] p-2 rounded font-mono text-[11px] text-[var(--text-primary)] whitespace-pre-wrap">
                                {results[activeTestCase].stdout || '(no output)'}
                              </pre>
                            </div>
                            <div>
                              <p className="text-[10px] text-[var(--text-faint)] font-semibold mb-1">Expected</p>
                              <pre className="bg-[var(--bg-elevated)] p-2 rounded font-mono text-[11px] text-teal-400 whitespace-pre-wrap">
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
                    <p className="text-[var(--text-faint)] text-[12px] italic">Click Run to see results</p>
                  </div>
                )
              )}


            </div>
          </div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--border-subtle); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--border-active); }
      `}</style>
    </div>
  );
}
