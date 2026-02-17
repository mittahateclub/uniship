'use server';

import { LlamaParseReader } from "llama-parse";
import { groq } from "@/lib/groq";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export async function processTestDocument(formData: FormData, userId: string, universityId: string) {
  try {
    const file = formData.get("file") as File;
    if (!file) throw new Error("No file uploaded");

    // 1. Initialize LlamaParse
    const reader = new LlamaParseReader({
      resultType: "markdown",
      apiKey: process.env.LLAMA_CLOUD_API_KEY,
    });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 2. Parse PDF to Markdown
    const documents = await reader.loadDataAsContent(buffer, file.name);
    const extractedText = documents.map((doc) => doc.text).join("\n");

    // 3. Use Groq to generate structured questions
    const prompt = `
      Extract academic questions from the following text and return a JSON object.
      Schema:
      {
        "testTitle": "string",
        "questions": [
          {
            "question": "string",
            "options": ["string", "string", "string", "string"],
            "correctAnswer": "string"
          }
        ]
      }
      Text: ${extractedText}
    `;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" },
    });

    const testData = JSON.parse(chatCompletion.choices[0].message.content || "{}");

    // 4. Save to Firestore in the 'tests' collection
    const docRef = await addDoc(collection(db, "tests"), {
      ...testData,
      universityId,
      createdBy: userId,
      createdAt: serverTimestamp(),
    });

    return { success: true, id: docRef.id };
  } catch (error: any) {
    console.error("Test Pipeline Error:", error);
    return { success: false, error: error.message };
  }
}