'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import {
  addDoc, collection, doc, getDoc, getDocs, query, where, deleteDoc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { generatePracticeProblem } from '@/app/actions/generate-practice-problem';
import Sparkles from '@/components/icons/Sparkles';
import Plus from '@/components/icons/Plus';
import Trash2 from '@/components/icons/Trash2';
import ChevronDown from '@/components/icons/ChevronDown';
import ChevronUp from '@/components/icons/ChevronUp';
import ChevronRight from '@/components/icons/ChevronRight';
import Code2 from '@/components/icons/Code2';
import CheckCircle2 from '@/components/icons/CheckCircle2';
import BookOpen from '@/components/icons/BookOpen';
import Keyboard from '@/components/icons/Keyboard';
import Eye from '@/components/icons/Eye';
import EyeOff from '@/components/icons/EyeOff';
import CalendarClock from '@/components/icons/CalendarClock';
import { ListSkeleton } from '@/components/Skeleton';
import { StatBar } from '@/components/StatBar';

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
  Easy: 'bg-[var(--status-success)]/10 text-[var(--status-success)]',
  Medium: 'bg-[var(--status-warning)]/10 text-[var(--status-warning)]',
  Hard: 'bg-[var(--status-danger)]/10 text-[var(--status-danger)]',
};

const inputClass = 'w-full px-3.5 py-2.5 text-[13px] placeholder:text-[var(--text-faint)]';
const fieldLabel = 'block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.07em] mb-1.5';

// 30-minute time slots in 12-hour format
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? '00' : '30';
  const hh = String(h).padStart(2, '0');
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return { value: `${hh}:${m}`, label: `${h12}:${m} ${period}` };
});

function VisibleUntilPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <input
        type="date"
        value={value.split('T')[0] || ''}
        onChange={e => {
          const date = e.target.value;
          const time = value.split('T')[1] || '23:30';
          onChange(date ? `${date}T${time}` : '');
        }}
        className="flex-1 min-w-[150px] px-3.5 py-2.5 text-[13px]"
      />
      <select
        value={TIME_OPTIONS.some(option => option.value === value.split('T')[1]) ? value.split('T')[1] : '23:30'}
        onChange={e => {
          const date = value.split('T')[0] || '';
          onChange(date ? `${date}T${e.target.value}` : '');
        }}
        disabled={!value.split('T')[0]}
        className="w-36 px-3.5 py-2.5 text-[13px] disabled:opacity-40"
      >
        {TIME_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      {value && (
        <button type="button" onClick={() => onChange('')} className="text-[11.5px] text-[var(--accent-orange)] font-medium hover:underline whitespace-nowrap">Clear</button>
      )}
    </div>
  );
}

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
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(clock);
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) {
        const uid = snap.data().universityId;
        setUniversityId(uid);
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

  const expiredCount = problems.filter(p => p.visibleUntil && p.visibleUntil.seconds * 1000 < now).length;
  const activeCount = problems.length - expiredCount;

  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in">
      <div className="pt-8 mb-7 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-semibold text-[var(--text-primary)] tracking-[-0.025em]">Practice Problems</h1>
          <p className="text-[var(--text-tertiary)] text-[13.5px] mt-1.5">
            {mode === 'list' ? 'Generate or hand-author coding problems for students to practice.' : mode === 'edit' ? 'Edit practice problem' : 'Create a new practice problem'}
          </p>
        </div>
        <button
          onClick={() => { if (mode === 'list') { setMode('create'); setForm(emptyProblem()); setEditingId(null); } else { setMode('list'); } setStatus({ type: '', message: '' }); }}
          className={mode === 'list' ? 'btn-primary text-[12.5px] !px-3.5 !py-2 flex items-center gap-1.5' : 'btn-secondary text-[12.5px] !px-3.5 !py-2'}
        >
          {mode === 'list' ? <><Plus size={13} /> New Problem</> : 'Back to List'}
        </button>
      </div>

      {status.message && (
        <div className={`mb-6 p-3 rounded-[var(--radius)] text-[13px] font-medium border ${
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
          <>
            {/* Overview — slim inline summary */}
            <StatBar
              className="mb-6"
              items={[
                { label: 'problems', value: problems.length, icon: Code2 },
                { label: 'active', value: activeCount, icon: CheckCircle2 },
                { label: 'expired', value: expiredCount, icon: CalendarClock, accent: expiredCount > 0 ? 'text-[var(--status-danger)]' : undefined },
              ]}
            />

            <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
              {problems.map((p) => {
                const expired = !!(p.visibleUntil && p.visibleUntil.seconds * 1000 < now);
                return (
                  <div
                    key={p.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleEdit(p)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleEdit(p); }}
                    className="group flex items-center gap-3.5 px-4 sm:px-5 py-4 border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-elevated)] transition-colors duration-150 cursor-pointer"
                  >
                    <span className="w-9 h-9 rounded-[8px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
                      <Code2 size={15} className="text-[var(--text-tertiary)]" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] font-semibold text-[var(--text-primary)] tracking-[-0.01em] truncate">{p.title}</p>
                      <div className="flex items-center gap-x-3 gap-y-0.5 flex-wrap mt-1 text-[11.5px] text-[var(--text-faint)]">
                        <span className={`text-[10.5px] font-semibold px-2 py-[2px] rounded-full ${DIFFICULTY_COLORS[p.difficulty] || DIFFICULTY_COLORS['Medium']}`}>{p.difficulty}</span>
                        <span>{p.testCases.length} test case{p.testCases.length !== 1 ? 's' : ''}</span>
                        <span>fn: <code className="text-[var(--text-secondary)] font-mono">{p.functionName}</code></span>
                        {p.visibleUntil ? (
                          <span className={`inline-flex items-center gap-1 text-[10.5px] font-medium ${expired ? 'text-[var(--status-danger)]' : 'text-[var(--status-success)]'}`}>
                            <CalendarClock size={10} />
                            {expired ? 'Expired' : `Until ${new Date(p.visibleUntil.seconds * 1000).toLocaleDateString()}`}
                          </span>
                        ) : (
                          <span className="text-[10.5px] text-[var(--text-faint)]">Always visible</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                      className="p-2 rounded-full text-[var(--text-faint)] hover:text-[var(--status-danger)] hover:bg-[var(--status-danger)]/10 shrink-0 lg:opacity-0 lg:group-hover:opacity-100 lg:focus:opacity-100 transition"
                      title="Delete problem"
                    >
                      <Trash2 size={14} />
                    </button>
                    <ChevronRight size={15} className="text-[var(--text-faint)] opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition shrink-0" />
                  </div>
                );
              })}
            </div>
          </>
        )
      ) : (
        /* ── Create / Edit ── */
        <div className="space-y-5">
          {/* Mode toggle — hidden when editing */}
          {mode !== 'edit' && (
            <div className="inline-flex rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1">
              <button
                onClick={() => setCreateMode('ai')}
                className={`px-4 py-2 text-[12.5px] font-semibold rounded-[7px] transition-colors flex items-center gap-1.5 ${
                  createMode === 'ai' ? 'bg-[var(--type-event)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
                }`}
              >
                <Sparkles size={13} /> AI Generate
              </button>
              <button
                onClick={() => setCreateMode('manual')}
                className={`px-4 py-2 text-[12.5px] font-semibold rounded-[7px] transition-colors flex items-center gap-1.5 ${
                  createMode === 'manual' ? 'bg-[var(--type-event)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
                }`}
              >
                <Keyboard size={13} /> Manual Entry
              </button>
            </div>
          )}

          {/* AI input */}
          {createMode === 'ai' && mode !== 'edit' && (
            <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 sm:p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <label className={fieldLabel}>Question Name (optional)</label>
                  <input value={aiTitle} onChange={e => setAiTitle(e.target.value)} placeholder="e.g. Two Sum Challenge" className={inputClass} />
                </div>
                <div>
                  <label className={fieldLabel}>Difficulty</label>
                  <select value={aiDifficulty} onChange={e => setAiDifficulty(e.target.value)} className={inputClass}>
                    <option>Easy</option><option>Medium</option><option>Hard</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-muted)] mb-1.5"><CalendarClock size={11} className="text-[var(--text-faint)]" /> Visible Until (optional)</label>
                <VisibleUntilPicker value={aiVisibleUntil} onChange={setAiVisibleUntil} />
                <p className="text-[10.5px] text-[var(--text-faint)] mt-1.5">Leave blank for no expiry.</p>
              </div>
              <div>
                <label className={fieldLabel}>Topic or Problem Link</label>
                <div className="flex gap-2">
                  <input
                    value={aiTopic}
                    onChange={e => setAiTopic(e.target.value)}
                    placeholder="e.g. Two Sum, Binary Search Tree Traversal, or paste a URL…"
                    className={inputClass}
                    onKeyDown={e => e.key === 'Enter' && handleAIGenerate()}
                  />
                  <button onClick={handleAIGenerate} disabled={isGenerating || !aiTopic.trim()} className="btn-primary shrink-0 text-[12.5px] !px-4 flex items-center gap-1.5 disabled:opacity-50">
                    <Sparkles size={13} /> {isGenerating ? 'Generating…' : 'Generate'}
                  </button>
                </div>
                <p className="text-[10.5px] text-[var(--text-faint)] mt-1.5">AI drafts a full problem with description, starter code and test cases — review and edit before publishing.</p>
              </div>
            </div>
          )}

          {/* Manual / review form */}
          {(createMode === 'manual' || mode === 'edit') && (
            <div className="space-y-5">
              {/* Basics */}
              <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 sm:p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
                  <div>
                    <label className={fieldLabel}>Title</label>
                    <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Two Sum" className={inputClass} />
                  </div>
                  <div>
                    <label className={fieldLabel}>Difficulty</label>
                    <select value={form.difficulty} onChange={e => setForm({ ...form, difficulty: e.target.value })} className={inputClass}>
                      <option>Easy</option><option>Medium</option><option>Hard</option>
                    </select>
                  </div>
                  <div>
                    <label className={fieldLabel}>Function Name</label>
                    <input value={form.functionName} onChange={e => setForm({ ...form, functionName: e.target.value })} placeholder="e.g. twoSum" className={`${inputClass} font-mono`} />
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-muted)] mb-1.5"><CalendarClock size={11} className="text-[var(--text-faint)]" /> Visible Until</label>
                  <VisibleUntilPicker value={form.visibleUntil} onChange={(v) => setForm({ ...form, visibleUntil: v })} />
                  <p className="text-[10.5px] text-[var(--text-faint)] mt-1.5">Students will not see this problem after this date/time. Leave blank for no expiry.</p>
                </div>

                <div>
                  <label className={fieldLabel}>Problem Description (HTML supported)</label>
                  <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={6} placeholder="<p>Given an array of integers <code>nums</code> and an integer <code>target</code>…</p>" className={`${inputClass} resize-y font-mono`} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  <div>
                    <label className={fieldLabel}>Input Format</label>
                    <textarea value={form.inputFormat} onChange={e => setForm({ ...form, inputFormat: e.target.value })} rows={2} placeholder="First line: array as Python list. Second line: target integer." className={`${inputClass} resize-y`} />
                  </div>
                  <div>
                    <label className={fieldLabel}>Output Format</label>
                    <textarea value={form.outputFormat} onChange={e => setForm({ ...form, outputFormat: e.target.value })} rows={2} placeholder="Array of two indices." className={`${inputClass} resize-y`} />
                  </div>
                </div>

                <div>
                  <label className={fieldLabel}>Constraints (one per line)</label>
                  <textarea value={form.constraints.join('\n')} onChange={e => setForm({ ...form, constraints: e.target.value.split('\n') })} rows={2} placeholder={"1 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9"} className={`${inputClass} resize-y font-mono`} />
                </div>
              </div>

              {/* Starter code */}
              <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 sm:p-6">
                <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--text-primary)]"><Code2 size={14} className="text-[var(--text-tertiary)]" /> Starter Code</h3>
                <p className="text-[11.5px] text-[var(--text-faint)] mt-1 mb-3">Leave blank to auto-generate a default template from the function name.</p>
                <div className="space-y-2">
                  {Object.entries(form.starterCode).map(([lang, code]) => (
                    <div key={lang} className="border border-[var(--border-subtle)] rounded-[8px] overflow-hidden">
                      <button onClick={() => setExpandedStarter(expandedStarter === lang ? null : lang)} className="w-full flex items-center justify-between px-3.5 py-2.5 bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)] transition-colors text-[12.5px] font-medium text-[var(--text-primary)]">
                        <span>{lang}</span>
                        {expandedStarter === lang ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                      {expandedStarter === lang && (
                        <textarea
                          value={code}
                          onChange={e => setForm({ ...form, starterCode: { ...form.starterCode, [lang]: e.target.value } })}
                          rows={6}
                          className="w-full px-3.5 py-2.5 text-[11.5px] !rounded-none !border-0 border-t !border-t-[var(--border-subtle)] bg-[var(--bg-primary)] focus:outline-none resize-y font-mono"
                          placeholder={STARTER_TEMPLATES[lang]?.(form.functionName || 'solve') || '// Write starter code…'}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Test cases */}
              <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 sm:p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--text-primary)]"><CheckCircle2 size={14} className="text-[var(--text-tertiary)]" /> Test Cases</h3>
                  <button onClick={() => setForm({ ...form, testCases: [...form.testCases, { input: '', expectedOutput: '', isHidden: true }] })} className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[var(--accent-orange)] hover:underline">
                    <Plus size={11} /> Add test case
                  </button>
                </div>
                <div className="space-y-2">
                  {form.testCases.map((tc, idx) => (
                    <div key={idx} className="border border-[var(--border-subtle)] rounded-[8px] p-3 bg-[var(--bg-elevated)]">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold text-[var(--text-faint)]">Case {idx + 1}</span>
                          <button
                            onClick={() => { const updated = [...form.testCases]; updated[idx] = { ...updated[idx], isHidden: !updated[idx].isHidden }; setForm({ ...form, testCases: updated }); }}
                            className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${tc.isHidden ? 'bg-[var(--status-warning)]/10 text-[var(--status-warning)]' : 'bg-[var(--status-success)]/10 text-[var(--status-success)]'}`}
                          >
                            {tc.isHidden ? <><EyeOff size={9} /> Hidden</> : <><Eye size={9} /> Visible</>}
                          </button>
                        </div>
                        {form.testCases.length > 1 && (
                          <button onClick={() => setForm({ ...form, testCases: form.testCases.filter((_, i) => i !== idx) })} className="p-1 rounded-full text-[var(--text-faint)] hover:text-[var(--status-danger)] hover:bg-[var(--status-danger)]/10 transition-colors">
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9px] font-semibold text-[var(--text-faint)] uppercase tracking-[0.07em] mb-1 block">Input (stdin)</label>
                          <textarea value={tc.input} onChange={e => { const updated = [...form.testCases]; updated[idx] = { ...updated[idx], input: e.target.value }; setForm({ ...form, testCases: updated }); }} rows={2} placeholder={"[2, 7, 11, 15]\n9"} className="w-full px-3 py-2 text-[11.5px] font-mono resize-y" />
                        </div>
                        <div>
                          <label className="text-[9px] font-semibold text-[var(--text-faint)] uppercase tracking-[0.07em] mb-1 block">Expected Output</label>
                          <textarea value={tc.expectedOutput} onChange={e => { const updated = [...form.testCases]; updated[idx] = { ...updated[idx], expectedOutput: e.target.value }; setForm({ ...form, testCases: updated }); }} rows={2} placeholder="[0, 1]" className="w-full px-3 py-2 text-[11.5px] font-mono resize-y" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

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
