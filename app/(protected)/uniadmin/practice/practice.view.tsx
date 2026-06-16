'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import {
  addDoc, collection, doc, getDoc, getDocs, query, where, deleteDoc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { generatePracticeProblem } from '@/app/actions/generate-practice-problem';
import {
  Sparkles, Plus, Trash2, ChevronDown, ChevronUp, Code2, Clock,
  CheckCircle2, AlertTriangle, BookOpen, Keyboard, Eye, EyeOff, Pencil,
  CalendarClock,
} from '@/components/icons';
import { ListSkeleton } from '@/components/Skeleton';

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
  visibleUntil: { seconds: number } | null;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: 'bg-[var(--status-success)]/10 text-[var(--status-success)] border-[var(--status-success)]/20',
  Medium: 'bg-[var(--status-warning)]/10 text-[var(--status-warning)] border-[var(--status-warning)]/20',
  Hard: 'bg-[var(--status-danger)]/10 text-[var(--status-danger)] border-[var(--status-danger)]/20',
};

// 30-minute time slots in 12-hour format
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? '00' : '30';
  const hh = String(h).padStart(2, '0');
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return { value: `${hh}:${m}`, label: `${h12}:${m} ${period}` };
});

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
    visibleUntil: '',
  };
}

export default function AdminPracticePage() {
  const { user, loading: authLoading } = useAuth();
  const [universityId, setUniversityId] = useState<string | null>(null);
  const [problems, setProblems] = useState<PracticeProblem[]>([]);
  const [loading, setLoading] = useState(true);

  // Creation mode
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createMode, setCreateMode] = useState<'ai' | 'manual'>('ai');
  const [aiTopic, setAiTopic] = useState('');
  const [aiTitle, setAiTitle] = useState('');
  const [aiDifficulty, setAiDifficulty] = useState('Medium');
  const [aiVisibleUntil, setAiVisibleUntil] = useState('');
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
      const result = await generatePracticeProblem(aiTopic, {
        title: aiTitle.trim() || undefined,
        difficulty: aiDifficulty,
      });
      if (!result.success || !result.problem) {
        setStatus({ type: 'error', message: result.error || 'Generation failed.' });
        return;
      }
      const p = result.problem;
      setForm({
        title: aiTitle.trim() || p.title,
        difficulty: aiDifficulty || p.difficulty,
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
        visibleUntil: aiVisibleUntil,
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
        visibleUntil: form.visibleUntil ? new Date(form.visibleUntil) : null,
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
        visibleUntil: form.visibleUntil ? { seconds: Math.floor(new Date(form.visibleUntil).getTime() / 1000) } : null,
      }, ...prev]);

      setForm(emptyProblem());
      setMode('list');
      setAiTopic('');
      setAiTitle('');
      setAiDifficulty('Medium');
      setAiVisibleUntil('');
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

  const handleEdit = (problem: PracticeProblem) => {
    setEditingId(problem.id);
    setForm({
      title: problem.title,
      difficulty: problem.difficulty,
      description: problem.description,
      functionName: problem.functionName,
      constraints: problem.constraints.length ? problem.constraints : [''],
      inputFormat: problem.inputFormat || '',
      outputFormat: problem.outputFormat || '',
      starterCode: {
        'Python3': problem.starterCode?.['Python3'] || '',
        'JavaScript': problem.starterCode?.['JavaScript'] || '',
        'Java': problem.starterCode?.['Java'] || '',
        'C++': problem.starterCode?.['C++'] || '',
      },
      testCases: problem.testCases.length ? problem.testCases : [{ input: '', expectedOutput: '', isHidden: false }],
      visibleUntil: problem.visibleUntil ? new Date(problem.visibleUntil.seconds * 1000).toISOString().slice(0, 16) : '',
    });
    setMode('edit');
    setStatus({ type: '', message: '' });
  };

  const handleUpdate = async () => {
    if (!editingId || !user || !universityId) return;
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
      setStatus({ type: 'info', message: 'Updating problem...' });
      const starterCode: Record<string, string> = { ...form.starterCode };
      for (const lang of Object.keys(STARTER_TEMPLATES) as Array<keyof typeof STARTER_TEMPLATES>) {
        if (!starterCode[lang]?.trim()) {
          starterCode[lang] = STARTER_TEMPLATES[lang](form.functionName);
        }
      }
      const updateData = {
        title: form.title.trim(),
        difficulty: form.difficulty,
        description: form.description.trim(),
        functionName: form.functionName.trim(),
        constraints: form.constraints.filter(c => c.trim()),
        inputFormat: form.inputFormat.trim(),
        outputFormat: form.outputFormat.trim(),
        starterCode,
        testCases: validTestCases,
        visibleUntil: form.visibleUntil ? new Date(form.visibleUntil) : null,
      };
      await updateDoc(doc(db, 'practice_problems', editingId), updateData);
      setProblems(prev => prev.map(p => p.id === editingId ? {
        ...p,
        ...updateData,
        visibleUntil: form.visibleUntil ? { seconds: Math.floor(new Date(form.visibleUntil).getTime() / 1000) } : null,
      } : p));
      setMode('list');
      setEditingId(null);
      setForm(emptyProblem());
      setStatus({ type: 'success', message: `Updated "${form.title.trim()}" successfully!` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update.';
      setStatus({ type: 'error', message: msg });
    }
  };

  if (authLoading || loading) {
    return <ListSkeleton withStats rows={6} />;
  }

  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in">
      <div className="pt-8 mb-7 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-semibold text-[var(--text-primary)] tracking-[-0.025em]">Practice Problems</h1>
          <p className="text-[var(--text-tertiary)] text-[13.5px] mt-1.5">
            {mode === 'list' ? `${problems.length} problem${problems.length !== 1 ? 's' : ''} published` : mode === 'edit' ? 'Edit practice problem' : 'Create a new practice problem'}
          </p>
        </div>
        <button
          onClick={() => { if (mode === 'list') { setMode('create'); setForm(emptyProblem()); setEditingId(null); } else { setMode('list'); } setStatus({ type: '', message: '' }); }}
          className={mode === 'list' ? 'btn-primary !rounded-[10px] text-[12.5px] !px-3.5 !py-2 flex items-center gap-1.5' : 'btn-secondary !rounded-[10px] text-[12.5px] !px-3.5 !py-2'}
        >
          {mode === 'list' ? <><Plus size={13} /> New Problem</> : 'Back to List'}
        </button>
      </div>

      {status.message && (
        <div className={`mb-4 p-3 rounded-[var(--radius)] text-[13px] font-medium border ${
          status.type === 'error' ? 'bg-[var(--status-danger)]/10 text-[var(--status-danger)] border-[var(--status-danger)]/20'
          : status.type === 'success' ? 'bg-[var(--status-success)]/10 text-[var(--status-success)] border-[var(--status-success)]/20'
          : 'bg-[var(--type-event)]/10 text-[var(--type-event)] border-[var(--type-event)]/20'
        }`}>
          {status.message}
        </div>
      )}

      {mode === 'list' ? (
        /* ── Problem List ── */
        problems.length === 0 ? (
          <div className="text-center py-16 border border-[var(--border-subtle)] rounded-[var(--radius)] bg-[var(--bg-surface)]">
            <Code2 size={26} className="mx-auto mb-3 text-[var(--text-faint)]" />
            <p className="text-[var(--text-primary)] text-[13px] font-medium">No practice problems yet</p>
            <p className="text-[var(--text-faint)] text-[12px] mt-1">Click “New Problem” to create your first one.</p>
          </div>
        ) : (
          <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
            {problems.map((p, idx) => {
              const expired = !!(p.visibleUntil && p.visibleUntil.seconds * 1000 < Date.now());
              return (
                <div key={p.id} className="group flex items-center gap-3 px-4 sm:px-5 py-4 border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-elevated)] transition-colors duration-150">
                  <span className="text-[12px] font-mono text-[var(--text-faint)] w-5 text-right shrink-0 tabular-nums">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-semibold text-[var(--text-primary)] tracking-[-0.01em] truncate">{p.title}</p>
                    <div className="flex items-center gap-x-3 gap-y-0.5 flex-wrap mt-1 text-[11.5px] text-[var(--text-faint)]">
                      <span className={`text-[10.5px] font-semibold px-2 py-[2px] rounded-full ${DIFFICULTY_COLORS[p.difficulty] || DIFFICULTY_COLORS['Medium']}`}>{p.difficulty}</span>
                      <span>{p.testCases.length} test case{p.testCases.length !== 1 ? 's' : ''}</span>
                      <span>fn: <code className="text-[var(--text-secondary)] font-mono">{p.functionName}</code></span>
                      {p.visibleUntil ? (
                        <span className={`inline-flex items-center gap-1 text-[10.5px] font-medium px-2 py-[2px] rounded-full ${
                          expired ? 'bg-[var(--status-danger)]/10 text-[var(--status-danger)]' : 'bg-[var(--status-success)]/10 text-[var(--status-success)]'
                        }`}>
                          <CalendarClock size={9} />
                          {expired ? 'Expired' : `Until ${new Date(p.visibleUntil.seconds * 1000).toLocaleDateString()}`}
                        </span>
                      ) : (
                        <span className="text-[10.5px] font-medium px-2 py-[2px] rounded-full bg-[var(--bg-elevated)] text-[var(--text-faint)]">Always visible</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button onClick={() => handleEdit(p)} className="p-2 rounded-full text-[var(--text-faint)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors" title="Edit problem">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="p-2 rounded-full text-[var(--text-faint)] hover:text-[var(--status-danger)] hover:bg-[var(--status-danger)]/10 transition-colors" title="Delete problem">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* ── Create Mode ── */
        <div className="space-y-4">
          {/* Mode Toggle — hide when editing */}
          {mode !== 'edit' && (
          <div className="window p-4">
            <div className="inline-flex rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1">
              <button
                onClick={() => setCreateMode('ai')}
                className={`px-4 py-2 text-[13px] font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                  createMode === 'ai' ? 'bg-[var(--type-event)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
                }`}
              >
                <Sparkles size={13} /> AI Generate
              </button>
              <button
                onClick={() => setCreateMode('manual')}
                className={`px-4 py-2 text-[13px] font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                  createMode === 'manual' ? 'bg-[var(--type-event)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
                }`}
              >
                <Keyboard size={13} /> Manual Entry
              </button>
            </div>
          </div>
          )}

          {/* AI Input */}
          {createMode === 'ai' && mode !== 'edit' && (
            <div className="window p-5 space-y-4">
              {/* Pre-set fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-[var(--text-secondary)] mb-1 block">Question Name (optional)</label>
                  <input
                    value={aiTitle}
                    onChange={e => setAiTitle(e.target.value)}
                    placeholder="e.g. Two Sum Challenge"
                    className="w-full px-3 py-2 text-[13px] rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--border-active)]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[var(--text-secondary)] mb-1 block">Difficulty Level</label>
                  <select
                    value={aiDifficulty}
                    onChange={e => setAiDifficulty(e.target.value)}
                    className="w-full px-3 py-2 text-[13px] rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-active)]"
                  >
                    <option>Easy</option>
                    <option>Medium</option>
                    <option>Hard</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium text-[var(--text-secondary)] mb-1 flex items-center gap-1">
                  <CalendarClock size={11} /> Visible Until (optional)
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={aiVisibleUntil.split('T')[0] || ''}
                    onChange={e => {
                      const date = e.target.value;
                      const time = aiVisibleUntil.split('T')[1] || '23:30';
                      setAiVisibleUntil(date ? `${date}T${time}` : '');
                    }}
                    className="flex-1 px-3 py-2 text-[13px] rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-active)]"
                  />
                  <select
                    value={TIME_OPTIONS.some(o => o.value === aiVisibleUntil.split('T')[1]) ? aiVisibleUntil.split('T')[1] : '23:30'}
                    onChange={e => {
                      const date = aiVisibleUntil.split('T')[0] || '';
                      setAiVisibleUntil(date ? `${date}T${e.target.value}` : '');
                    }}
                    disabled={!aiVisibleUntil.split('T')[0]}
                    className="w-36 px-3 py-2 text-[13px] rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-active)] disabled:opacity-40"
                  >
                    {TIME_OPTIONS.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  {aiVisibleUntil && (
                    <button
                      onClick={() => setAiVisibleUntil('')}
                      className="text-[11px] text-[var(--accent-orange)] font-medium hover:underline whitespace-nowrap"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-[var(--text-faint)] mt-0.5">Leave blank for no expiry</p>
              </div>

              <div>
                <label className="text-[12px] font-medium text-[var(--text-secondary)] mb-1 block">Topic or Problem Link</label>
                <div className="flex gap-2">
                  <input
                    value={aiTopic}
                    onChange={e => setAiTopic(e.target.value)}
                    placeholder="e.g. Two Sum, Binary Search Tree Traversal, or paste a URL..."
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
                <p className="text-[11px] text-[var(--text-faint)] mt-1">
                  AI will create a full problem with description, starter code, and test cases. You can review and edit before publishing.
                </p>
              </div>
            </div>
          )}

          {/* Manual / Review Form */}
          {(createMode === 'manual' || mode === 'edit') && (
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

                {/* Visible Until */}
                <div>
                  <label className="text-[11px] font-medium text-[var(--text-secondary)] mb-1 flex items-center gap-1">
                    <CalendarClock size={11} /> Visible Until
                  </label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="date"
                      value={form.visibleUntil.split('T')[0] || ''}
                      onChange={e => {
                        const date = e.target.value;
                        const time = form.visibleUntil.split('T')[1] || '23:30';
                        setForm({ ...form, visibleUntil: date ? `${date}T${time}` : '' });
                      }}
                      className="flex-1 px-3 py-2 text-[13px] rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-active)]"
                    />
                    <select
                      value={TIME_OPTIONS.some(o => o.value === form.visibleUntil.split('T')[1]) ? form.visibleUntil.split('T')[1] : '23:30'}
                      onChange={e => {
                        const date = form.visibleUntil.split('T')[0] || '';
                        setForm({ ...form, visibleUntil: date ? `${date}T${e.target.value}` : '' });
                      }}
                      disabled={!form.visibleUntil.split('T')[0]}
                      className="w-36 px-3 py-2 text-[13px] rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-active)] disabled:opacity-40"
                    >
                      {TIME_OPTIONS.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    {form.visibleUntil && (
                      <button
                        onClick={() => setForm({ ...form, visibleUntil: '' })}
                        className="text-[11px] text-[var(--accent-orange)] font-medium hover:underline whitespace-nowrap"
                      >
                        Clear expiry
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-[var(--text-faint)] mt-0.5">
                    Students will not see this problem after this date/time. Leave blank for no expiry.
                  </p>
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
                    className="text-[11px] text-[var(--type-event)] font-medium hover:underline flex items-center gap-1"
                  >
                    <Plus size={11} /> Add Test Case
                  </button>
                </div>
                <div className="space-y-2">
                  {form.testCases.map((tc, idx) => (
                    <div key={idx} className="border border-[var(--border-subtle)] rounded p-3 bg-[var(--bg-elevated)]">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold text-[var(--text-faint)]">Case {idx + 1}</span>
                          <button
                            onClick={() => {
                              const updated = [...form.testCases];
                              updated[idx] = { ...updated[idx], isHidden: !updated[idx].isHidden };
                              setForm({ ...form, testCases: updated });
                            }}
                            className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${
                              tc.isHidden ? 'bg-[var(--status-warning)]/10 text-[var(--status-warning)]' : 'bg-[var(--status-success)]/10 text-[var(--status-success)]'
                            }`}
                          >
                            {tc.isHidden ? <><EyeOff size={9} /> Hidden</> : <><Eye size={9} /> Visible</>}
                          </button>
                        </div>
                        {form.testCases.length > 1 && (
                          <button
                            onClick={() => setForm({ ...form, testCases: form.testCases.filter((_, i) => i !== idx) })}
                            className="text-[var(--text-faint)] hover:text-[var(--accent-orange)]"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9px] font-semibold text-[var(--text-faint)] uppercase mb-1 block">Input (stdin)</label>
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
                          <label className="text-[9px] font-semibold text-[var(--text-faint)] uppercase mb-1 block">Expected Output</label>
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

              {/* Publish / Update */}
              <button onClick={mode === 'edit' ? handleUpdate : handlePublish} className="btn-primary w-full flex items-center justify-center gap-2">
                <BookOpen size={14} /> {mode === 'edit' ? 'Update Problem' : 'Publish Problem'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
