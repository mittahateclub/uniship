'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { addDoc, collection, doc, getDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { processTestDocument } from '@/app/actions/process-test';
import { generateHiddenTestCases } from '@/app/actions/generate-hidden-test-cases';
import { parsePracticeQuestion, generateTestCasesForQuestion } from '@/app/actions/parse-practice-question';
import {
  Upload, FileText, Clock, HelpCircle, Type, AlignLeft, Calendar,
  ChevronLeft, ChevronRight, Plus, Trash2, Sparkles, Wand2,
  ImageIcon, Link2, Eye, EyeOff, ChevronDown, ChevronUp, CheckCircle2, Code,
} from 'lucide-react';

interface PracticeTestCase {
  id: string;
  input: string;
  output: string;
}

interface PracticeQuestion {
  id: string;
  title: string;
  description: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string[];
  sampleTestCases: PracticeTestCase[];
  hiddenTestCases: PracticeTestCase[];
  hints: string[];
  marks: number;
  hasTestCases: boolean;
  topic: string;
}

const DSA_TOPICS = [
  'Arrays',
  'Strings',
  '2D Arrays',
  'Searching & Sorting',
  'Backtracking',
  'Linked List',
  'Stacks & Queues',
  'Greedy',
  'Trees & Graphs',
  'Dynamic Programming',
  'Bit Manipulation',
  'Other',
] as const;

const DIFF_COLORS: Record<Tier, { bg: string; text: string; border: string }> = {
  easy: { bg: 'bg-[#4CAF50]/10', text: 'text-[#4CAF50]', border: 'border-[#4CAF50]/20' },
  medium: { bg: 'bg-[#F1A82C]/10', text: 'text-[#F1A82C]', border: 'border-[#F1A82C]/20' },
  hard: { bg: 'bg-[#F54E00]/10', text: 'text-[#F54E00]', border: 'border-[#F54E00]/20' },
};

const puid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function emptyPracticeQuestion(): PracticeQuestion {
  return {
    id: puid(),
    title: '',
    description: '',
    inputFormat: '',
    outputFormat: '',
    constraints: [],
    sampleTestCases: [{ id: puid(), input: '', output: '' }],
    hiddenTestCases: [],
    hints: [],
    marks: 1,
    hasTestCases: true,
    topic: 'Arrays',
  };
}

// Keep old interface for mock test backward compat
interface ManualQuestion {
  id: string;
  questionText: string;
  testCases: Array<{
    id: string;
    input: string;
    output: string;
  }>;
  marks: number;
}

type Tier = 'easy' | 'medium' | 'hard';

export default function CreateTestPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [file, setFile] = useState<File | null>(null);
  const [universityId, setUniversityId] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(60);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [examDate, setExamDate] = useState<Date | null>(null);
  const [startHour, setStartHour] = useState(9);
  const [startMinute, setStartMinute] = useState(0);
  const [startAmPm, setStartAmPm] = useState<'AM' | 'PM'>('AM');
  const [endHour, setEndHour] = useState(10);
  const [endMinute, setEndMinute] = useState(0);
  const [endAmPm, setEndAmPm] = useState<'AM' | 'PM'>('AM');
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [createdTestId, setCreatedTestId] = useState<string | null>(null);
  const [activeMainTab, setActiveMainTab] = useState<'mock' | 'practice'>('mock');
  const [activeTierTab, setActiveTierTab] = useState<Tier>('easy');
  const [manualStatus, setManualStatus] = useState({ type: '', message: '' });
  const [savingPractice, setSavingPractice] = useState(false);
  const [aiGeneratingQuestionId, setAiGeneratingQuestionId] = useState<string | null>(null);
  const [practiceQuestions, setPracticeQuestions] = useState<Record<Tier, ManualQuestion[]>>({
    easy: [],
    medium: [],
    hard: [],
  });
  // Enhanced practice question state
  const [practiceItems, setPracticeItems] = useState<PracticeQuestion[]>([]);
  const [practiceExpandedId, setPracticeExpandedId] = useState<string | null>(null);
  const [rawInputMode, setRawInputMode] = useState<Record<string, 'text' | 'image' | 'link'>>({});
  const [rawInputText, setRawInputText] = useState<Record<string, string>>({});
  const [aiParsingId, setAiParsingId] = useState<string | null>(null);
  const [aiTestCaseGenId, setAiTestCaseGenId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    async function fetchAdminProfile() {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.universityId) {
              setUniversityId(data.universityId);
            } else {
              setStatus({ type: 'error', message: 'No University ID found for this admin.' });
            }
          }
        } catch (error) {
          console.error("Error fetching admin profile:", error);
          setStatus({ type: 'error', message: 'Failed to load admin profile.' });
        }
      }
    }
    fetchAdminProfile();
  }, [user]);

  // Fetch saved practice questions is no longer needed — practice sets go to tests collection

  const addPracticeItem = () => {
    const q = emptyPracticeQuestion();
    q.marks = activeTierTab === 'easy' ? 1 : activeTierTab === 'medium' ? 2 : 3;
    setPracticeItems(prev => [...prev, q]);
    setPracticeExpandedId(q.id);
    setRawInputMode(prev => ({ ...prev, [q.id]: 'text' }));
  };

  const removePracticeItem = (id: string) => {
    setPracticeItems(prev => prev.filter(q => q.id !== id));
    if (practiceExpandedId === id) setPracticeExpandedId(null);
  };

  const updatePracticeField = <K extends keyof PracticeQuestion>(id: string, field: K, value: PracticeQuestion[K]) => {
    setPracticeItems(prev => prev.map(q => q.id === id ? { ...q, [field]: value } : q));
  };

  const addPracticeSampleTC = (qId: string) => {
    setPracticeItems(prev => prev.map(q => {
      if (q.id !== qId) return q;
      return { ...q, sampleTestCases: [...q.sampleTestCases, { id: puid(), input: '', output: '' }] };
    }));
  };

  const updatePracticeSampleTC = (qId: string, tcId: string, field: 'input' | 'output', value: string) => {
    setPracticeItems(prev => prev.map(q => {
      if (q.id !== qId) return q;
      return { ...q, sampleTestCases: q.sampleTestCases.map(tc => tc.id === tcId ? { ...tc, [field]: value } : tc) };
    }));
  };

  const removePracticeSampleTC = (qId: string, tcId: string) => {
    setPracticeItems(prev => prev.map(q => {
      if (q.id !== qId) return q;
      return { ...q, sampleTestCases: q.sampleTestCases.filter(tc => tc.id !== tcId) };
    }));
  };

  const updatePracticeHiddenTC = (qId: string, tcId: string, field: 'input' | 'output', value: string) => {
    setPracticeItems(prev => prev.map(q => {
      if (q.id !== qId) return q;
      return { ...q, hiddenTestCases: q.hiddenTestCases.map(tc => tc.id === tcId ? { ...tc, [field]: value } : tc) };
    }));
  };

  const removePracticeHiddenTC = (qId: string, tcId: string) => {
    setPracticeItems(prev => prev.map(q => {
      if (q.id !== qId) return q;
      return { ...q, hiddenTestCases: q.hiddenTestCases.filter(tc => tc.id !== tcId) };
    }));
  };

  const handleAIParse = async (qId: string) => {
    const raw = (rawInputText[qId] || '').trim();
    if (!raw) {
      setManualStatus({ type: 'error', message: 'Enter question text, paste image text, or provide a link to parse.' });
      return;
    }
    try {
      setAiParsingId(qId);
      setManualStatus({ type: 'info', message: 'AI is parsing your question...' });
      const result = await parsePracticeQuestion(raw);
      if (!result.success) {
        setManualStatus({ type: 'error', message: result.error });
        return;
      }
      const pq = result.question;
      setPracticeItems(prev => prev.map(existing => {
        if (existing.id !== qId) return existing;
        return {
          ...existing,
          title: pq.title || existing.title,
          description: pq.description || existing.description,
          inputFormat: pq.inputFormat || existing.inputFormat,
          outputFormat: pq.outputFormat || existing.outputFormat,
          constraints: pq.constraints?.length ? pq.constraints : existing.constraints,
          sampleTestCases: pq.sampleTestCases?.length
            ? pq.sampleTestCases.map(tc => ({ id: puid(), input: tc.input, output: tc.output }))
            : existing.sampleTestCases,
          hints: pq.hints?.length ? pq.hints : existing.hints,
        };
      }));
      setManualStatus({ type: 'success', message: 'Question parsed and structured successfully!' });
    } catch {
      setManualStatus({ type: 'error', message: 'Failed to parse question with AI.' });
    } finally {
      setAiParsingId(null);
    }
  };

  const handleGeneratePracticeTestCases = async (qId: string) => {
    const q = practiceItems.find(x => x.id === qId);
    if (!q?.description?.trim()) {
      setManualStatus({ type: 'error', message: 'Add a question description before generating test cases.' });
      return;
    }
    try {
      setAiTestCaseGenId(qId);
      setManualStatus({ type: 'info', message: 'AI is generating test cases...' });
      const fullText = `${q.title}\n\n${q.description}\n\nInput Format: ${q.inputFormat}\nOutput Format: ${q.outputFormat}`;
      const sampleCases = (q.sampleTestCases || []).filter(tc => tc.input.trim() && tc.output.trim()).map(tc => ({ input: tc.input, output: tc.output }));
      const result = await generateTestCasesForQuestion(fullText, 4, sampleCases);
      if (!result.success) {
        setManualStatus({ type: 'error', message: result.error || 'Failed to generate test cases.' });
        return;
      }
      setPracticeItems(prev => prev.map(existing => {
        if (existing.id !== qId) return existing;
        const updates: Partial<typeof existing> = {
          hiddenTestCases: (result.cases || []).map(c => ({ id: puid(), input: c.input, output: c.output })),
        };
        // Auto-correct sample outputs if dual-validation found them wrong
        if (result.correctedSamples) {
          updates.sampleTestCases = result.correctedSamples.map((c, i) => ({
            id: existing.sampleTestCases[i]?.id || puid(),
            input: c.input,
            output: c.output,
          }));
        }
        return { ...existing, ...updates };
      }));
      const correctionNote = result.correctedSamples ? ' (sample outputs were auto-corrected)' : '';
      setManualStatus({ type: 'success', message: `Generated ${(result.cases || []).length} hidden test cases.${correctionNote}` });
    } catch {
      setManualStatus({ type: 'error', message: 'Failed to generate test cases.' });
    } finally {
      setAiTestCaseGenId(null);
    }
  };

  const handleSaveNewPracticeQuestions = async () => {
    if (!user || !universityId) {
      setManualStatus({ type: 'error', message: 'Unable to identify university.' });
      return;
    }
    if (!title.trim()) {
      setManualStatus({ type: 'error', message: 'Please enter a practice set name before saving.' });
      return;
    }
    const valid = practiceItems.filter(q => q.title.trim() && q.description.trim());
    if (valid.length === 0) {
      setManualStatus({ type: 'error', message: 'Add at least one question with a title and description.' });
      return;
    }
    try {
      setSavingPractice(true);
      setManualStatus({ type: 'info', message: 'Creating practice set...' });

      const problems = valid.map((q, index) => ({
        section: `${activeTierTab.toUpperCase()}_${index + 1}`,
        difficulty: activeTierTab.toUpperCase(),
        topic: q.topic || 'Other',
        title: q.title.trim(),
        questionDescription: q.description.trim(),
        functionDescription: { name: '', parameters: [], return: '' },
        constraints: q.constraints.filter(c => c.trim()),
        inputFormat: q.inputFormat.trim(),
        outputFormat: q.outputFormat.trim(),
        sampleTestCases: q.sampleTestCases
          .filter(tc => tc.input.trim() || tc.output.trim())
          .map(tc => ({ input: tc.input.trim(), output: tc.output.trim(), explanation: '' })),
        hiddenTestCases: q.hasTestCases
          ? q.hiddenTestCases.filter(tc => tc.output.trim()).map(tc => ({ input: tc.input.trim(), output: tc.output.trim() }))
          : [],
        hints: q.hints.filter(h => h.trim()),
        expectedOutput: q.sampleTestCases[0]?.output?.trim() || '',
        marks: q.marks,
      }));

      const examStart = examDate ? buildISOString(examDate, startHour, startMinute, startAmPm) : null;
      const examEnd = examDate ? buildISOString(examDate, endHour, endMinute, endAmPm) : null;

      const docRef = await addDoc(collection(db, 'tests'), {
        title: title.trim(),
        description: description.trim(),
        duration,
        category: 'Practice',
        totalQuestions: problems.length,
        examStart,
        examEnd,
        metadata: {
          difficultyLevels: [activeTierTab],
          totalProblems: problems.length,
        },
        problems,
        universityId,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        sourceFileName: `${title.trim()} (Practice Set)`,
        sourceType: 'manual_practice',
        approved: false,
        published: false,
      });

      setCreatedTestId(docRef.id);
      setPracticeItems([]);
      setPracticeExpandedId(null);
      setManualStatus({
        type: 'success',
        message: `Created practice set with ${problems.length} question${problems.length !== 1 ? 's' : ''}. Go to Manage Tests to approve & publish.`,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save practice set.';
      setManualStatus({ type: 'error', message });
    } finally {
      setSavingPractice(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus({ type: '', message: '' });
      setCreatedTestId(null);
    }
  };

  const to24Hour = (h: number, ampm: 'AM' | 'PM') => {
    if (ampm === 'AM') return h === 12 ? 0 : h;
    return h === 12 ? 12 : h + 12;
  };

  const buildISOString = (date: Date, hour: number, minute: number, ampm: 'AM' | 'PM') => {
    const d = new Date(date);
    d.setHours(to24Hour(hour, ampm), minute, 0, 0);
    return d.toISOString();
  };

  // Calendar helpers
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(calendarYear, calendarMonth, 1).getDay();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const prevMonth = () => {
    if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear(y => y - 1); }
    else setCalendarMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear(y => y + 1); }
    else setCalendarMonth(m => m + 1);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !user || !universityId || !examDate) return;

    setIsParsing(true);
    setStatus({ type: 'info', message: 'LlamaParse is reading and Groq is thinking...' });

    try {
      const formData = new FormData();
      formData.append('file', file);

      const examStart = buildISOString(examDate, startHour, startMinute, startAmPm);
      const examEnd = buildISOString(examDate, endHour, endMinute, endAmPm);

      const result = await processTestDocument(formData, user.uid, universityId, {
        title: title.trim(),
        description: description.trim(),
        duration,
        category: 'General',
        totalQuestions: totalQuestions || undefined,
        examStart,
        examEnd,
      });

      if (result.success) {
        setStatus({ type: 'success', message: 'Uploaded PDF successfully. Please approve the test before students can take it.' });
        setCreatedTestId(result.id || null);
      } else {
        setStatus({ type: 'error', message: result.error });
        setCreatedTestId(null);
      }
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setIsParsing(false);
    }
  };

  const addQuestion = (tier: Tier) => {
    const newQuestion: ManualQuestion = {
      id: `${tier}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      questionText: '',
      testCases: [
        {
          id: `${tier}-tc-${Date.now()}-2`,
          input: '',
          output: '',
        },
        {
          id: `${tier}-tc-${Date.now()}-3`,
          input: '',
          output: '',
        },
      ],
      marks: 1,
    };

    setPracticeQuestions(prev => ({
      ...prev,
      [tier]: [...prev[tier], newQuestion],
    }));
  };

  const removeQuestion = (tier: Tier, id: string) => {
    setPracticeQuestions(prev => ({
      ...prev,
      [tier]: prev[tier].filter(q => q.id !== id),
    }));
  };

  const updateQuestionField = (
    tier: Tier,
    id: string,
    field: 'questionText' | 'marks',
    value: string | number
  ) => {
    setPracticeQuestions(prev => ({
      ...prev,
      [tier]: prev[tier].map(q => {
        if (q.id !== id) return q;
        return { ...q, [field]: value };
      }),
    }));
  };

  const generateHiddenCasesForQuestion = async (tier: Tier, questionId: string) => {
    const question = practiceQuestions[tier].find(q => q.id === questionId);
    if (!question || !question.questionText.trim()) {
      setManualStatus({ type: 'error', message: 'Please add question text before generating hidden test cases.' });
      return;
    }

    try {
      setAiGeneratingQuestionId(questionId);
      setManualStatus({ type: 'info', message: 'Groq is scanning the question and generating hidden test cases...' });

      const sampleCases = (question.testCases || []).filter(tc => tc.input.trim() && tc.output.trim());
      const result = await generateHiddenTestCases(question.questionText.trim(), 3, sampleCases);
      if (!result.success || !result.cases) {
        setManualStatus({ type: 'error', message: result.error || 'Could not generate hidden test cases.' });
        return;
      }

      const generatedCases = result.cases;

      setPracticeQuestions(prev => ({
        ...prev,
        [tier]: prev[tier].map(q => {
          if (q.id !== questionId) return q;
          return {
            ...q,
            testCases: generatedCases.map((c, idx) => ({
              id: `${questionId}-ai-${Date.now()}-${idx}`,
              input: c.input,
              output: c.output,
            })),
          };
        }),
      }));

      const correctionNote = result.correctedSamples ? ' (sample outputs were auto-corrected — re-save to apply)' : '';
      setManualStatus({ type: 'success', message: `Generated ${generatedCases.length} hidden test cases with expected outputs.${correctionNote}` });
    } catch (error: any) {
      setManualStatus({ type: 'error', message: error?.message || 'Failed to generate hidden test cases.' });
    } finally {
      setAiGeneratingQuestionId(null);
    }
  };

  const removeTestCase = (tier: Tier, questionId: string, testCaseId: string) => {
    setPracticeQuestions(prev => ({
      ...prev,
      [tier]: prev[tier].map(q => {
        if (q.id !== questionId) return q;
        if (q.testCases.length <= 1) return q;
        return {
          ...q,
          testCases: q.testCases.filter(tc => tc.id !== testCaseId),
        };
      }),
    }));
  };

  const updateTestCaseField = (
    tier: Tier,
    questionId: string,
    testCaseId: string,
    field: 'output',
    value: string
  ) => {
    setPracticeQuestions(prev => ({
      ...prev,
      [tier]: prev[tier].map(q => {
        if (q.id !== questionId) return q;
        return {
          ...q,
          testCases: q.testCases.map(tc => {
            if (tc.id !== testCaseId) return tc;
            return { ...tc, [field]: value };
          }),
        };
      }),
    }));
  };

  const handleSavePracticeQuestions = async (e: React.FormEvent) => {
    e.preventDefault();

    const total =
      practiceQuestions.easy.length +
      practiceQuestions.medium.length +
      practiceQuestions.hard.length;

    if (!user || !universityId) {
      setManualStatus({ type: 'error', message: 'Unable to identify university. Please refresh and try again.' });
      return;
    }

    if (!title.trim()) {
      setManualStatus({ type: 'error', message: 'Please enter a test name before saving.' });
      return;
    }

    if (total === 0) {
      setManualStatus({ type: 'error', message: 'Add at least one practice question before saving.' });
      return;
    }

    const toProblem = (tier: Tier, q: ManualQuestion, index: number) => ({
      section: `${tier.toUpperCase()}_${index + 1}`,
      difficulty: tier.toUpperCase(),
      title: `${tier.charAt(0).toUpperCase() + tier.slice(1)} Question ${index + 1}`,
      questionDescription: q.questionText.trim(),
      functionDescription: {
        name: '',
        parameters: [],
        return: '',
      },
      constraints: [],
      inputFormat: '',
      outputFormat: '',
      sampleTestCases: q.testCases.slice(0, 1).map(tc => ({
          input: tc.input,
          output: tc.output,
          explanation: 'Output must match expected output for this input.',
        })),
      hiddenTestCases: q.testCases.map(tc => ({
          input: tc.input,
          output: tc.output,
        })),
      expectedOutput: q.testCases[0]?.output || '',
      marks: q.marks,
    });

    const easyProblems = practiceQuestions.easy
      .filter(q => q.questionText.trim())
      .map((q, index) => toProblem('easy', q, index));
    const mediumProblems = practiceQuestions.medium
      .filter(q => q.questionText.trim())
      .map((q, index) => toProblem('medium', q, index));
    const hardProblems = practiceQuestions.hard
      .filter(q => q.questionText.trim())
      .map((q, index) => toProblem('hard', q, index));

    const problems = [...easyProblems, ...mediumProblems, ...hardProblems];
    if (problems.length === 0) {
      setManualStatus({ type: 'error', message: 'Every saved question must include question text.' });
      return;
    }

    const allQuestions = [
      ...practiceQuestions.easy,
      ...practiceQuestions.medium,
      ...practiceQuestions.hard,
    ];

    const hasMissingOrInsufficientTestCases = allQuestions.some(q => {
      if (!q.questionText.trim()) return false;
      const completeCases = q.testCases.filter(tc => tc.output.trim() && tc.input.trim());
      return completeCases.length < 2;
    });

    if (hasMissingOrInsufficientTestCases) {
      setManualStatus({ type: 'error', message: 'Each question must have at least 2 generated test cases with expected outputs.' });
      return;
    }

    const hasEmptyGeneratedInput = allQuestions.some(q => {
      if (!q.questionText.trim()) return false;
      return q.testCases.some(tc => !tc.input.trim());
    });

    if (hasEmptyGeneratedInput) {
      setManualStatus({ type: 'error', message: 'Generate hidden test cases for every question before saving.' });
      return;
    }

    try {
      setSavingPractice(true);
      setManualStatus({ type: 'info', message: 'Saving practice test...' });

      const examStart = examDate ? buildISOString(examDate, startHour, startMinute, startAmPm) : null;
      const examEnd = examDate ? buildISOString(examDate, endHour, endMinute, endAmPm) : null;

      const docRef = await addDoc(collection(db, 'tests'), {
        title: title.trim(),
        description: description.trim(),
        duration,
        category: 'General',
        totalQuestions: problems.length,
        examStart,
        examEnd,
        metadata: {
          difficultyLevels: ['easy', 'medium', 'hard'].filter(level => practiceQuestions[level as Tier].length > 0),
          totalProblems: problems.length,
        },
        problems,
        universityId,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        sourceFileName: `${title.trim()} (Manual Practice Questions)`,
        sourceType: 'manual_practice',
        approved: false,
        published: false,
      });

      setCreatedTestId(docRef.id);
      setManualStatus({
        type: 'success',
        message: `Saved ${problems.length} practice questions. Open Review & Approve to publish the test.`,
      });
    } catch (error: any) {
      setManualStatus({ type: 'error', message: error?.message || 'Failed to save practice questions.' });
    } finally {
      setSavingPractice(false);
    }
  };

  if (authLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="loading-dots"><span /><span /><span /></div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-[-0.02em]">AI Test Generator</h1>
        <p className="text-[var(--text-tertiary)] text-[13px] mt-1">Create tests using PDF upload or build practice questions manually</p>
      </div>

      <div id="generator" className="window p-6">
        <div className="mb-5">
          <div className="inline-flex rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1">
            <button
              type="button"
              onClick={() => setActiveMainTab('mock')}
              className={`px-4 py-2 text-[13px] font-semibold rounded-md transition-colors ${
                activeMainTab === 'mock'
                  ? 'bg-[#5E6AD2] text-white'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
              }`}
            >
              Create Mock Test
            </button>
            <button
              type="button"
              onClick={() => setActiveMainTab('practice')}
              className={`px-4 py-2 text-[13px] font-semibold rounded-md transition-colors ${
                activeMainTab === 'practice'
                  ? 'bg-[#5E6AD2] text-white'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
              }`}
            >
              Practice Questions
            </button>
          </div>
        </div>

        {activeMainTab === 'mock' && (
          <>
            {status.message && (
              <div className={`mb-4 p-3 rounded text-[13px] font-medium border ${
                status.type === 'error' ? 'bg-[#F54E00]/10 text-[#F54E00] border-[#F54E00]/20'
                : status.type === 'success' ? 'bg-[#4CAF50]/10 text-[#4CAF50] border-[#4CAF50]/20'
                : 'bg-[#5E6AD2]/10 text-[#5E6AD2] border-[#5E6AD2]/20'
              }`}>
                {status.message}
              </div>
            )}
            {status.type === 'success' && (
              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => router.push('/uniadmin/tests')}
                  className="btn-secondary text-[12px] px-3 py-1.5"
                >
                  Go to Manage Tests
                </button>
                {createdTestId && (
                  <button
                    type="button"
                    onClick={() => router.push(`/uniadmin/tests/review/${createdTestId}`)}
                    className="btn-primary text-[12px] px-3 py-1.5"
                  >
                    Open Review & Approve
                  </button>
                )}
              </div>
            )}
            <form onSubmit={handleGenerate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                    <Type size={12} className="text-[var(--text-faint)]" />
                    Test Name
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    required
                    placeholder="e.g. Midterm Mock Test"
                    className="w-full px-3 py-2 text-[13px] rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--border-active)] transition-colors"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                    <Clock size={12} className="text-[var(--text-faint)]" />
                    Duration (min)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={300}
                    value={duration}
                    onChange={e => setDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 text-[13px] rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-active)] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                  <AlignLeft size={12} className="text-[var(--text-faint)]" />
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Short description of this test..."
                  className="w-full px-3 py-2 text-[13px] rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--border-active)] transition-colors resize-none"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                  <Calendar size={12} className="text-[var(--text-faint)]" />
                  Exam Date
                </label>
                <div className="border border-[var(--border-subtle)] rounded bg-[var(--bg-elevated)] p-3">
                  <div className="flex items-center justify-between mb-2">
                    <button type="button" onClick={prevMonth} className="p-1 rounded hover:bg-[var(--bg-surface)] transition-colors">
                      <ChevronLeft size={14} className="text-[var(--text-secondary)]" />
                    </button>
                    <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                      {monthNames[calendarMonth]} {calendarYear}
                    </span>
                    <button type="button" onClick={nextMonth} className="p-1 rounded hover:bg-[var(--bg-surface)] transition-colors">
                      <ChevronRight size={14} className="text-[var(--text-secondary)]" />
                    </button>
                  </div>
                  <div className="grid grid-cols-7 mb-1">
                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                      <div key={d} className="text-center text-[10px] font-medium text-[var(--text-faint)] py-1">
                        {d}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7">
                    {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                      <div key={`mock-empty-${i}`} />
                    ))}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      const date = new Date(calendarYear, calendarMonth, day);
                      date.setHours(0, 0, 0, 0);
                      const isPast = date < today;
                      const isSelected = examDate && examDate.getTime() === date.getTime();
                      const isToday = date.getTime() === today.getTime();
                      return (
                        <button
                          key={`mock-${day}`}
                          type="button"
                          disabled={isPast}
                          onClick={() => setExamDate(date)}
                          className={`text-[12px] py-1.5 rounded transition-colors ${
                            isSelected
                              ? 'bg-[#5E6AD2] text-white font-semibold'
                              : isPast
                              ? 'text-[var(--text-faint)]/40 cursor-not-allowed'
                              : isToday
                              ? 'text-[#5E6AD2] font-semibold hover:bg-[#5E6AD2]/10'
                              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

          {/* Time Pickers — From / To */}
          <div className="grid grid-cols-2 gap-3">
            {/* From Time */}
            <div>
              <label className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                <Clock size={12} className="text-[var(--text-faint)]" />
                From
              </label>
              <div className="flex items-center gap-1.5 border border-[var(--border-subtle)] rounded bg-[var(--bg-elevated)] p-2">
                <select value={startHour} onChange={e => setStartHour(Number(e.target.value))} className="bg-transparent text-[13px] text-[var(--text-primary)] focus:outline-none appearance-none text-center w-10 cursor-pointer">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                    <option key={h} value={h}>{String(h).padStart(2, '0')}</option>
                  ))}
                </select>
                <span className="text-[13px] text-[var(--text-faint)] font-bold">:</span>
                <select value={startMinute} onChange={e => setStartMinute(Number(e.target.value))} className="bg-transparent text-[13px] text-[var(--text-primary)] focus:outline-none appearance-none text-center w-10 cursor-pointer">
                  {Array.from({ length: 12 }, (_, i) => i * 5).map(m => (
                    <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                  ))}
                </select>
                <div className="flex rounded overflow-hidden border border-[var(--border-subtle)] ml-auto">
                  <button type="button" onClick={() => setStartAmPm('AM')} className={`px-2 py-0.5 text-[11px] font-medium transition-colors ${startAmPm === 'AM' ? 'bg-[#5E6AD2] text-white' : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-surface)]'}`}>AM</button>
                  <button type="button" onClick={() => setStartAmPm('PM')} className={`px-2 py-0.5 text-[11px] font-medium transition-colors ${startAmPm === 'PM' ? 'bg-[#5E6AD2] text-white' : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-surface)]'}`}>PM</button>
                </div>
              </div>
            </div>
            {/* To Time */}
            <div>
              <label className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                <Clock size={12} className="text-[var(--text-faint)]" />
                To
              </label>
              <div className="flex items-center gap-1.5 border border-[var(--border-subtle)] rounded bg-[var(--bg-elevated)] p-2">
                <select value={endHour} onChange={e => setEndHour(Number(e.target.value))} className="bg-transparent text-[13px] text-[var(--text-primary)] focus:outline-none appearance-none text-center w-10 cursor-pointer">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                    <option key={h} value={h}>{String(h).padStart(2, '0')}</option>
                  ))}
                </select>
                <span className="text-[13px] text-[var(--text-faint)] font-bold">:</span>
                <select value={endMinute} onChange={e => setEndMinute(Number(e.target.value))} className="bg-transparent text-[13px] text-[var(--text-primary)] focus:outline-none appearance-none text-center w-10 cursor-pointer">
                  {Array.from({ length: 12 }, (_, i) => i * 5).map(m => (
                    <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                  ))}
                </select>
                <div className="flex rounded overflow-hidden border border-[var(--border-subtle)] ml-auto">
                  <button type="button" onClick={() => setEndAmPm('AM')} className={`px-2 py-0.5 text-[11px] font-medium transition-colors ${endAmPm === 'AM' ? 'bg-[#5E6AD2] text-white' : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-surface)]'}`}>AM</button>
                  <button type="button" onClick={() => setEndAmPm('PM')} className={`px-2 py-0.5 text-[11px] font-medium transition-colors ${endAmPm === 'PM' ? 'bg-[#5E6AD2] text-white' : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-surface)]'}`}>PM</button>
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="divider-dashed" />

          {/* File upload */}
          <div>
            <label className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
              <FileText size={12} className="text-[var(--text-faint)]" />
              Source PDF
            </label>
            <div className="relative overflow-hidden border border-dashed border-[var(--border-active)] rounded p-6 text-center bg-[var(--bg-elevated)] hover:border-[#F54E00]/40 transition-colors duration-150 cursor-pointer">
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <Upload size={18} className="mx-auto mb-1.5 text-[var(--text-faint)]" />
              <p className="text-[13px] text-[var(--text-tertiary)] pointer-events-none">
                {file ? file.name : 'Drop PDF or click to select'}
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={isParsing || !file || !universityId || !title.trim() || !examDate}
            className="btn-primary w-full"
          >
            {isParsing ? 'Processing...' : 'Generate & Save Test'}
          </button>
            </form>
          </>
        )}

        {activeMainTab === 'practice' && (
          <div className="space-y-5">
            {manualStatus.message && (
              <div className={`p-3 rounded text-[13px] font-medium border ${
                manualStatus.type === 'error'
                  ? 'bg-[#F54E00]/10 text-[#F54E00] border-[#F54E00]/20'
                  : manualStatus.type === 'success'
                  ? 'bg-[#4CAF50]/10 text-[#4CAF50] border-[#4CAF50]/20'
                  : 'bg-[#5E6AD2]/10 text-[#5E6AD2] border-[#5E6AD2]/20'
              }`}>
                {manualStatus.message}
              </div>
            )}

            {manualStatus.type === 'success' && createdTestId && (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => router.push('/uniadmin/tests')} className="btn-secondary text-[12px] px-3 py-1.5">
                  Go to Manage Tests
                </button>
                <button type="button" onClick={() => router.push(`/uniadmin/tests/review/${createdTestId}`)} className="btn-primary text-[12px] px-3 py-1.5">
                  Open Review &amp; Approve
                </button>
              </div>
            )}

            {/* Practice set name + description */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                  <Type size={12} className="text-[var(--text-faint)]" />
                  Practice Set Name
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Arrays & Strings Practice"
                  className="w-full px-3 py-2 text-[13px] rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--border-active)] transition-colors"
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                  <Clock size={12} className="text-[var(--text-faint)]" />
                  Duration (min)
                </label>
                <input
                  type="number"
                  min={5}
                  max={300}
                  value={duration}
                  onChange={e => setDuration(Number(e.target.value))}
                  className="w-full px-3 py-2 text-[13px] rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-active)] transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                <AlignLeft size={12} className="text-[var(--text-faint)]" />
                Description
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                placeholder="Brief description of this practice set..."
                className="w-full px-3 py-2 text-[13px] rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--border-active)] transition-colors resize-none"
              />
            </div>

            {/* Optional date — practice sets don't expire unless date is set */}
            <div>
              <label className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                <Calendar size={12} className="text-[var(--text-faint)]" />
                Expiry Date <span className="text-[var(--text-faint)] font-normal">(optional — leave blank for no expiry)</span>
              </label>
              <div className="border border-[var(--border-subtle)] rounded bg-[var(--bg-elevated)] p-3">
                {examDate && (
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[12px] text-[var(--text-secondary)]">
                      Expires: {examDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <button type="button" onClick={() => setExamDate(null)} className="text-[11px] text-[#F54E00] hover:underline">Clear</button>
                  </div>
                )}
                <div className="flex items-center justify-between mb-2">
                  <button type="button" onClick={prevMonth} className="p-1 rounded hover:bg-[var(--bg-surface)] transition-colors">
                    <ChevronLeft size={14} className="text-[var(--text-secondary)]" />
                  </button>
                  <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                    {monthNames[calendarMonth]} {calendarYear}
                  </span>
                  <button type="button" onClick={nextMonth} className="p-1 rounded hover:bg-[var(--bg-surface)] transition-colors">
                    <ChevronRight size={14} className="text-[var(--text-secondary)]" />
                  </button>
                </div>
                <div className="grid grid-cols-7 mb-1">
                  {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                    <div key={d} className="text-center text-[10px] font-medium text-[var(--text-faint)] py-1">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                    <div key={`p-empty-${i}`} />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const date = new Date(calendarYear, calendarMonth, day);
                    date.setHours(0, 0, 0, 0);
                    const isPast = date < today;
                    const isSelected = examDate && examDate.getTime() === date.getTime();
                    const isToday = date.getTime() === today.getTime();
                    return (
                      <button
                        key={`p-${day}`}
                        type="button"
                        disabled={isPast}
                        onClick={() => setExamDate(date)}
                        className={`text-[12px] py-1.5 rounded transition-colors ${
                          isSelected
                            ? 'bg-[#5E6AD2] text-white font-semibold'
                            : isPast
                            ? 'text-[var(--text-faint)]/40 cursor-not-allowed'
                            : isToday
                            ? 'text-[#5E6AD2] font-semibold hover:bg-[#5E6AD2]/10'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Difficulty selector */}
            <div>
              <label className="text-[12px] font-medium text-[var(--text-secondary)] mb-1.5 block">Difficulty Level</label>
              <div className="inline-flex rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1">
                {(['easy', 'medium', 'hard'] as Tier[]).map(tier => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setActiveTierTab(tier)}
                    className={`px-3 py-1.5 text-[12px] font-semibold rounded-md transition-colors capitalize ${
                      activeTierTab === tier
                        ? `text-white ${DIFF_COLORS[tier].bg}`
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
                    }`}
                  >
                    {tier}
                  </button>
                ))}
              </div>
            </div>

            {/* Questions */}
            <div className="space-y-3">
              {practiceItems.length === 0 && (
                <div className="rounded border border-dashed border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 text-center text-[13px] text-[var(--text-tertiary)]">
                  <Code size={24} className="mx-auto mb-2 text-[var(--text-faint)]" />
                  No questions yet. Click &ldquo;Add Question&rdquo; to start creating {activeTierTab} practice questions.
                </div>
              )}

              {practiceItems.map((q, idx) => {
                  const isExpanded = practiceExpandedId === q.id;
                  const inputMode = rawInputMode[q.id] || 'text';
                  return (
                    <div key={q.id} className="rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] overflow-hidden">
                      {/* Collapsed header */}
                      <button
                        type="button"
                        onClick={() => setPracticeExpandedId(isExpanded ? null : q.id)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-surface)] transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${DIFF_COLORS[activeTierTab].bg} text-white`}>{activeTierTab}</span>
                          <span className="text-[13px] font-medium text-[var(--text-primary)]">
                            {q.title.trim() || `Question ${idx + 1}`}
                          </span>
                          {q.description.trim() && <CheckCircle2 size={14} className="text-green-500" />}
                        </div>
                        {isExpanded ? <ChevronUp size={14} className="text-[var(--text-faint)]" /> : <ChevronDown size={14} className="text-[var(--text-faint)]" />}
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-4 space-y-4 border-t border-[var(--border-subtle)]">
                          {/* Input mode selector */}
                          <div className="flex items-center gap-2 pt-3">
                            <span className="text-[11px] font-medium text-[var(--text-faint)]">Input via:</span>
                            {([
                              { mode: 'text' as const, icon: Type, label: 'Text' },
                              { mode: 'image' as const, icon: ImageIcon, label: 'Image Text' },
                              { mode: 'link' as const, icon: Link2, label: 'Link' },
                            ]).map(({ mode, icon: Icon, label }) => (
                              <button
                                key={mode}
                                type="button"
                                onClick={() => setRawInputMode(prev => ({ ...prev, [q.id]: mode }))}
                                className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
                                  inputMode === mode
                                    ? 'bg-[#5E6AD2] text-white'
                                    : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]'
                                }`}
                              >
                                <Icon size={11} />
                                {label}
                              </button>
                            ))}
                          </div>

                          {/* Raw text area + AI parse */}
                          <div>
                            <textarea
                              value={rawInputText[q.id] || ''}
                              onChange={e => setRawInputText(prev => ({ ...prev, [q.id]: e.target.value }))}
                              rows={4}
                              className="w-full px-3 py-2 text-[12px] rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--border-active)] transition-colors resize-y font-mono"
                              placeholder={
                                inputMode === 'text'
                                  ? 'Paste the full question text here...'
                                  : inputMode === 'image'
                                  ? 'Paste OCR / extracted text from an image...'
                                  : 'Paste the URL that contains the problem...'
                              }
                            />
                            <button
                              type="button"
                              disabled={aiParsingId === q.id || !(rawInputText[q.id] || '').trim()}
                              onClick={() => handleAIParse(q.id)}
                              className="mt-2 btn-primary text-[12px] px-3 py-1.5 disabled:opacity-50 flex items-center gap-1.5"
                            >
                              <Wand2 size={12} />
                              {aiParsingId === q.id ? 'AI Parsing...' : 'Parse with AI'}
                            </button>
                          </div>

                          {/* Structured fields */}
                          <div className="grid grid-cols-1 gap-3">
                            <div>
                              <label className="text-[11px] font-medium text-[var(--text-secondary)] mb-1 block">Title</label>
                              <input
                                type="text"
                                value={q.title}
                                onChange={e => updatePracticeField(q.id, 'title', e.target.value)}
                                className="w-full px-3 py-2 text-[13px] rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-active)] transition-colors"
                                placeholder="Question title"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-medium text-[var(--text-secondary)] mb-1 block">Description</label>
                              <textarea
                                value={q.description}
                                onChange={e => updatePracticeField(q.id, 'description', e.target.value)}
                                rows={4}
                                className="w-full px-3 py-2 text-[12px] rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-active)] transition-colors resize-y"
                                placeholder="Full problem description..."
                              />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="text-[11px] font-medium text-[var(--text-secondary)] mb-1 block">Input Format</label>
                                <textarea
                                  value={q.inputFormat}
                                  onChange={e => updatePracticeField(q.id, 'inputFormat', e.target.value)}
                                  rows={2}
                                  className="w-full px-3 py-2 text-[12px] rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-active)] transition-colors resize-y font-mono"
                                  placeholder="e.g. First line: N, Second line: array"
                                />
                              </div>
                              <div>
                                <label className="text-[11px] font-medium text-[var(--text-secondary)] mb-1 block">Output Format</label>
                                <textarea
                                  value={q.outputFormat}
                                  onChange={e => updatePracticeField(q.id, 'outputFormat', e.target.value)}
                                  rows={2}
                                  className="w-full px-3 py-2 text-[12px] rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-active)] transition-colors resize-y font-mono"
                                  placeholder="e.g. Single integer — the answer"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="text-[11px] font-medium text-[var(--text-secondary)] mb-1 block">Constraints (one per line)</label>
                              <textarea
                                value={q.constraints.join('\n')}
                                onChange={e => updatePracticeField(q.id, 'constraints', e.target.value.split('\n'))}
                                rows={2}
                                className="w-full px-3 py-2 text-[12px] rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-active)] transition-colors resize-y font-mono"
                                placeholder="1 <= N <= 10^5"
                              />
                            </div>
                          </div>

                          {/* Sample Test Cases */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Sample Test Cases (visible to students)</label>
                              <button type="button" onClick={() => addPracticeSampleTC(q.id)} className="text-[11px] text-[#5E6AD2] font-medium hover:underline flex items-center gap-1">
                                <Plus size={11} /> Add
                              </button>
                            </div>
                            {q.sampleTestCases.map((tc, i) => (
                              <div key={tc.id} className="rounded border border-[var(--border-subtle)] p-2.5 mb-2 bg-[var(--bg-primary)]">
                                <div className="flex items-center justify-between mb-1.5">
                                  <p className="text-[10px] font-semibold text-[var(--text-faint)]">Sample {i + 1}</p>
                                  <button type="button" onClick={() => removePracticeSampleTC(q.id, tc.id)} className="p-0.5 text-[var(--text-faint)] hover:text-[#F54E00]">
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <textarea
                                    value={tc.input}
                                    onChange={e => updatePracticeSampleTC(q.id, tc.id, 'input', e.target.value)}
                                    rows={2}
                                    className="w-full px-2 py-1.5 text-[11px] rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-active)] font-mono resize-y"
                                    placeholder="Input"
                                  />
                                  <textarea
                                    value={tc.output}
                                    onChange={e => updatePracticeSampleTC(q.id, tc.id, 'output', e.target.value)}
                                    rows={2}
                                    className="w-full px-2 py-1.5 text-[11px] rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-active)] font-mono resize-y"
                                    placeholder="Expected Output"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Test Cases toggle */}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => updatePracticeField(q.id, 'hasTestCases', !q.hasTestCases)}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                                q.hasTestCases ? 'bg-[#5E6AD2]' : 'bg-[var(--border-subtle)]'
                              }`}
                            >
                              <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${q.hasTestCases ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>
                            <span className="text-[12px] text-[var(--text-secondary)]">Enable hidden test cases for grading</span>
                          </div>

                          {/* Hidden Test Cases */}
                          {q.hasTestCases && (
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <label className="text-[11px] font-semibold text-[var(--text-secondary)] flex items-center gap-1">
                                  <EyeOff size={11} /> Hidden Test Cases
                                </label>
                                <button
                                  type="button"
                                  disabled={aiTestCaseGenId === q.id || !q.description.trim()}
                                  onClick={() => handleGeneratePracticeTestCases(q.id)}
                                  className="text-[11px] text-[#5E6AD2] font-medium hover:underline flex items-center gap-1 disabled:opacity-50"
                                >
                                  <Wand2 size={11} />
                                  {aiTestCaseGenId === q.id ? 'Generating...' : 'AI Generate'}
                                </button>
                              </div>
                              {q.hiddenTestCases.map((tc, i) => (
                                <div key={tc.id} className="rounded border border-[var(--border-subtle)] p-2.5 mb-2 bg-[var(--bg-primary)]">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <p className="text-[10px] font-semibold text-[var(--text-faint)] flex items-center gap-1">
                                      <EyeOff size={10} /> Hidden {i + 1}
                                    </p>
                                    <button type="button" onClick={() => removePracticeHiddenTC(q.id, tc.id)} className="p-0.5 text-[var(--text-faint)] hover:text-[#F54E00]">
                                      <Trash2 size={11} />
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <textarea
                                      value={tc.input}
                                      onChange={e => updatePracticeHiddenTC(q.id, tc.id, 'input', e.target.value)}
                                      rows={2}
                                      className="w-full px-2 py-1.5 text-[11px] rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-active)] font-mono resize-y"
                                      placeholder="Input"
                                    />
                                    <textarea
                                      value={tc.output}
                                      onChange={e => updatePracticeHiddenTC(q.id, tc.id, 'output', e.target.value)}
                                      rows={2}
                                      className="w-full px-2 py-1.5 text-[11px] rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-active)] font-mono resize-y"
                                      placeholder="Expected Output"
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Hints */}
                          <div>
                            <label className="text-[11px] font-medium text-[var(--text-secondary)] mb-1 block">Hints (one per line, optional)</label>
                            <textarea
                              value={q.hints.join('\n')}
                              onChange={e => updatePracticeField(q.id, 'hints', e.target.value.split('\n'))}
                              rows={2}
                              className="w-full px-3 py-2 text-[12px] rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-active)] transition-colors resize-y"
                              placeholder="Think about edge cases..."
                            />
                          </div>

                          {/* Marks */}
                          <div className="flex items-center gap-3">
                            <label className="text-[11px] font-medium text-[var(--text-secondary)]">Points:</label>
                            <input
                              type="number"
                              min={1}
                              value={q.marks}
                              onChange={e => updatePracticeField(q.id, 'marks', Number(e.target.value))}
                              className="w-20 px-2 py-1.5 text-[12px] rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-active)]"
                            />
                          </div>

                          {/* Remove question */}
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => removePracticeItem(q.id)}
                              className="text-[11px] text-[#F54E00] hover:underline flex items-center gap-1"
                            >
                              <Trash2 size={11} /> Remove Question
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>

            <button
              type="button"
              onClick={addPracticeItem}
              className="btn-secondary w-full flex items-center justify-center gap-2"
            >
              <Plus size={14} />
              Add {activeTierTab.charAt(0).toUpperCase() + activeTierTab.slice(1)} Question
            </button>

            {practiceItems.length > 0 && (
              <button
                type="button"
                disabled={savingPractice || !title.trim()}
                onClick={handleSaveNewPracticeQuestions}
                className="btn-primary w-full disabled:opacity-50"
              >
                {savingPractice ? 'Creating Practice Set...' : `Create Practice Set (${practiceItems.filter(q => q.title.trim() && q.description.trim()).length} question${practiceItems.filter(q => q.title.trim() && q.description.trim()).length !== 1 ? 's' : ''})`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
