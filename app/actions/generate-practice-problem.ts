'use server';

import { groq } from '@/lib/groq';

const JUDGE0_CE_URL = 'https://ce.judge0.com';
const URL_REGEX = /^https?:\/\//i;
const MAX_ATTEMPTS = 2;

async function fetchPageText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ProblemBot/1.0)' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text.slice(0, 6000);
  } catch {
    return null;
  }
}

const SYSTEM_PROMPT = `You are an expert algorithm problem creator. Given a topic, create a complete coding problem WITH a working reference solution.

Return ONLY valid JSON matching this exact structure:
{
  "title": "Problem title (e.g. Two Sum)",
  "difficulty": "Easy" | "Medium" | "Hard",
  "description": "Full problem description in HTML. Use <p>, <code>, <strong>, <em>, <ul>, <li> tags. Include examples inline.",
  "functionName": "camelCase function name (e.g. twoSum)",
  "constraints": ["1 <= nums.length <= 10^4", "..."],
  "inputFormat": "Description of input format for stdin (one argument per line as Python literals)",
  "outputFormat": "Description of expected output format",
  "referenceSolution": "A COMPLETE, CORRECT, SELF-CONTAINED Python 3 script that: (1) reads input from stdin, (2) solves the problem, (3) prints the answer to stdout. It should NOT use input() in a loop — use sys.stdin.read() to read all input at once. The script must be fully runnable as-is. Example format:\\nimport sys\\ndata = sys.stdin.read().split('\\\\n')\\n# parse inputs...\\n# solve...\\nprint(result)",
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

CRITICAL Rules:
- Create at least 2 visible test cases and 2 hidden test cases.
- Input format: each function argument on its own line as a Python literal (e.g. [2, 7, 11, 15]\\n9).
- Do NOT include expectedOutput in testCases — it will be computed by running your referenceSolution.
- The referenceSolution MUST be a COMPLETE self-contained Python 3 script that reads from stdin using sys.stdin.read(), parses the input lines (using ast.literal_eval for lists/dicts), computes the answer, and prints the result. It must work when run directly: python3 script.py < input.txt
- The referenceSolution must handle the exact input format you defined in testCases.
- Do NOT use input() — use sys.stdin.read() to read all stdin at once.
- The problem description should be detailed and clear with examples.
- Starter code must include proper type hints/signatures for each language.
- Function names must be consistent across all languages.`;

async function executeOnJudge0(
  source_code: string,
  language_id: number,
  stdin: string,
): Promise<{ stdout: string | null; stderr: string | null; status: string | null }> {
  const selfHostedUrl = process.env.JUDGE0_API_URL;
  const selfHostedToken = process.env.JUDGE0_AUTH_TOKEN;

  const urls = selfHostedUrl ? [selfHostedUrl, JUDGE0_CE_URL] : [JUDGE0_CE_URL];

  for (const baseUrl of urls) {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (selfHostedToken && baseUrl === selfHostedUrl) {
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
        `${baseUrl}/submissions?base64_encoded=false&wait=true&fields=stdout,stderr,status,compile_output`,
        { method: 'POST', headers, body: JSON.stringify(body) },
      );

      if (!response.ok) continue;
      const data = await response.json();

      // Internal Error (status 13) = sandbox/worker issue — try next URL
      if (data.status?.id === 13) continue;

      return {
        stdout: data.stdout ? data.stdout.trim() : null,
        stderr: data.stderr || data.compile_output || null,
        status: data.status?.description || null,
      };
    } catch {
      continue;
    }
  }

  return { stdout: null, stderr: 'Could not reach Judge0', status: null };
}

type ProblemResult = {
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
};

async function attemptGenerate(prompt: string): Promise<ProblemResult> {
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
    return { success: false, error: 'AI did not provide a reference solution.' };
  }

  // ── Execute reference solution against each test case ──
  const refScript = parsed.referenceSolution as string;
  const verifiedTestCases: Array<{ input: string; expectedOutput: string; isHidden: boolean }> = [];
  let lastError = '';

  for (const tc of parsed.testCases) {
    const input = tc.input || '';
    if (!input.trim()) continue;

    const result = await executeOnJudge0(refScript, 71, input);

    if (!result.stdout) {
      lastError = result.stderr || result.status || 'No output';
      continue;
    }

    verifiedTestCases.push({
      input,
      expectedOutput: result.stdout,
      isHidden: !!tc.isHidden,
    });
  }

  if (verifiedTestCases.length < 2) {
    return {
      success: false,
      error: `Reference solution failed (${lastError}). Retrying...`,
    };
  }

  // Ensure at least 1 visible and 1 hidden
  const hasVisible = verifiedTestCases.some(tc => !tc.isHidden);
  const hasHidden = verifiedTestCases.some(tc => tc.isHidden);
  if (!hasVisible) verifiedTestCases[0].isHidden = false;
  if (!hasHidden) verifiedTestCases[verifiedTestCases.length - 1].isHidden = true;

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
}

export async function generatePracticeProblem(topic: string): Promise<ProblemResult> {
  if (!topic.trim()) {
    return { success: false, error: 'Topic is required.' };
  }

  try {
    let prompt = `Create a coding problem for: ${topic}`;
    if (URL_REGEX.test(topic.trim())) {
      const pageText = await fetchPageText(topic.trim());
      if (!pageText) {
        return { success: false, error: 'Could not fetch the URL. Check the link and try again.' };
      }
      prompt = `Create a coding problem based on the following article content:\n\n${pageText}`;
    }

    let lastResult: ProblemResult = { success: false, error: 'Generation failed.' };

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const retryPrompt = attempt === 0
        ? prompt
        : `${prompt}\n\nIMPORTANT: Your previous reference solution had bugs. This time, double-check your solution logic carefully. Make sure the Python script reads stdin correctly using sys.stdin.read(), parses with ast.literal_eval where needed, and prints the correct output.`;

      lastResult = await attemptGenerate(retryPrompt);
      if (lastResult.success) return lastResult;
    }

    return {
      success: false,
      error: lastResult.error || 'AI could not generate a working solution after multiple attempts. Try a different topic.',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate problem.';
    return { success: false, error: message };
  }
}
