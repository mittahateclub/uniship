'use server';

import { groq } from '@/lib/groq';

const SYSTEM_PROMPT = `You are an expert algorithm problem creator. Given a topic or LeetCode-style prompt, create a complete coding problem.

Return ONLY valid JSON matching this exact structure:
{
  "title": "Problem title (e.g. Two Sum)",
  "difficulty": "Easy" | "Medium" | "Hard",
  "description": "Full problem description in HTML. Use <p>, <code>, <strong>, <em>, <ul>, <li> tags. Include examples inline.",
  "functionName": "camelCase function name (e.g. twoSum)",
  "constraints": ["1 <= nums.length <= 10^4", "..."],
  "inputFormat": "Description of input format for stdin (one argument per line as Python literals)",
  "outputFormat": "Description of expected output format",
  "starterCode": {
    "Python3": "class Solution:\\n    def funcName(self, param1, param2):\\n        pass",
    "JavaScript": "var funcName = function(param1, param2) {\\n    \\n};",
    "Java": "class Solution {\\n    public ReturnType funcName(Type1 p1, Type2 p2) {\\n        \\n    }\\n}",
    "C++": "class Solution {\\npublic:\\n    ReturnType funcName(Type1 p1, Type2 p2) {\\n        \\n    }\\n};"
  },
  "testCases": [
    { "input": "line1\\nline2", "expectedOutput": "result", "isHidden": false },
    { "input": "line1\\nline2", "expectedOutput": "result", "isHidden": false },
    { "input": "line1\\nline2", "expectedOutput": "result", "isHidden": true },
    { "input": "line1\\nline2", "expectedOutput": "result", "isHidden": true }
  ]
}

Rules:
- Create at least 2 visible test cases and 2 hidden test cases.
- Input format: each function argument on its own line as a Python literal (e.g. [2, 7, 11, 15]\\n9).
- Expected output: the raw output as a single line (e.g. [0, 1]).
- The problem description should be detailed and clear with examples.
- Starter code must include proper type hints/signatures for each language.
- Function names must be consistent across all languages.`;

export async function generatePracticeProblem(topic: string): Promise<{
  success: boolean;
  problem?: {
    title: string;
    difficulty: string;
    description: string;
    functionName: string;
    constraints: string[];
    inputFormat: string;
    outputFormat: string;
    starterCode: Record<string, string>;
    testCases: Array<{ input: string; expectedOutput: string; isHidden: boolean }>;
  };
  error?: string;
}> {
  if (!topic.trim()) {
    return { success: false, error: 'Topic is required.' };
  }

  try {
    const response = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Create a coding problem for: ${topic}` },
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      return { success: false, error: 'No response from AI.' };
    }

    const parsed = JSON.parse(content);

    if (!parsed.title || !parsed.functionName || !parsed.testCases?.length) {
      return { success: false, error: 'AI returned incomplete problem data.' };
    }

    return {
      success: true,
      problem: {
        title: parsed.title,
        difficulty: parsed.difficulty || 'Medium',
        description: parsed.description || '',
        functionName: parsed.functionName,
        constraints: parsed.constraints || [],
        inputFormat: parsed.inputFormat || '',
        outputFormat: parsed.outputFormat || '',
        starterCode: parsed.starterCode || {},
        testCases: (parsed.testCases || []).map((tc: { input?: string; expectedOutput?: string; isHidden?: boolean }) => ({
          input: tc.input || '',
          expectedOutput: tc.expectedOutput || '',
          isHidden: !!tc.isHidden,
        })),
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate problem.';
    return { success: false, error: message };
  }
}
