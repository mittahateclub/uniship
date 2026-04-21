// app/(protected)/uniadmin/tests/review/[id]/page.tsx
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CheckCircle2, BookOpen, Brain, Code2 } from 'lucide-react';

const sectionMeta: Record<string, { icon: typeof BookOpen; color: string; label: string }> = {
  aptitude: { icon: BookOpen, color: 'text-teal-400', label: 'Aptitude' },
  mcq: { icon: Brain, color: 'text-amber-400', label: 'Coding MCQs' },
  coding: { icon: Code2, color: 'text-[#4B8BBE]', label: 'Live Coding' },
};

export default function ReviewGeneratedQuestions() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { id } = useParams();
  const [testData, setTestData] = useState<any>(null);
  const [fetching, setFetching] = useState(true);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  useEffect(() => {
    async function fetchTestData() {
      if (!id) return;
      try {
        const testDoc = await getDoc(doc(db, 'tests', id as string));
        if (testDoc.exists()) setTestData(testDoc.data());
      } catch (error) {
        console.error("Error fetching test:", error);
      } finally {
        setFetching(false);
      }
    }
    fetchTestData();
  }, [id]);

  const handlePublish = async () => {
    if (!id || !window.confirm("Are you sure you want to publish this test?")) return;
    setPublishing(true);
    try {
      await updateDoc(doc(db, 'tests', id as string), {
        approved: true,
        published: true,
        publishedAt: new Date().toISOString(),
        publishedBy: user?.uid,
      });
      alert("Test published successfully!");
      router.push('/uniadmin/create-test');
    } catch (error) {
      console.error("Error publishing test:", error);
      alert("Failed to publish test.");
    } finally {
      setPublishing(false);
    }
  };

  if (loading || fetching) return (
    <div className="flex items-center justify-center h-64">
      <div className="loading-dots"><span /><span /><span /></div>
    </div>
  );
  if (!testData) return (
    <div className="window p-12 text-center">
      <p className="text-[#00A8E1] text-[13px]">Test not found.</p>
    </div>
  );

  const sections: any[] = testData.sections || [];
  const hasOnlyCodingProblems = sections.length === 0 && testData.problems?.length > 0;

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-[-0.02em]">{testData.title || testData.sourceFileName}</h1>
        {testData.published && (
          <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-bold uppercase tracking-widest text-[#4CAF50] bg-[#4CAF50]/10 px-2 py-0.5 rounded">
            <CheckCircle2 size={10} /> Published
          </span>
        )}
      </div>

      <div className="space-y-6">
        {/* Render sections */}
        {sections.map((section: any, sIdx: number) => {
          const meta = sectionMeta[section.type] || sectionMeta.coding;
          const Icon = meta.icon;
          return (
            <div key={sIdx}>
              <div className="flex items-center gap-2 mb-3">
                <Icon size={16} className={meta.color} />
                <h2 className="text-[14px] font-bold text-[var(--text-primary)]">
                  {section.title || `Section ${sIdx + 1}: ${meta.label}`}
                </h2>
                <span className="text-[11px] text-[var(--text-faint)]">
                  ({(section.questions || []).length} questions)
                </span>
              </div>

              <div className="space-y-3">
                {(section.questions || []).map((q: any, qIdx: number) => (
                  <div key={qIdx} className="window p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${
                        section.type === 'mcq' ? 'text-amber-400 bg-amber-400/10'
                        : 'text-[#4B8BBE] bg-[#4B8BBE]/10'
                      }`}>
                        Q{qIdx + 1}
                      </span>
                    </div>

                    <h3 className="text-[14px] font-medium text-[var(--text-primary)] mb-3 whitespace-pre-wrap">
                      {q.questionDescription || q.questionText}
                    </h3>

                    {/* MCQ options */}
                    {section.type === 'mcq' && q.options && (
                      <div className="space-y-1.5 mb-3">
                        {q.options.map((opt: string, oIdx: number) => {
                          const letter = String.fromCharCode(65 + oIdx);
                          const isCorrect = q.correctAnswer === letter;
                          return (
                            <div key={oIdx} className={`flex items-center gap-2 px-3 py-2 rounded text-[13px] border ${
                              isCorrect
                                ? 'border-[#4CAF50]/30 bg-[#4CAF50]/10 text-[#4CAF50] font-medium'
                                : 'border-[var(--border-subtle)] text-[var(--text-secondary)]'
                            }`}>
                              <span className="font-semibold text-[12px]">{letter}.</span>
                              {opt}
                              {isCorrect && <CheckCircle2 size={12} className="ml-auto" />}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Aptitude answer (legacy — kept for backwards compat) */}
                    {section.type === 'aptitude' && q.correctAnswer && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded border border-[#4CAF50]/30 bg-[#4CAF50]/10 text-[13px] text-[#4CAF50] font-medium">
                        <CheckCircle2 size={12} />
                        Answer: {q.correctAnswer}
                      </div>
                    )}

                    {/* Coding test cases */}
                    {section.type === 'coding' && q.sampleTestCases && q.sampleTestCases.length > 0 && (
                      <div className="mt-3 space-y-1">
                        <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Sample Case:</p>
                        <pre className="bg-[var(--bg-elevated)] p-3 rounded text-[12px] text-[#4CAF50] font-mono">
{`Input: ${q.sampleTestCases[0]?.input}\nOutput: ${q.sampleTestCases[0]?.output}`}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Fallback: legacy problems array (no sections) */}
        {hasOnlyCodingProblems && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Code2 size={16} className="text-[#4B8BBE]" />
              <h2 className="text-[14px] font-bold text-[var(--text-primary)]">Coding Problems</h2>
              <span className="text-[11px] text-[var(--text-faint)]">({testData.problems.length} questions)</span>
            </div>
            <div className="space-y-3">
              {testData.problems.map((q: any, index: number) => (
                <div key={index} className="window p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#4B8BBE] bg-[#4B8BBE]/10 px-2 py-0.5 rounded">
                      {q.difficulty || 'Q'} — Q{index + 1}
                    </span>
                  </div>
                  <h3 className="text-[14px] font-medium text-[var(--text-primary)] mb-4 whitespace-pre-wrap">{q.questionDescription}</h3>
                  {q.sampleTestCases && q.sampleTestCases.length > 0 && (
                    <div className="mt-3 space-y-1">
                      <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Sample Case:</p>
                      <pre className="bg-[var(--bg-elevated)] p-3 rounded text-[12px] text-[#4CAF50] font-mono">
{`Input: ${q.sampleTestCases[0]?.input}\nOutput: ${q.sampleTestCases[0]?.output}`}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-6 flex justify-center">
          <button
            onClick={handlePublish}
            disabled={publishing || testData.published}
            className="btn-primary px-8 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {publishing ? 'Publishing...' : testData.published ? 'Already Published' : 'Approve & Publish Test'}
          </button>
        </div>
      </div>
    </div>
  );
}