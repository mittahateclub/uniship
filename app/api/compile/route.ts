import { NextResponse } from 'next/server';
import { wrapCode } from '@/lib/code-wrapper';
import { verifyAuthFromRequest } from '@/lib/auth-server';
import { rateLimit } from '@/lib/rate-limit';
import { executeJudge0 } from '@/lib/judge0';

const PARSE_ERR_PREFIX = '__PLATFORM_PARSE_ERROR__';

// SECURITY: Hard limits to prevent abuse
const MAX_SOURCE_CODE_LENGTH = 50_000;  // 50 KB
const MAX_STDIN_LENGTH = 10_000;        // 10 KB
const MAX_TEST_CASES = 30;
const MAX_BATCH_SUBMISSIONS = 20;
const MAX_BATCH_TOTAL_CASES = 120;
const MAX_TIME_LIMIT_SEC = 10;
const MAX_MEMORY_LIMIT_KB = 512_000;    // 512 MB

type CompileMode = 'run' | 'submit' | 'batch';

interface TestCaseInput {
  input: string;
  expectedOutput: string;
  isHidden?: boolean;
}

interface JudgeRequest {
  source_code?: string;
  language_id?: number;
  stdin?: string;
  mode?: CompileMode;
  testCases?: TestCaseInput[];
  timeLimitSec?: number;
  memoryLimitKb?: number;
  submissions?: BatchSubmission[];
}

interface BatchSubmission {
  id: string | number;
  source_code: string;
  language_id: number;
  testCases: TestCaseInput[];
  timeLimitSec?: number;
  memoryLimitKb?: number;
}

/* ── Language-aware default CPU time limits (seconds) ── */
function getDefaultTimeLimit(languageId: number): number {
  switch (languageId) {
    case 71: return 5;               // Python 3
    case 62: return 4;               // Java
    case 63: case 74: case 72:       // JS, TS, Ruby
    case 68: case 85: return 4;      // PHP, Dart
    case 51: case 78: case 60:       // C#, Kotlin, Go
      return 3;
    case 50: case 54: case 73:       // C, C++, Rust
      return 2;
    default: return 3;
  }
}

function normalizeOutput(value: string | null | undefined): string[] {
  return (value || '')
    .replace(/[\[\],]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);
}

function tokensMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const fa = parseFloat(a);
  const fb = parseFloat(b);
  if (!isNaN(fa) && !isNaN(fb)) {
    const diff = Math.abs(fa - fb);
    if (diff <= 1e-9) return true;
    const maxAbs = Math.max(Math.abs(fa), Math.abs(fb));
    if (maxAbs > 0 && diff / maxAbs <= 1e-6) return true;
  }
  return false;
}

function outputsMatch(actual: string | null | undefined, expected: string | null | undefined): boolean {
  const aToks = normalizeOutput(actual);
  const eToks = normalizeOutput(expected);
  if (aToks.length !== eToks.length) return false;
  return aToks.every((t, i) => tokensMatch(t, eToks[i]));
}

function isPlatformParseError(stderr: string | null | undefined): boolean {
  return (stderr || '').includes(PARSE_ERR_PREFIX);
}

function mapStatusToCode(statusId: number | undefined, statusDescription: string | undefined) {
  switch (statusId) {
    case 3:
      return 'AC';
    case 4:
      return 'WA';
    case 5:
      return 'TLE';
    case 6:
      return 'CE';
    case 7:
    case 8:
    case 9:
    case 10:
    case 11:
    case 12:
    case 13:
    case 14:
      return 'RE';
    default:
      if ((statusDescription || '').toLowerCase().includes('time limit')) return 'TLE';
      return 'RE';
  }
}

function getFriendlyInputTip(stderr: string | null | undefined, stdin: string | undefined): string | null {
  const err = (stderr || '').toLowerCase();
  if ((stdin || '').trim().length > 0) return null;

  const looksLikeMissingInput =
    err.includes('eoferror') ||
    err.includes('unexpected eof') ||
    err.includes('nosuchelementexception') ||
    err.includes('inputmismatchexception') ||
    err.includes('scanf') ||
    err.includes('input()');

  if (!looksLikeMissingInput) return null;
  return 'Your code tried to read input, but the input box was empty. Add sample input in stdin and run again.';
}

function finalVerdict(codes: string[]) {
  if (codes.length === 0) return 'RE';
  if (codes.every((c) => c === 'AC')) return 'AC';
  if (codes.includes('CE')) return 'CE';
  if (codes.includes('RE')) return 'RE';
  if (codes.includes('TLE')) return 'TLE';
  if (codes.includes('WA')) return 'WA';
  return 'RE';
}

function validateSubmission(input: Omit<BatchSubmission, 'id'>): string | null {
  if (!input.source_code || !input.language_id) return 'source_code and language_id are required';
  if (typeof input.source_code !== 'string' || input.source_code.length > MAX_SOURCE_CODE_LENGTH) {
    return `source_code exceeds maximum length of ${MAX_SOURCE_CODE_LENGTH} characters`;
  }
  if (!Array.isArray(input.testCases) || input.testCases.length === 0) return 'testCases are required';
  if (input.testCases.length > MAX_TEST_CASES) return `Maximum ${MAX_TEST_CASES} test cases allowed`;
  for (let i = 0; i < input.testCases.length; i += 1) {
    const testCase = input.testCases[i];
    if (!testCase || typeof testCase.input !== 'string' || typeof testCase.expectedOutput !== 'string') {
      return `Invalid test case at index ${i}`;
    }
    if (testCase.input.length > MAX_STDIN_LENGTH || testCase.expectedOutput.length > MAX_STDIN_LENGTH) {
      return `Test case ${i} input/output exceeds size limit`;
    }
  }
  return null;
}

async function evaluateSubmission(input: Omit<BatchSubmission, 'id'>) {
  const safeTL = Math.min(input.timeLimitSec ?? getDefaultTimeLimit(input.language_id), MAX_TIME_LIMIT_SEC);
  const safeML = Math.min(input.memoryLimitKb ?? 262144, MAX_MEMORY_LIMIT_KB);
  const wrappedCode = wrapCode(input.source_code, input.language_id, 'submit');
  const results = await Promise.allSettled(
    input.testCases.map((testCase) =>
      executeJudge0(wrappedCode, input.language_id, {
        stdin: testCase.input,
        timeLimitSec: safeTL,
        memoryLimitKb: safeML,
      }),
    ),
  );

  const cases = results.map((settled, index) => {
    const testCase = input.testCases[index];
    if (settled.status === 'rejected') {
      return {
        caseNumber: index + 1,
        statusCode: 'RE',
        status: 'Runtime Error',
        time: null,
        memory: null,
        stdout: null,
        stderr: settled.reason instanceof Error ? settled.reason.message : 'Unknown error',
        expectedOutput: testCase.isHidden ? '' : testCase.expectedOutput,
        inputPreview: testCase.isHidden ? '' : testCase.input.slice(0, 240),
        isHidden: !!testCase.isHidden,
      };
    }

    const result = settled.value;
    const executionCode = mapStatusToCode(result.status?.id, result.status?.description);
    const code = executionCode === 'AC'
      ? (outputsMatch(result.stdout, testCase.expectedOutput) ? 'AC' : 'WA')
      : executionCode;
    const parseErr = isPlatformParseError(result.stderr);
    return {
      caseNumber: index + 1,
      statusCode: parseErr ? 'RE' : code,
      status: parseErr
        ? 'Internal Parse Error'
        : (code === 'WA' ? 'Wrong Answer' : (result.status?.description || 'Unknown')),
      time: result.time || null,
      memory: result.memory || null,
      stdout: testCase.isHidden ? null : (result.stdout || null),
      stderr: parseErr
        ? 'The platform could not parse the test input for this case. Please contact your admin.'
        : (result.compile_output || result.stderr || result.message || null),
      expectedOutput: testCase.isHidden ? '' : testCase.expectedOutput,
      inputPreview: testCase.isHidden ? '' : testCase.input.slice(0, 240),
      isHidden: !!testCase.isHidden,
    };
  });
  const codes = cases.map((testCase) => testCase.statusCode);
  return {
    summary: {
      verdict: finalVerdict(codes),
      passed: cases.filter((testCase) => testCase.statusCode === 'AC').length,
      total: input.testCases.length,
      failedCase: cases.find((testCase) => testCase.statusCode !== 'AC')?.caseNumber ?? null,
    },
    cases,
  };
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  task: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      results[index] = await task(values[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function POST(request: Request) {
  // SECURITY: Verify Firebase auth token
  const authUser = await verifyAuthFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // SECURITY: Rate limit — 20 requests per minute per user
  if (!rateLimit(`compile:${authUser.uid}`, { maxRequests: 20, windowMs: 60_000 })) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 });
  }

  const {
    source_code,
    language_id,
    stdin,
    mode = 'run',
    testCases = [],
    timeLimitSec,
    memoryLimitKb,
    submissions = [],
  } = await request.json() as JudgeRequest;

  if (mode === 'batch') {
    if (!Array.isArray(submissions) || submissions.length === 0) {
      return NextResponse.json({ error: 'submissions are required for batch mode' }, { status: 400 });
    }
    if (submissions.length > MAX_BATCH_SUBMISSIONS) {
      return NextResponse.json({ error: `Maximum ${MAX_BATCH_SUBMISSIONS} submissions allowed` }, { status: 400 });
    }
    const totalCases = submissions.reduce((sum, submission) => sum + (submission.testCases?.length ?? 0), 0);
    if (totalCases > MAX_BATCH_TOTAL_CASES) {
      return NextResponse.json({ error: `Maximum ${MAX_BATCH_TOTAL_CASES} total test cases allowed` }, { status: 400 });
    }
    for (const submission of submissions) {
      const validationError = validateSubmission(submission);
      if (validationError) {
        return NextResponse.json({ error: `Submission ${submission.id}: ${validationError}` }, { status: 400 });
      }
    }
    const graded = await mapWithConcurrency(submissions, 2, async (submission) => ({
      id: submission.id,
      ...(await evaluateSubmission(submission)),
    }));
    return NextResponse.json({ mode: 'batch', submissions: graded });
  }

  if (!source_code || !language_id) {
    return NextResponse.json({ error: 'source_code and language_id are required' }, { status: 400 });
  }

  // SECURITY: Input size limits
  if (typeof source_code !== 'string' || source_code.length > MAX_SOURCE_CODE_LENGTH) {
    return NextResponse.json({ error: `source_code exceeds maximum length of ${MAX_SOURCE_CODE_LENGTH} characters` }, { status: 400 });
  }
  if (stdin && (typeof stdin !== 'string' || stdin.length > MAX_STDIN_LENGTH)) {
    return NextResponse.json({ error: `stdin exceeds maximum length of ${MAX_STDIN_LENGTH} characters` }, { status: 400 });
  }

  // SECURITY: Clamp resource limits to safe maximums
  const safeTL = Math.min(timeLimitSec ?? getDefaultTimeLimit(language_id), MAX_TIME_LIMIT_SEC);
  const safeML = Math.min(memoryLimitKb ?? 262144, MAX_MEMORY_LIMIT_KB);

  // Auto-detect function, params, and wrap if applicable
  const wrappedCode = wrapCode(source_code, language_id, mode);

  if (mode === 'submit') {
    const validationError = validateSubmission({
      source_code,
      language_id,
      testCases,
      timeLimitSec,
      memoryLimitKb,
    });
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
    return NextResponse.json({ mode: 'submit', ...(await evaluateSubmission({
      source_code,
      language_id,
      testCases,
      timeLimitSec,
      memoryLimitKb,
    })) });
  }

  try {
    const result = await executeJudge0(wrappedCode, language_id, {
      stdin: stdin || '',
      timeLimitSec: safeTL,
      memoryLimitKb: safeML,
    });

    const friendlyInputTip = getFriendlyInputTip(result.stderr, stdin);
    const statusCode = mapStatusToCode(result.status?.id, result.status?.description);

    return NextResponse.json({
      mode: 'run',
      statusCode,
      status: result.status,
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      compile_output: result.compile_output || '',
      message: result.message || '',
      time: result.time || null,
      memory: result.memory || null,
      friendlyError: friendlyInputTip,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Compiler unavailable: ${message}` }, { status: 502 });
  }
}
