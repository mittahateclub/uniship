'use server';

import { groq } from "@/lib/groq";

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
          "title": "Problem title",
          "questionDescription": "Full problem statement",
          "difficulty": "EASY",
          "functionName": "",
          "constraints": [],
          "inputFormat": "",
          "outputFormat": "",
          "sampleTestCases": [{ "input": "", "output": "" }],
          "hiddenTestCases": [{ "input": "", "output": "" }]
        }
      ]
    }
  ]
}`;

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
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Detect MIME type from extension
  const ext = file.name.split('.').pop()?.toLowerCase();
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

export async function processTestDocument(formData: FormData) {
  try {
    const file = formData.get("file") as File;
    if (!file) throw new Error("No file uploaded");

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
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" },
      temperature: 0,
      // Headroom for 40 MCQs + live coding section. Previously 8000 truncated the tail
      // (last MCQs + coding problems). 16000 comfortably covers a full paper.
      max_tokens: 16000,
    });

    const content = questionsCompletion.choices[0].message.content || "{}";
    const parsedData = JSON.parse(content);

    console.log('Parsed data structure:', JSON.stringify(parsedData, null, 2).slice(0, 500));

    // 6. Validate the parsed data
    const sections: any[] = parsedData.sections && Array.isArray(parsedData.sections) ? parsedData.sections : [];

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
        (q: any) => !q.options || q.options.length < 4
      );
      if (broken.length > 0) {
        console.warn(`Section ${si} ("${section.title}") has ${broken.length} questions with missing options — retrying`);
        sectionsNeedingRetry.push(si);
      }
    }

    if (sectionsNeedingRetry.length > 0) {
      // Re-run just the broken sections in parallel, each with its own focused prompt
      const retryPromises = sectionsNeedingRetry.map(async (si) => {
        const section = sections[si];
        // Find the text for this section by searching in the extracted document
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
          model: 'llama-3.3-70b-versatile',
          response_format: { type: 'json_object' },
          temperature: 0,
          max_tokens: 4000,
        });
        try {
          const retryData = JSON.parse(retryCompletion.choices[0]?.message?.content || '{}');
          const retrySections: any[] = retryData.sections || [];
          // Find the matching section in the retry result (by index or title)
          const match = retrySections.find((s: any) =>
            s.title === section.title || s.type === section.type
          ) || retrySections[0];
          if (match && (match.questions || []).length > 0) {
            sections[si].questions = match.questions;
            console.log(`Retry for section ${si} succeeded: ${match.questions.length} questions`);
          }
        } catch (e) {
          console.warn(`Retry parse failed for section ${si}:`, e);
        }
      });
      await Promise.all(retryPromises);
      // Recount after retries
      totalQuestionCount = sections.reduce((sum: number, s: any) => sum + (s.questions || []).length, 0);
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

    // Build legacy problems array from coding sections for backward compatibility
    const codingProblems: any[] = [];
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
  } catch (error: any) {
    console.error("Test Pipeline Error:", error);
    return { 
      success: false, 
      error: error.message || 'An unknown error occurred' 
    };
  }
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
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      temperature: 0.05, // Near-deterministic for fair grading
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
  } catch (error: any) {
    console.error('Evaluation Pipeline Error:', error);
    return {
      success: false,
      error: error.message || 'An unknown error occurred during evaluation.',
    };
  }
}