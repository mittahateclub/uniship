'use server';

import { groq } from "@/lib/groq";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

const SYSTEM_PROMPT = `You are a strict Markdown-to-JSON conversion agent for test/exam papers.

Your task is to convert the given markdown document into structured JSON. The test paper may contain up to THREE types of sections:

1. **Aptitude Questions** — text-based questions with a correct answer (e.g. math, reasoning, data interpretation)
2. **Coding MCQs** — multiple choice questions about programming with 4 options (A, B, C, D)
3. **Live Coding Questions** — full coding problems with test cases, input/output format

Detect which sections exist in the document and classify each question accordingly.

Rules:
1. Output ONLY valid JSON. No markdown, comments, or extra text.
2. Preserve ALL information faithfully — every question, every option, every answer, every test case.
3. Use camelCase for all JSON keys.
4. Detect question types by content: if it has options A/B/C/D about code → "mcq". If it's a math/reasoning question with a short textual answer → "aptitude". If it has input format, output format, test cases → "coding".
5. If sections are labeled in the document (e.g. "Section 1 — Aptitude"), use those labels to classify questions.

Expected JSON structure:
{
  "metadata": {
    "difficultyLevels": [],
    "totalProblems": number
  },
  "sections": [
    {
      "type": "aptitude",
      "title": "Section 1: Aptitude",
      "questions": [
        {
          "questionDescription": "Full question text",
          "correctAnswer": "The answer",
          "difficulty": "EASY"
        }
      ]
    },
    {
      "type": "mcq",
      "title": "Section 2: Coding MCQs",
      "questions": [
        {
          "questionDescription": "Question text including any code snippets",
          "options": ["6", "8", "9", "Error"],
          "correctAnswer": "B",
          "difficulty": "EASY"
        }
      ]
    },
    {
      "type": "coding",
      "title": "Section 3: Live Coding",
      "questions": [
        {
          "title": "Problem title",
          "questionDescription": "Full problem statement",
          "difficulty": "EASY",
          "functionName": "",
          "constraints": [],
          "inputFormat": "string",
          "outputFormat": "string",
          "sampleTestCases": [
            { "input": "string", "output": "string" }
          ],
          "hiddenTestCases": [
            { "input": "string", "output": "string" }
          ]
        }
      ]
    }
  ]
}

CRITICAL:
- ALL question types MUST use "questionDescription" for the question text (not "questionText").
- For MCQ options, store ONLY the option text without the letter prefix (e.g. ["6", "8", "9", "Error"] not ["A. 6", "B. 8", ...]).
- The correctAnswer for MCQs must be the letter (A, B, C, or D).
- If the document only has coding problems (no clear sections), put them in a single coding section.
- You MUST include ALL questions from ALL sections. Do not skip any.
- If answers are provided in the document, always include them.
- For coding problems, separate visible (sample) test cases from hidden test cases. If not explicitly labeled, put the first 1-2 in sampleTestCases and the rest in hiddenTestCases.
- Preserve code formatting using \\n for newlines in strings.`;

export async function processTestDocument(formData: FormData, userId: string, universityId: string, options?: { title?: string; description?: string; duration?: number; category?: string; totalQuestions?: number; examStart?: string; examEnd?: string }) {
  try {
    const file = formData.get("file") as File;
    if (!file) throw new Error("No file uploaded");

    console.log('Starting document processing for:', file.name);

    // 1. Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 2. Create FormData for upload
    const uploadFormData = new FormData();
    const blob = new Blob([buffer], { type: 'application/pdf' });
    uploadFormData.append('file', blob, file.name);

    // 3. Upload file to LlamaParse
    console.log('Uploading to LlamaParse...');
    const parseResponse = await fetch('https://api.cloud.llamaindex.ai/api/parsing/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.LLAMA_CLOUD_API_KEY}`,
        'Accept': 'application/json',
      },
      body: uploadFormData
    });

    if (!parseResponse.ok) {
      const errorText = await parseResponse.text();
      console.error('LlamaParse upload error:', errorText);
      throw new Error(`LlamaParse upload failed: ${parseResponse.status} - ${errorText}`);
    }

    const parseData = await parseResponse.json();
    const jobId = parseData.id;
    console.log('Upload successful. Job ID:', jobId);

    // 4. Poll for parsing results
    let extractedText = '';
    let attempts = 0;
    const maxAttempts = 60; // 2 minutes (60 * 2 seconds)

    console.log('Polling for results...');
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      try {
        const statusResponse = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}`, {
          headers: {
            'Authorization': `Bearer ${process.env.LLAMA_CLOUD_API_KEY}`,
            'Accept': 'application/json',
          }
        });

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          console.log(`Attempt ${attempts + 1}: Status = ${statusData.status}`);

          if (statusData.status === 'SUCCESS') {
            // Get the markdown result
            const resultResponse = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}/result/markdown`, {
              headers: {
                'Authorization': `Bearer ${process.env.LLAMA_CLOUD_API_KEY}`,
                'Accept': 'application/json',
              }
            });

            if (resultResponse.ok) {
              const resultData = await resultResponse.json();
              extractedText = resultData.markdown || resultData.text || '';
              console.log('Successfully extracted text. Length:', extractedText.length);
              break;
            }
          } else if (statusData.status === 'ERROR' || statusData.status === 'FAILED') {
            throw new Error(`Document parsing failed with status: ${statusData.status}`);
          }
          // If PENDING or PROCESSING, continue polling
        } else {
          console.warn(`Status check failed: ${statusResponse.status}`);
        }
      } catch (pollError: any) {
        console.error('Polling error:', pollError.message);
      }

      attempts++;
    }

    if (!extractedText) {
      throw new Error('Failed to parse document: timeout or empty result');
    }

    // 5. Use Groq to convert markdown to structured JSON
    console.log('Converting to JSON with Groq...');
    
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT
        },
        {
          role: "user",
          content: extractedText.slice(0, 30000) // Increased limit for more content
        }
      ],
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" },
      temperature: 0.1, // Low temperature for consistency
    });

    const content = chatCompletion.choices[0].message.content || "{}";
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

    // 7. Save to Firestore
    const docRef = await addDoc(collection(db, "tests"), {
      title: options?.title || file.name.replace(/\.pdf$/i, ''),
      description: options?.description || '',
      duration: options?.duration || 60,
      category: options?.category || 'General',
      totalQuestions: options?.totalQuestions || totalQuestionCount,
      examStart: options?.examStart || null,
      examEnd: options?.examEnd || null,
      metadata: parsedData.metadata || {
        difficultyLevels: [],
        totalProblems: totalQuestionCount
      },
      sections,
      problems: codingProblems,
      universityId,
      createdBy: userId,
      createdAt: serverTimestamp(),
      sourceFileName: file.name,
      approved: false,
    });

    console.log('Saved to Firestore with ID:', docRef.id);

    return { 
      success: true, 
      id: docRef.id,
      problemCount: totalQuestionCount 
    };
  } catch (error: any) {
    console.error("Test Pipeline Error:", error);
    return { 
      success: false, 
      error: error.message || 'An unknown error occurred' 
    };
  }
}