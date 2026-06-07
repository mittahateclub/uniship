'use server';

import { groq } from '@/lib/groq';
import { runCode } from '@/lib/judge0';

const URL_REGEX = /^https?:\/\//i;
const MAX_ATTEMPTS = 2;

// SECURITY: Allowlist of domains for URL fetching to prevent SSRF
const ALLOWED_URL_HOSTS = [
  'leetcode.com', 'www.leetcode.com',
  'codeforces.com', 'www.codeforces.com',
  'hackerrank.com', 'www.hackerrank.com',
  'geeksforgeeks.org', 'www.geeksforgeeks.org', 'practice.geeksforgeeks.org',
  'codechef.com', 'www.codechef.com',
  'neetcode.io', 'www.neetcode.io',
  'en.wikipedia.org',
];

function isAllowedUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    // Block non-HTTP(S) schemes (file://, ftp://, data:, etc.)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    // Block private/internal IPs
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0'
        || hostname === '::1' || hostname.endsWith('.local')
        || hostname.startsWith('10.') || hostname.startsWith('192.168.')
        || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
        || hostname.startsWith('169.254.') || hostname === 'metadata.google.internal') {
      return false;
    }
    return ALLOWED_URL_HOSTS.some(h => hostname === h || hostname.endsWith('.' + h));
  } catch {
    return false;
  }
}

async function fetchPageText(url: string): Promise<string | null> {
  if (!isAllowedUrl(url)) return null;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ProblemBot/1.0)' },
      signal: AbortSignal.timeout(10000),
      redirect: 'error', // SECURITY: Don't follow redirects (could redirect to internal services)
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

// ce.judge0.com (the public fallback) intermittently drops requests under
// concurrency. Retry transient failures so verification doesn't flake out.
async function runWithRetry(
  source: string,
  stdin: string,
  attempts = 3,
): Promise<{ stdout: string; stderr: string; ok: boolean }> {
  let last = { stdout: '', stderr: 'Judge0 unavailable', ok: false };
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await runCode(source, 71, stdin);
      // A real result (program output or an actual error) — return immediately.
      if (r.stdout || r.stderr) return r;
      last = r;
    } catch (e) {
      last = { stdout: '', stderr: e instanceof Error ? e.message : 'fetch failed', ok: false };
    }
    await new Promise((res) => setTimeout(res, 500 * (i + 1)));
  }
  return last;
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

  // ── Execute reference solution against all test cases in parallel ──
  const refScript = parsed.referenceSolution as string;
  let lastError = '';

  const results = await Promise.allSettled(
    parsed.testCases
      .filter((tc: { input?: string }) => (tc.input || '').trim())
      .map((tc: { input: string; isHidden?: boolean }) =>
        runWithRetry(refScript, tc.input).then((result) => ({
          result,
          isHidden: !!tc.isHidden,
          input: tc.input,
        }))
      )
  );

  const verifiedTestCases: Array<{ input: string; expectedOutput: string; isHidden: boolean }> = [];
  for (const settled of results) {
    if (settled.status === 'rejected') continue;
    const { result, isHidden, input } = settled.value;
    if (!result.stdout) {
      lastError = result.stderr || 'No output';
      continue;
    }
    verifiedTestCases.push({ input, expectedOutput: result.stdout, isHidden });
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

export async function generatePracticeProblem(
  topic: string,
  options?: { title?: string; difficulty?: string },
): Promise<ProblemResult> {
  if (!topic.trim()) {
    return { success: false, error: 'Topic is required.' };
  }

  try {
    const hints: string[] = [];
    if (options?.title?.trim()) hints.push(`Use this exact title: "${options.title.trim()}"`);
    if (options?.difficulty) hints.push(`The difficulty MUST be: ${options.difficulty}`);
    const hintSuffix = hints.length ? `\n\nAdditional requirements:\n${hints.join('\n')}` : '';

    let prompt = `Create a coding problem for: ${topic}${hintSuffix}`;
    if (URL_REGEX.test(topic.trim())) {
      const pageText = await fetchPageText(topic.trim());
      if (!pageText) {
        return { success: false, error: 'Could not fetch the URL. Check the link and try again.' };
      }
      prompt = `Create a coding problem based on the following article content:\n\n${pageText}${hintSuffix}`;
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
