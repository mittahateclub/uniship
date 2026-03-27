'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import {
  addDoc, collection, doc, getDoc, getDocs, query, where, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { generatePracticeProblem } from '@/app/actions/generate-practice-problem';
import {
  Sparkles, Plus, Trash2, ChevronDown, ChevronUp, Code2, Clock,
  CheckCircle2, AlertTriangle, BookOpen, Keyboard, Eye, EyeOff,
} from 'lucide-react';

interface TestCase {
  input: string;
  expectedOutput: string;
  isHidden: boolean;
}

interface PracticeProblem {
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
  universityId: string;
  createdBy: string;
  createdAt: { seconds: number } | null;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  Medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Hard: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const STARTER_TEMPLATES: Record<string, (fn: string) => string> = {
  'Python3': (fn) => `class Solution:\n    def ${fn}(self):\n        pass`,
  'JavaScript': (fn) => `/**\n * @return {any}\n */\nvar ${fn} = function() {\n    \n};`,
  'Java': (fn) => `class Solution {\n    public void ${fn}() {\n        \n    }\n}`,
  'C++': (fn) => `class Solution {\npublic:\n    void ${fn}() {\n        \n    }\n};`,
};

function emptyProblem() {
  return {
    title: '',
    difficulty: 'Medium',
    description: '',
    functionName: '',
    constraints: [''],
    inputFormat: '',
    outputFormat: '',
    starterCode: {
      'Python3': '',
      'JavaScript': '',
      'Java': '',
      'C++': '',
    },
    testCases: [
      { input: '', expectedOutput: '', isHidden: false },
      { input: '', expectedOutput: '', isHidden: false },
      { input: '', expectedOutput: '', isHidden: true },
    ],
  };
}

export default function AdminPracticePage() {
  const { user, loading: authLoading } = useAuth();
  const [universityId, setUniversityId] = useState<string | null>(null);
  const [problems, setProblems] = useState<PracticeProblem[]>([]);
  const [loading, setLoading] = useState(true);

  // Creation mode
  const [mode, setMode] = useState<'list' | 'create'>('list');
  const [createMode, setCreateMode] = useState<'ai' | 'manual'>('ai');
  const [aiTopic, setAiTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState<{ type: string; message: string }>({ type: '', message: '' });

  // Manual form
  const [form, setForm] = useState(emptyProblem());
  const [expandedStarter, setExpandedStarter] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) {
        const uid = snap.data().universityId;
        setUniversityId(uid);
        // Fetch existing problems
        const q2 = query(
          collection(db, 'practice_problems'),
          where('universityId', '==', uid),
        );
        const qs = await getDocs(q2);
        const items = qs.docs.map(d => ({ id: d.id, ...d.data() } as PracticeProblem));
        items.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
        setProblems(items);
      }
      setLoading(false);
    })();
  }, [user]);

  const handleAIGenerate = async () => {
    if (!aiTopic.trim()) return;
    setIsGenerating(true);
    setStatus({ type: 'info', message: 'AI is generating the problem...' });
    try {
      const result = await generatePracticeProblem(aiTopic);
      if (!result.success || !result.problem) {
        setStatus({ type: 'error', message: result.error || 'Generation failed.' });
        return;
      }
      const p = result.problem;
      setForm({
        title: p.title,
        difficulty: p.difficulty,
        description: p.description,
        functionName: p.functionName,
        constraints: p.constraints.length ? p.constraints : [''],
        inputFormat: p.inputFormat,
        outputFormat: p.outputFormat,
        starterCode: {
          'Python3': p.starterCode['Python3'] || STARTER_TEMPLATES['Python3'](p.functionName),
          'JavaScript': p.starterCode['JavaScript'] || STARTER_TEMPLATES['JavaScript'](p.functionName),
          'Java': p.starterCode['Java'] || STARTER_TEMPLATES['Java'](p.functionName),
          'C++': p.starterCode['C++'] || STARTER_TEMPLATES['C++'](p.functionName),
        },
        testCases: p.testCases.map(tc => ({
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          isHidden: tc.isHidden,
        })),
      });
      setCreateMode('manual');
      setStatus({ type: 'success', message: 'Problem generated! Review and edit below, then publish.' });
    } catch {
      setStatus({ type: 'error', message: 'AI generation failed.' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!user || !universityId) {
      setStatus({ type: 'error', message: 'Unable to identify university.' });
      return;
    }
    if (!form.title.trim() || !form.functionName.trim()) {
      setStatus({ type: 'error', message: 'Title and function name are required.' });
      return;
    }
    const validTestCases = form.testCases.filter(tc => tc.expectedOutput.trim());
    if (validTestCases.length < 2) {
      setStatus({ type: 'error', message: 'At least 2 test cases with expected outputs are required.' });
      return;
    }

    try {
      setStatus({ type: 'info', message: 'Publishing problem...' });

      // Fill in starter code defaults for any empty languages
      const starterCode: Record<string, string> = { ...form.starterCode };
      for (const lang of Object.keys(STARTER_TEMPLATES) as Array<keyof typeof STARTER_TEMPLATES>) {
        if (!starterCode[lang]?.trim()) {
          starterCode[lang] = STARTER_TEMPLATES[lang](form.functionName);
        }
      }

      const docRef = await addDoc(collection(db, 'practice_problems'), {
        title: form.title.trim(),
        difficulty: form.difficulty,
        description: form.description.trim(),
        functionName: form.functionName.trim(),
        constraints: form.constraints.filter(c => c.trim()),
        inputFormat: form.inputFormat.trim(),
        outputFormat: form.outputFormat.trim(),
        starterCode,
        testCases: validTestCases,
        universityId,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });

      setProblems(prev => [{
        id: docRef.id,
        title: form.title.trim(),
        difficulty: form.difficulty,
        description: form.description.trim(),
        functionName: form.functionName.trim(),
        constraints: form.constraints.filter(c => c.trim()),
        inputFormat: form.inputFormat.trim(),
        outputFormat: form.outputFormat.trim(),
        starterCode,
        testCases: validTestCases,
        universityId,
        createdBy: user.uid,
        createdAt: { seconds: Math.floor(Date.now() / 1000) },
      }, ...prev]);

      setForm(emptyProblem());
      setMode('list');
      setAiTopic('');
      setStatus({ type: 'success', message: `Published "${form.title.trim()}" successfully!` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to publish.';
      setStatus({ type: 'error', message: msg });
    }
  };

  const handleDelete = async (problemId: string) => {
    if (!confirm('Delete this problem? Students will lose access.')) return;
    try {
      await deleteDoc(doc(db, 'practice_problems', problemId));
      setProblems(prev => prev.filter(p => p.id !== problemId));
    } catch {
      setStatus({ type: 'error', message: 'Failed to delete problem.' });
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-dots"><span /><span /><span /></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-[-0.02em]">Practice Problems</h1>
          <p className="text-[var(--text-tertiary)] text-[13px] mt-1">
            {mode === 'list' ? `${problems.length} problem${problems.length !== 1 ? 's' : ''} published` : 'Create a new practice problem'}
          </p>
        </div>
        <button
          onClick={() => { setMode(mode === 'list' ? 'create' : 'list'); setStatus({ type: '', message: '' }); }}
          className={mode === 'list' ? 'btn-primary text-[12px] px-3 py-1.5 flex items-center gap-1.5' : 'btn-secondary text-[12px] px-3 py-1.5'}
        >
          {mode === 'list' ? <><Plus size={13} /> New Problem</> : 'Back to List'}
        </button>
      </div>

      {status.message && (
        <div className={`mb-4 p-3 rounded text-[13px] font-medium border ${
          status.type === 'error' ? 'bg-[#F54E00]/10 text-[#F54E00] border-[#F54E00]/20'
          : status.type === 'success' ? 'bg-[#4CAF50]/10 text-[#4CAF50] border-[#4CAF50]/20'
          : 'bg-[#5E6AD2]/10 text-[#5E6AD2] border-[#5E6AD2]/20'
        }`}>
          {status.message}
        </div>
      )}

      {mode === 'list' ? (
        /* ── Problem List ── */
        <div className="space-y-3">
          {problems.length === 0 ? (
            <div className="window p-12 text-center">
              <Code2 size={32} className="mx-auto mb-3 text-[var(--text-faint)]" />
              <p className="text-[var(--text-tertiary)] text-[13px]">No practice problems yet. Create your first one!</p>
            </div>
          ) : (
            problems.map((p, idx) => (
              <div key={p.id} className="window p-4 flex items-center justify-between group">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[12px] font-mono text-[var(--text-faint)] w-6 text-right shrink-0">{idx + 1}</span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{p.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${DIFFICULTY_COLORS[p.difficulty] || DIFFICULTY_COLORS['Medium']}`}>
                        {p.difficulty}
                      </span>
                      <span className="text-[11px] text-[var(--text-faint)]">
                        {p.testCases.length} test case{p.testCases.length !== 1 ? 's' : ''}
                      </span>
                      <span className="text-[11px] text-[var(--text-faint)]">
                        fn: <code className="text-[var(--text-secondary)]">{p.functionName}</code>
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="text-[var(--text-faint)] hover:text-[#F54E00] transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      ) : (
        /* ── Create Mode ── */
        <div className="space-y-4">
          {/* Mode Toggle */}
          <div className="window p-4">
            <div className="inline-flex rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1">
              <button
                onClick={() => setCreateMode('ai')}
                className={`px-4 py-2 text-[13px] font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                  createMode === 'ai' ? 'bg-[#5E6AD2] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
                }`}
              >
                <Sparkles size={13} /> AI Generate
              </button>
              <button
                onClick={() => setCreateMode('manual')}
                className={`px-4 py-2 text-[13px] font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                  createMode === 'manual' ? 'bg-[#5E6AD2] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
                }`}
              >
                <Keyboard size={13} /> Manual Entry
              </button>
            </div>
          </div>

          {/* AI Input */}
          {createMode === 'ai' && (
            <div className="window p-5 space-y-3">
              <label className="text-[12px] font-medium text-[var(--text-secondary)]">Topic or Problem Description</label>
              <div className="flex gap-2">
                <input
                  value={aiTopic}
                  onChange={e => setAiTopic(e.target.value)}
                  placeholder="e.g. Two Sum, Binary Search Tree Traversal, Dynamic Programming..."
                  className="flex-1 px-3 py-2 text-[13px] rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--border-active)] transition-colors"
                  onKeyDown={e => e.key === 'Enter' && handleAIGenerate()}
                />
                <button
                  onClick={handleAIGenerate}
                  disabled={isGenerating || !aiTopic.trim()}
                  className="btn-primary text-[12px] px-4 py-2 flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Sparkles size={13} />
                  {isGenerating ? 'Generating...' : 'Generate'}
                </button>
              </div>
              <p className="text-[11px] text-[var(--text-faint)]">
                AI will create a full problem with description, starter code, and test cases. You can review and edit before publishing.
              </p>
            </div>
          )}

          {/* Manual / Review Form */}
          {createMode === 'manual' && (
            <div className="space-y-4">
              {/* Title, Difficulty, Function Name */}
              <div className="window p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-[var(--text-secondary)] mb-1 block">Title</label>
                    <input
                      value={form.title}
                      onChange={e => setForm({ ...form, title: e.target.value })}
                      placeholder="e.g. Two Sum"
                      className="w-full px-3 py-2 text-[13px] rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--border-active)]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-[var(--text-secondary)] mb-1 block">Difficulty</label>
                    <select
                      value={form.difficulty}
                      onChange={e => setForm({ ...form, difficulty: e.target.value })}
                      className="w-full px-3 py-2 text-[13px] rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-active)]"
                    >
                      <option>Easy</option>
                      <option>Medium</option>
                      <option>Hard</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-[var(--text-secondary)] mb-1 block">Function Name</label>
                    <input
                      value={form.functionName}
                      onChange={e => setForm({ ...form, functionName: e.target.value })}
                      placeholder="e.g. twoSum"
                      className="w-full px-3 py-2 text-[13px] rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--border-active)] font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-[var(--text-secondary)] mb-1 block">Problem Description (HTML supported)</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    rows={6}
                    placeholder="<p>Given an array of integers <code>nums</code> and an integer <code>target</code>...</p>"
                    className="w-full px-3 py-2 text-[12px] rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--border-active)] resize-y font-mono"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-[var(--text-secondary)] mb-1 block">Input Format</label>
                    <textarea
                      value={form.inputFormat}
                      onChange={e => setForm({ ...form, inputFormat: e.target.value })}
                      rows={2}
                      placeholder="First line: array as Python list. Second line: target integer."
                      className="w-full px-3 py-2 text-[12px] rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--border-active)] resize-y"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-[var(--text-secondary)] mb-1 block">Output Format</label>
                    <textarea
                      value={form.outputFormat}
                      onChange={e => setForm({ ...form, outputFormat: e.target.value })}
                      rows={2}
                      placeholder="Array of two indices."
                      className="w-full px-3 py-2 text-[12px] rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--border-active)] resize-y"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-[var(--text-secondary)] mb-1 block">Constraints (one per line)</label>
                  <textarea
                    value={form.constraints.join('\n')}
                    onChange={e => setForm({ ...form, constraints: e.target.value.split('\n') })}
                    rows={2}
                    placeholder="1 <= nums.length <= 10^4&#10;-10^9 <= nums[i] <= 10^9"
                    className="w-full px-3 py-2 text-[12px] rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--border-active)] resize-y font-mono"
                  />
                </div>
              </div>

              {/* Starter Code */}
              <div className="window p-5 space-y-3">
                <h3 className="text-[12px] font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
                  <Code2 size={13} /> Starter Code
                </h3>
                <p className="text-[11px] text-[var(--text-faint)]">
                  Leave blank to auto-generate a default template from the function name.
                </p>
                <div className="space-y-2">
                  {Object.entries(form.starterCode).map(([lang, code]) => (
                    <div key={lang} className="border border-[var(--border-subtle)] rounded overflow-hidden">
                      <button
                        onClick={() => setExpandedStarter(expandedStarter === lang ? null : lang)}
                        className="w-full flex items-center justify-between px-3 py-2 bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)] transition-colors text-[12px] font-medium text-[var(--text-primary)]"
                      >
                        <span>{lang}</span>
                        {expandedStarter === lang ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                      {expandedStarter === lang && (
                        <textarea
                          value={code}
                          onChange={e => setForm({ ...form, starterCode: { ...form.starterCode, [lang]: e.target.value } })}
                          rows={6}
                          className="w-full px-3 py-2 text-[11px] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none resize-y font-mono border-t border-[var(--border-subtle)]"
                          placeholder={STARTER_TEMPLATES[lang]?.(form.functionName || 'solve') || '// Write starter code...'}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Test Cases */}
              <div className="window p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[12px] font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
                    <CheckCircle2 size={13} /> Test Cases
                  </h3>
                  <button
                    onClick={() => setForm({ ...form, testCases: [...form.testCases, { input: '', expectedOutput: '', isHidden: true }] })}
                    className="text-[11px] text-[#5E6AD2] font-medium hover:underline flex items-center gap-1"
                  >
                    <Plus size={11} /> Add Test Case
                  </button>
                </div>
                <div className="space-y-2">
                  {form.testCases.map((tc, idx) => (
                    <div key={idx} className="border border-[var(--border-subtle)] rounded p-3 bg-[var(--bg-elevated)]">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-[var(--text-faint)]">Case {idx + 1}</span>
                          <button
                            onClick={() => {
                              const updated = [...form.testCases];
                              updated[idx] = { ...updated[idx], isHidden: !updated[idx].isHidden };
                              setForm({ ...form, testCases: updated });
                            }}
                            className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${
                              tc.isHidden ? 'bg-amber-500/10 text-amber-400' : 'bg-teal-500/10 text-teal-400'
                            }`}
                          >
                            {tc.isHidden ? <><EyeOff size={9} /> Hidden</> : <><Eye size={9} /> Visible</>}
                          </button>
                        </div>
                        {form.testCases.length > 1 && (
                          <button
                            onClick={() => setForm({ ...form, testCases: form.testCases.filter((_, i) => i !== idx) })}
                            className="text-[var(--text-faint)] hover:text-[#F54E00]"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9px] font-bold text-[var(--text-faint)] uppercase mb-1 block">Input (stdin)</label>
                          <textarea
                            value={tc.input}
                            onChange={e => {
                              const updated = [...form.testCases];
                              updated[idx] = { ...updated[idx], input: e.target.value };
                              setForm({ ...form, testCases: updated });
                            }}
                            rows={2}
                            placeholder="[2, 7, 11, 15]&#10;9"
                            className="w-full px-2 py-1.5 text-[11px] rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-active)] font-mono resize-y"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-[var(--text-faint)] uppercase mb-1 block">Expected Output</label>
                          <textarea
                            value={tc.expectedOutput}
                            onChange={e => {
                              const updated = [...form.testCases];
                              updated[idx] = { ...updated[idx], expectedOutput: e.target.value };
                              setForm({ ...form, testCases: updated });
                            }}
                            rows={2}
                            placeholder="[0, 1]"
                            className="w-full px-2 py-1.5 text-[11px] rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-active)] font-mono resize-y"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Publish */}
              <button onClick={handlePublish} className="btn-primary w-full flex items-center justify-center gap-2">
                <BookOpen size={14} /> Publish Problem
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
