'use server';

import { groq } from '@/lib/groq';
import { wrapCode } from '@/lib/code-wrapper';

const JUDGE0_CE_URL = 'https://ce.judge0.com';

const URL_REGEX = /^https?:\/\//i;

async function fetchPageText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ProblemBot/1.0)' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Strip scripts, styles, and HTML tags to get plain text
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    // Limit to ~6000 chars to stay within context window
    return text.slice(0, 6000);
  } catch {
    return null;
  }
}

const SYSTEM_PROMPT = `You are an expert algorithm problem creator. Given a topic or LeetCode-style prompt, create a complete coding problem WITH a working reference solution.

Return ONLY valid JSON matching this exact structure:
{
  "title": "Problem title (e.g. Two Sum)",
  "difficulty": "Easy" | "Medium" | "Hard",
  "description": "Full problem description in HTML. Use <p>, <code>, <strong>, <em>, <ul>, <li> tags. Include examples inline.",
  "functionName": "camelCase function name (e.g. twoSum)",
  "constraints": ["1 <= nums.length <= 10^4", "..."],
  "inputFormat": "Description of input format for stdin (one argument per line as Python literals)",
  "outputFormat": "Description of expected output format",
  "referenceSolution": "A COMPLETE, CORRECT Python 3 solution as a standalone function. Must be a def function that returns the answer (not prints it). This will be executed to verify test cases.",
  "starterCode": {
    "Python3": "class Solution:\\n    def funcName(self, param1, param2):\\n        pass",
    "JavaScript": "var funcName = function(param1, param2) {\\n    \\n};",
    "Java": "class Solution {\\n    public ReturnType funcName(Type1 p1, Type2 p2) {\\n        \\n    }\\n}",
    "C++": "class Solution {\\npublic:\\n    ReturnType funcName(Type1 p1, Type2 p2) {\\n        \\n    }\\n};"
  },
  "testCases": [
    { "input": "line1\\nline2", "isHidden": false },
    { "input": "line1\\nline2", "isHidden": false },
    { "input": "line1\\nline2", "isHidden": true },
    { "input": "line1\\nline2", "isHidden": true }
  ]
}

Rules:
- Create at least 2 visible test cases and 2 hidden test cases.
- Input format: each function argument on its own line as a Python literal (e.g. [2, 7, 11, 15]\\n9).
- The referenceSolution MUST be a correct, runnable Python 3 function that solves the problem. It will be executed against test cases to compute expected outputs.
- The problem description should be detailed and clear with examples.
- Starter code must include proper type hints/signatures for each language.
- Function names must be consistent across all languages.
- Do NOT include expectedOutput in testCases — it will be computed by running your referenceSolution.`;

async function executeOnJudge0(
  source_code: string,
  language_id: number,
  stdin: string,
): Promise<string | null> {
  const selfHostedUrl = process.env.JUDGE0_API_URL;
  const selfHostedToken = process.env.JUDGE0_AUTH_TOKEN;

  const baseUrl = selfHostedUrl || JUDGE0_CE_URL;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (selfHostedToken && selfHostedUrl) {
    headers['X-Auth-Token'] = selfHostedToken;
  }

  const body = {
    source_code,
    language_id,
    stdin,
    cpu_time_limit: 10,
    memory_limit: 256000,
    wall_time_limit: 15,
  };

  const response = await fetch(
    `${baseUrl}/submissions?base64_encoded=false&wait=true&fields=stdout,stderr,status`,
    { method: 'POST', headers, body: JSON.stringify(body) },
  );

  if (!response.ok) return null;
  const data = await response.json();

  if (data.status?.id !== 3) return null; // Not Accepted
  return (data.stdout || '').trim();
}

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
    // If topic is a URL, fetch the page content first
    let prompt = `Create a coding problem for: ${topic}`;
    if (URL_REGEX.test(topic.trim())) {
      const pageText = await fetchPageText(topic.trim());
      if (!pageText) {
        return { success: false, error: 'Could not fetch the URL. Check the link and try again.' };
      }
      prompt = `Create a coding problem based on the following article content:\n\n${pageText}`;
    }

    const response = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
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

    if (!parsed.referenceSolution) {
      return { success: false, error: 'AI did not provide a reference solution. Try again.' };
    }

    // ── Verify test cases by executing the reference solution ──
    const refCode = parsed.referenceSolution as string;
    const wrappedRef = wrapCode(refCode, 71, 'submit'); // Python3 = 71

    const verifiedTestCases: Array<{ input: string; expectedOutput: string; isHidden: boolean }> = [];

    for (const tc of parsed.testCases) {
      const input = tc.input || '';
      if (!input.trim()) continue;

      const output = await executeOnJudge0(wrappedRef, 71, input);

      if (output === null) {
        // Reference solution failed on this input — skip this test case
        continue;
      }

      verifiedTestCases.push({
        input,
        expectedOutput: output,
        isHidden: !!tc.isHidden,
      });
    }

    if (verifiedTestCases.length < 2) {
      return {
        success: false,
        error: 'Reference solution failed to produce valid outputs. The AI may have generated buggy code. Try again.',
      };
    }

    // Ensure at least 1 visible and 1 hidden
    const hasVisible = verifiedTestCases.some(tc => !tc.isHidden);
    const hasHidden = verifiedTestCases.some(tc => tc.isHidden);
    if (!hasVisible && verifiedTestCases.length >= 2) {
      verifiedTestCases[0].isHidden = false;
    }
    if (!hasHidden && verifiedTestCases.length >= 2) {
      verifiedTestCases[verifiedTestCases.length - 1].isHidden = true;
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
        testCases: verifiedTestCases,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate problem.';
    return { success: false, error: message };
  }
}
