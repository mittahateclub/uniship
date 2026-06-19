'use server';

import { groq } from "@/lib/groq";
import { generateHiddenTestCases } from "@/app/actions/generate-hidden-test-cases";

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const MAX_BACKGROUND_CONCURRENCY = 2;

async function forEachWithConcurrency<T>(
  items: T[],
  concurrency: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const item = items[nextIndex++];
      await task(item);
    }
  });
  await Promise.all(workers);
}

// ── System prompt for test CREATION (single PDF → structured questions + answers JSON) ──
const SYSTEM_PROMPT = `You are a document-to-JSON extraction agent. Your ONLY job is to faithfully transcribe an exam paper into structured JSON — do NOT invent answers or use your own knowledge.

The paper is a single document that contains, for every question: the question text with A/B/C/D options and the correct answer (as a letter). It may be laid out as a table with columns like "Q No. | Question & Options | Answer", or as question blocks followed by an "Answer:" line. Sections may include MCQ sections and optionally Live Coding sections.

Rules:
1. Output ONLY valid JSON. No markdown, no comments, no extra text.
2. Copy every question and every option EXACTLY as written. Do not paraphrase, correct, or reorder.
3. OPTIONS MUST BE IN THEIR ORIGINAL DOCUMENT ORDER — A first, then B, then C, then D. Never reorder.
4. For options: strip only the letter prefix ("A.", "(A)", "A)") — keep ALL other text verbatim including symbols, code, angle brackets like <class 'list'>.
5. Classify: question with A/B/C/D options → type "mcq". A "Live Coding" / "Coding Problems" problem (has a Problem Statement and usually a Model Solution) → type "coding". NO other types.
6. Include ALL questions from ALL sections. Do not skip any — this includes every MCQ (e.g. Q1–Q40) AND every coding problem in the Live Coding section. Never stop early.
7. correctAnswer: extract the letter (A/B/C/D) from the Answer column/line for that question. If the doc shows "(C) 60 seconds", output just "C". If absolutely no answer is present, use null.
8. Include a "questionNumber" field on each question with its number as it appears in the document (e.g. 1, 2, 3...).

JSON structure:
{
  "metadata": { "totalProblems": number },
  "sections": [
    {
      "type": "mcq",
      "title": "Section title from document",
      "questions": [
        {
          "questionNumber": 1,
          "questionDescription": "Exact question text",
          "options": ["option A text", "option B text", "option C text", "option D text"],
          "correctAnswer": "C",
          "difficulty": "EASY"
        }
      ]
    },
    {
      "type": "coding",
      "title": "Section title from document",
      "questions": [
        {
          "questionNumber": 1,
          "title": "Problem title from document",
          "questionDescription": "Full problem statement verbatim",
          "difficulty": "EASY",
          "functionName": "function_name_if_specified_else_empty_string",
          "constraints": ["1 <= n <= 10^5", "0 <= arr[i] <= 10^9"],
          "inputFormat": "Description of input format from document, or empty string",
          "outputFormat": "Description of output format from document, or empty string",
          "sampleTestCases": [{ "input": "", "output": "" }],
          "hiddenTestCases": []
        }
      ]
    }
  ]
}

IMPORTANT for coding questions:
- "constraints" MUST be a JSON array of strings — extract EVERY constraint line from the document (e.g. "1 <= n <= 10^5", "1 <= arr[i] <= 1000", "String length <= 500"). If none mentioned, use [].
- "inputFormat" and "outputFormat": copy the Input Format / Output Format sections verbatim if present.
- "sampleTestCases": extract any sample/example input-output pairs shown in the document. If none are shown, use [].
- "hiddenTestCases": always leave as [] — these are generated separately.`;

// ── System prompt for EVALUATION (questions PDF + answers PDF → graded result) ──
const EVALUATION_SYSTEM_PROMPT = `You are a precise AI Exam Grader. You receive TWO documents:

<QUESTIONS_DOCUMENT>  — Contains all exam questions (MCQs and/or Coding problems)
<ANSWERS_DOCUMENT>    — Contains either student responses OR an official answer key

────────────────────────────────────────
STEP 1: PARSE BOTH DOCUMENTS
────────────────────────────────────────
From QUESTIONS_DOCUMENT extract:
• Question identifier (Q1, Q2, 1., 2., etc.)
• Question type: MCQ (has options A/B/C/D) or Coding (has problem statement, I/O format)
• Question text and options (for MCQ) or full problem (for Coding)

From ANSWERS_DOCUMENT extract:
• The selected option letter for each MCQ (A/B/C/D)
• The code snippet or explanation for each Coding question
• Mark as "Not Attempted" if no answer is found for a question

────────────────────────────────────────
STEP 2: MATCH & EVALUATE
────────────────────────────────────────
Match questions to answers by their identifier. Be tolerant of formatting differences (Q1 = 1. = Question 1).

MCQ SCORING:
• +1.00  → Correct
• −0.25  → Incorrect (negative marking)
•  0.00  → Not Attempted

CODING SCORING (5 marks max per question):
┌────────────────────┬───────┐
│ Criterion          │ Marks │
├────────────────────┼───────┤
│ Correct Output     │   2   │
│ Logic & Approach   │   1   │
│ Code Quality       │   1   │
│ Optimization       │   1   │
└────────────────────┴───────┘

Deduct proportionally for partial correctness. Award 0 for completely wrong or missing code.

────────────────────────────────────────
STEP 3: OUTPUT FORMAT (strict JSON)
────────────────────────────────────────
{
  "summary": {
    "total_questions": <int>,
    "attempted": <int>,
    "correct": <int>,
    "incorrect": <int>,
    "not_attempted": <int>,
    "score": <float>,
    "max_score": <float>,
    "percentage": <float>
  },
  "section_wise": {
    "MCQ": {
      "total": <int>,
      "attempted": <int>,
      "correct": <int>,
      "incorrect": <int>,
      "score": <float>,
      "max_score": <float>
    },
    "Coding": {
      "total": <int>,
      "attempted": <int>,
      "score": <float>,
      "max_score": <float>,
      "breakdown": [
        { "question": "Q5", "score": <float>, "max": 5, "feedback": "..." }
      ]
    }
  },
  "detailed_analysis": [
    {
      "question": "Q1",
      "type": "MCQ",
      "question_text": "...",
      "student_answer": "B",
      "correct_answer": "C",
      "result": "Incorrect",
      "marks_awarded": -0.25,
      "explanation": "Option B is wrong because..."
    },
    {
      "question": "Q5",
      "type": "Coding",
      "question_text": "...",
      "student_code": "...",
      "result": "Partial",
      "marks_awarded": 3,
      "breakdown": {
        "correct_output": 1,
        "logic": 1,
        "code_quality": 1,
        "optimization": 0
      },
      "explanation": "Logic is correct but time complexity is O(n²) instead of O(n)."
    }
  ]
}

────────────────────────────────────────
RULES
────────────────────────────────────────
• Return ONLY valid JSON — no markdown, no extra text.
• Do NOT hallucinate answers. If ambiguous, explain in the explanation field.
• If an answer is missing, set result = "Not Attempted" and marks_awarded = 0.
• Always provide a brief explanation for incorrect or partial answers.
• Be strict but fair — partial credit where deserved.
• For coding: if code is incomplete but logic is explained, award partial marks for logic/approach.`;

// ── Shared helper: extract text from PDF or DOCX via LlamaParse ──
async function extractTextFromFile(file: File): Promise<string> {
  if (file.size > MAX_DOCUMENT_BYTES) {
    throw new Error(`Document exceeds the ${MAX_DOCUMENT_BYTES / 1024 / 1024} MB upload limit.`);
  }
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext !== 'pdf' && ext !== 'docx') {
    throw new Error('Only PDF and DOCX documents are supported.');
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Detect MIME type from extension
  const mimeType = ext === 'docx'
    ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    : 'application/pdf';

  const uploadFormData = new FormData();
  const blob = new Blob([buffer], { type: mimeType });
  uploadFormData.append('file', blob, file.name);

  console.log(`[LlamaParse] Uploading ${file.name} (${mimeType})...`);
  const parseResponse = await fetch('https://api.cloud.llamaindex.ai/api/parsing/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.LLAMA_CLOUD_API_KEY}`,
      'Accept': 'application/json',
    },
    body: uploadFormData,
    signal: AbortSignal.timeout(30_000),
  });

  if (!parseResponse.ok) {
    const errorText = await parseResponse.text();
    throw new Error(`LlamaParse upload failed: ${parseResponse.status} - ${errorText}`);
  }

  const { id: jobId } = await parseResponse.json();
  console.log(`[LlamaParse] Job ID: ${jobId}`);

  // Poll with exponential backoff (1s → 5s cap, ~2 min max)
  let delay = 1000;
  for (let attempt = 1; attempt <= 40; attempt++) {
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.5, 5000);

    const statusRes = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.LLAMA_CLOUD_API_KEY}`,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!statusRes.ok) continue;
    const { status } = await statusRes.json();
    console.log(`[LlamaParse] Attempt ${attempt}: ${status}`);

    if (status === 'SUCCESS') {
      const resultRes = await fetch(
        `https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}/result/markdown`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.LLAMA_CLOUD_API_KEY}`,
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(20_000),
        }
      );
      if (resultRes.ok) {
        const { markdown, text } = await resultRes.json();
        return markdown || text || '';
      }
    } else if (status === 'ERROR' || status === 'FAILED') {
      throw new Error(`LlamaParse job failed with status: ${status}`);
    }
  }

  throw new Error('LlamaParse timeout: document processing took too long.');
}

export async function processTestFile(file: File) {
  try {
    console.log('Starting document processing for:', file.name);

    // Extract text from the single combined PDF (questions + answers + explanations)
    const extractedText = await extractTextFromFile(file);

    if (!extractedText) {
      throw new Error('Failed to parse document: empty result');
    }

    // Escape bare angle brackets so the LLM preserves them (e.g. Python <class 'list'> in options).
    // Only escape brackets that are NOT part of our XML-style delimiters.
    const safeQuestionsText = extractedText
      .replace(/<(?!\/?(QUESTIONS_DOCUMENT|ANSWER_KEY|ANSWERS_DOCUMENT)[ >])/g, "&lt;")
      .replace(/(?<![A-Z_])>/g, (m, offset, str) => {
        // Keep closing delimiter tags intact, escape everything else
        const before = str.slice(Math.max(0, offset - 30), offset);
        return /\/(QUESTIONS_DOCUMENT|ANSWER_KEY|ANSWERS_DOCUMENT)$/.test(before) ? m : "&gt;";
      });

    // Single-pass extraction: questions + correct answers in one JSON response.
    console.log('Parsing questions and answers...');

    const questionsCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: safeQuestionsText.slice(0, 30000) },
      ],
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      response_format: { type: "json_object" },
      temperature: 0,
      // Llama 4 Scout hard output cap is 8192 tokens
      max_tokens: 8192,
    });

    const content = questionsCompletion.choices[0].message.content || "{}";
    const parsedData = JSON.parse(content);

    console.log('Parsed data structure:', JSON.stringify(parsedData, null, 2).slice(0, 500));

    // 6. Validate the parsed data
    interface ParsedTestCase { input?: string; output?: string }
    interface ParsedQuestion {
      title?: string; questionDescription?: string; constraints?: string[];
      inputFormat?: string; outputFormat?: string; options?: string[];
      correctAnswer?: string | null;
      sampleTestCases?: ParsedTestCase[]; hiddenTestCases?: ParsedTestCase[];
      [k: string]: unknown;
    }
    interface ParsedSection { type?: string; title?: string; questions?: ParsedQuestion[] }
    const sections: ParsedSection[] = parsedData.sections && Array.isArray(parsedData.sections) ? parsedData.sections : [];

    if (sections.length === 0) {
      throw new Error('No sections were extracted from the document');
    }

    // Count total questions across all sections
    let totalQuestionCount = 0;
    for (const section of sections) {
      totalQuestionCount += (section.questions || []).length;
    }

    if (totalQuestionCount === 0) {
      throw new Error('No questions were extracted from any section');
    }

    // ── Validate: detect MCQ questions with missing/empty options and retry those sections ──
    const sectionsNeedingRetry: number[] = [];
    for (let si = 0; si < sections.length; si++) {
      const section = sections[si];
      if (section.type !== 'mcq') continue;
      const broken = (section.questions || []).filter(
        (q: ParsedQuestion) => !q.options || q.options.length < 4
      );
      if (broken.length > 0) {
        console.warn(`Section ${si} ("${section.title}") has ${broken.length} questions with missing options — retrying`);
        sectionsNeedingRetry.push(si);
      }
    }

    if (sectionsNeedingRetry.length > 0) {
      // Re-run broken sections with bounded concurrency to avoid provider bursts.
      await forEachWithConcurrency(sectionsNeedingRetry, MAX_BACKGROUND_CONCURRENCY, async (si) => {
        try {
          const section = sections[si];
          const sectionTitle = section.title || '';
          const sectionStart = safeQuestionsText.indexOf(sectionTitle.replace(/section\s*/i, '').trim());
          const sectionText = sectionStart >= 0
            ? safeQuestionsText.slice(sectionStart, sectionStart + 8000)
            : safeQuestionsText.slice(0, 8000);
          const retryCompletion = await groq.chat.completions.create({
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: `Extract ONLY this section. Include ALL options for every question:\n\n${sectionText}` },
            ],
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
            response_format: { type: 'json_object' },
            temperature: 0,
            max_tokens: 4000,
          });
          const retryData = JSON.parse(retryCompletion.choices[0]?.message?.content || '{}');
          const retrySections: ParsedSection[] = retryData.sections || [];
          // Find the matching section in the retry result (by index or title)
          const match = retrySections.find((s: ParsedSection) =>
            s.title === section.title || s.type === section.type
          ) || retrySections[0];
          if (match && (match.questions || []).length > 0) {
            sections[si].questions = match.questions;
            console.log(`Retry for section ${si} succeeded: ${match.questions?.length ?? 0} questions`);
          }
        } catch (e) {
          console.warn(`Retry parse failed for section ${si}:`, e);
        }
      });
      // Recount after retries
      totalQuestionCount = sections.reduce((sum: number, s: ParsedSection) => sum + (s.questions || []).length, 0);
    }

    // Normalize correctAnswer values: strip prefixes like "(C)" → "C", uppercase, keep letter only.
    for (const section of sections) {
      for (const q of section.questions || []) {
        if (typeof q.correctAnswer === 'string') {
          const m = q.correctAnswer.match(/[A-Da-d]/);
          q.correctAnswer = m ? m[0].toUpperCase() : null;
        }
      }
    }

    // ── Generate test cases for coding questions that have empty sampleTestCases ──
    const codingQsNeedingTestCases: Array<{ section: ParsedSection; q: ParsedQuestion }> = [];
    for (const section of sections) {
      if (section.type !== 'coding') continue;
      for (const q of section.questions || []) {
        const samples: ParsedTestCase[] = q.sampleTestCases || [];
        const hasRealSamples = samples.some((tc: ParsedTestCase) => tc.input?.trim() || tc.output?.trim());
        if (!hasRealSamples) {
          codingQsNeedingTestCases.push({ section, q });
        }
      }
    }

    if (codingQsNeedingTestCases.length > 0) {
      console.log(`Generating test cases for ${codingQsNeedingTestCases.length} coding question(s)...`);
      await forEachWithConcurrency(
        codingQsNeedingTestCases,
        MAX_BACKGROUND_CONCURRENCY,
        async ({ q }) => {
          try {
            // Build a rich context string matching what practice questions pass
            const parts: string[] = [];
            if (q.title) parts.push(`Problem: ${q.title}`);
            if (q.questionDescription) parts.push(`\nDescription:\n${q.questionDescription}`);
            if (q.constraints && q.constraints.length > 0) {
              parts.push(`\nConstraints:\n${q.constraints.map((c: string) => `- ${c}`).join('\n')}`);
            }
            if (q.inputFormat) parts.push(`\nInput Format:\n${q.inputFormat}`);
            if (q.outputFormat) parts.push(`\nOutput Format:\n${q.outputFormat}`);
            const richQuestionText = parts.join('') || q.questionDescription || q.title || '';

            // Existing PDF sample cases (if any) to anchor the reference solution
            const existingSamples = (q.sampleTestCases || []).filter(
              (tc: ParsedTestCase) => tc.input?.trim() || tc.output?.trim()
            );

            const result = await generateHiddenTestCases(
              richQuestionText,
              5, // 1 sample + 4 hidden
              existingSamples.length > 0 ? existingSamples.map((tc) => ({ input: tc.input ?? '', output: tc.output ?? '' })) : undefined,
            );
            if (result.success && result.cases && result.cases.length > 0) {
              q.sampleTestCases = [result.cases[0]];
              q.hiddenTestCases = result.cases.slice(1);
              console.log(`Generated ${result.cases.length} test cases for: ${(q.title || q.questionDescription || '').slice(0, 60)}`);
            }
          } catch (e) {
            console.warn(`Failed to generate test cases for coding question:`, e);
          }
        },
      );
    }

    // Build legacy problems array from coding sections for backward compatibility
    const codingProblems: ParsedQuestion[] = [];
    for (const section of sections) {
      if (section.type === 'coding') {
        for (const q of section.questions || []) {
          codingProblems.push(q);
        }
      }
    }

    console.log('Extracted', totalQuestionCount, 'questions total across', sections.length, 'sections');

    return { 
      success: true, 
      sections,
      codingProblems,
      metadata: parsedData.metadata || {
        difficultyLevels: [],
        totalProblems: totalQuestionCount
      },
      totalQuestionCount,
      sourceFileName: file.name,
    };
  } catch (error) {
    console.error("Test Pipeline Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    };
  }
}

export async function processTestDocument(formData: FormData) {
  const file = formData.get('file');
  if (!(file instanceof File)) return { success: false, error: 'No file uploaded' };
  return processTestFile(file);
}

// ── Evaluate exam: questions doc + answers doc → graded result JSON ──
export async function evaluateExam(formData: FormData) {
  try {
    const questionsFile = formData.get('questionsFile') as File;
    const answersFile = formData.get('answersFile') as File;

    if (!questionsFile) throw new Error('Questions document is required.');
    if (!answersFile) throw new Error('Answers document is required.');

    console.log('Evaluating exam:', questionsFile.name, '+', answersFile.name);

    // Parse both documents in parallel
    const [questionsText, answersText] = await Promise.all([
      extractTextFromFile(questionsFile),
      extractTextFromFile(answersFile),
    ]);

    if (!questionsText) throw new Error('Could not extract text from the questions document.');
    if (!answersText) throw new Error('Could not extract text from the answers document.');

    console.log(`Questions: ${questionsText.length} chars | Answers: ${answersText.length} chars`);

    // Combine with clear delimiters for the model
    const combinedPrompt =
      `<QUESTIONS_DOCUMENT>\n${questionsText.slice(0, 15000)}\n</QUESTIONS_DOCUMENT>\n\n` +
      `<ANSWERS_DOCUMENT>\n${answersText.slice(0, 15000)}\n</ANSWERS_DOCUMENT>`;

    console.log('Running evaluation via Groq...');
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: EVALUATION_SYSTEM_PROMPT },
        { role: 'user', content: combinedPrompt },
      ],
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      response_format: { type: 'json_object' },
      temperature: 0.05, // Near-deterministic for fair grading
      max_tokens: 8192,
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    const result = JSON.parse(raw);

    if (!result.summary || !result.detailed_analysis) {
      throw new Error('Evaluation returned incomplete data. Please try again.');
    }

    console.log('Evaluation complete. Questions evaluated:', result.detailed_analysis?.length);

    return {
      success: true,
      evaluation: result,
      questionsFileName: questionsFile.name,
      answersFileName: answersFile.name,
    };
  } catch (error) {
    console.error('Evaluation Pipeline Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred during evaluation.',
    };
  }
}
