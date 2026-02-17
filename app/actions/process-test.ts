'use server';

import { groq } from "@/lib/groq";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

const SYSTEM_PROMPT = `You are a strict Markdown-to-JSON conversion agent.

Your ONLY task is to convert the given markdown document into a valid, well-structured JSON object.

Rules you MUST follow:
1. Output ONLY valid JSON. Do NOT include explanations, comments, markdown, or extra text.
2. Preserve ALL information from the markdown faithfully. Do NOT summarize, rephrase, or omit content.
3. Maintain the original hierarchy and section numbering in JSON keys.
4. Use clear, consistent, and predictable key names.
5. Convert headings into nested JSON objects.
6. Convert bullet points into JSON arrays.
7. Convert numbered lists into ordered JSON arrays.
8. Preserve mathematical expressions as plain strings.
9. Preserve code blocks, input/output examples, and diagrams as strings.
10. Preserve sample test cases exactly as written.
11. If a section repeats across problems (e.g., Function Description, Constraints, Input Format), keep the same key names everywhere.
12. Use camelCase for all JSON keys.
13. Arrays must contain objects when structured data exists.
14. Strings must remain strings — do NOT infer data types.
15. Do NOT invent fields that do not exist in the markdown.
16. Do NOT remove redundancy if it exists in the source.

Expected top-level JSON structure:
{
  "metadata": {
    "difficultyLevels": [],
    "totalProblems": number
  },
  "problems": [
    {
      "section": "string",
      "difficulty": "EASY | MEDIUM | HARD | COMPLEX",
      "title": "string",
      "questionDescription": "string",
      "functionDescription": {
        "name": "string",
        "parameters": [],
        "return": "string"
      },
      "constraints": [],
      "inputFormat": "string",
      "outputFormat": "string",
      "sampleTestCases": [
        {
          "input": "string",
          "output": "string",
          "explanation": "string"
        }
      ]
    }
  ]
}

If any content is ambiguous, represent it exactly as text rather than guessing.

If the markdown contains multiple problems, convert ALL of them into the JSON array.

Failure to follow these rules is considered an incorrect response.`;

export async function processTestDocument(formData: FormData, userId: string, universityId: string) {
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
    if (!parsedData.problems || !Array.isArray(parsedData.problems) || parsedData.problems.length === 0) {
      throw new Error('No problems were extracted from the document');
    }

    console.log('Extracted', parsedData.problems.length, 'problems');

    // 7. Save to Firestore in the expected format
    const docRef = await addDoc(collection(db, "tests"), {
      metadata: parsedData.metadata || {
        difficultyLevels: [],
        totalProblems: parsedData.problems.length
      },
      problems: parsedData.problems,
      universityId,
      createdBy: userId,
      createdAt: serverTimestamp(),
      sourceFileName: file.name,
    });

    console.log('Saved to Firestore with ID:', docRef.id);

    return { 
      success: true, 
      id: docRef.id,
      problemCount: parsedData.problems.length 
    };
  } catch (error: any) {
    console.error("Test Pipeline Error:", error);
    return { 
      success: false, 
      error: error.message || 'An unknown error occurred' 
    };
  }
}