import { NextResponse } from 'next/server';
import { wrapCode } from '@/lib/code-wrapper';
import { verifyAuthFromRequest } from '@/lib/auth-server';
import { rateLimit } from '@/lib/rate-limit';

const JUDGE0_CE_URL = 'https://ce.judge0.com';
const PARSE_ERR_PREFIX = '__PLATFORM_PARSE_ERROR__';

// SECURITY: Hard limits to prevent abuse
const MAX_SOURCE_CODE_LENGTH = 50_000;  // 50 KB
const MAX_STDIN_LENGTH = 10_000;        // 10 KB
const MAX_TEST_CASES = 30;
const MAX_TIME_LIMIT_SEC = 10;
const MAX_MEMORY_LIMIT_KB = 512_000;    // 512 MB

type CompileMode = 'run' | 'submit';

interface TestCaseInput {
  input: string;
  expectedOutput: string;
  isHidden?: boolean;
}

interface JudgeRequest {
  source_code: string;
  language_id: number;
  stdin?: string;
  mode?: CompileMode;
  testCases?: TestCaseInput[];
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

function decode(val: string | null | undefined) {
  if (!val) return val;
  try { return Buffer.from(val, 'base64').toString('utf-8'); } catch { return val; }
}

async function executeOnJudge0(
  url: string,
  authToken: string | null,
  source_code: string,
  language_id: number,
  options: {
    stdin?: string;
    expectedOutput?: string;
    timeLimitSec?: number;
    memoryLimitKb?: number;
  },
) {
  const encodedCode = Buffer.from(source_code).toString('base64');
  const encodedStdin = options.stdin ? Buffer.from(options.stdin).toString('base64') : '';
  const encodedExpected = options.expectedOutput ? Buffer.from(options.expectedOutput).toString('base64') : undefined;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) headers['X-Auth-Token'] = authToken;

  const cpuLimit = options.timeLimitSec ?? getDefaultTimeLimit(language_id);
  const body: Record<string, unknown> = {
    source_code: encodedCode,
    language_id,
    stdin: encodedStdin,
    cpu_time_limit: cpuLimit,
    wall_time_limit: cpuLimit + 3,
    memory_limit: options.memoryLimitKb ?? 262144,
  };
  if (encodedExpected) body.expected_output = encodedExpected;

  const response = await fetch(`${url}/submissions?base64_encoded=true&wait=true`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) throw new Error(`Judge0 returned ${response.status}`);

  const data = await response.json();
  if (data.status?.id === 13) throw new Error('sandbox_error');

  return {
    ...data,
    statusCode: mapStatusToCode(data.status?.id, data.status?.description),
    stdout: decode(data.stdout),
    stderr: decode(data.stderr),
    compile_output: decode(data.compile_output),
    message: decode(data.message),
  };
}

async function executeWithFallback(
  source_code: string,
  language_id: number,
  options: { stdin?: string; expectedOutput?: string; timeLimitSec?: number; memoryLimitKb?: number },
) {
  const selfHostedUrl = process.env.JUDGE0_API_URL;
  const selfHostedToken = process.env.JUDGE0_AUTH_TOKEN;

  if (selfHostedUrl && selfHostedToken) {
    try {
      return await executeOnJudge0(selfHostedUrl, selfHostedToken, source_code, language_id, options);
    } catch {
      // Fall through to public CE
    }
  }

  return executeOnJudge0(JUDGE0_CE_URL, null, source_code, language_id, options);
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
  } = await request.json() as JudgeRequest;

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
    if (!Array.isArray(testCases) || testCases.length === 0) {
      return NextResponse.json({ error: 'testCases are required for submit mode' }, { status: 400 });
    }

    // SECURITY: Cap number of test cases
    if (testCases.length > MAX_TEST_CASES) {
      return NextResponse.json({ error: `Maximum ${MAX_TEST_CASES} test cases allowed` }, { status: 400 });
    }

    // Validate all test cases upfront
    for (let i = 0; i < testCases.length; i += 1) {
      const tc = testCases[i];
      if (!tc || typeof tc.input !== 'string' || typeof tc.expectedOutput !== 'string') {
        return NextResponse.json({ error: `Invalid test case at index ${i}` }, { status: 400 });
      }
      if (tc.input.length > MAX_STDIN_LENGTH || tc.expectedOutput.length > MAX_STDIN_LENGTH) {
        return NextResponse.json({ error: `Test case ${i} input/output exceeds size limit` }, { status: 400 });
      }
    }

    // Run all test cases in parallel for maximum speed
    const results = await Promise.allSettled(
      testCases.map((tc) =>
        executeWithFallback(wrappedCode, language_id, {
          stdin: tc.input,
          timeLimitSec: safeTL,
          memoryLimitKb: safeML,
        })
      )
    );

    const evaluatedCases = results.map((settled, i) => {
      const tc = testCases[i];
      if (settled.status === 'rejected') {
        const message = settled.reason instanceof Error ? settled.reason.message : 'Unknown error';
        return {
          caseNumber: i + 1,
          statusCode: 'RE' as string,
          status: 'Runtime Error',
          time: null as string | null,
          memory: null as number | null,
          stdout: null as string | null,
          stderr: message,
          expectedOutput: tc.isHidden ? '' : tc.expectedOutput,
          inputPreview: tc.isHidden ? '' : tc.input.slice(0, 240),
          isHidden: !!tc.isHidden,
        };
      }

      const result = settled.value;
      const executionCode = mapStatusToCode(result.status?.id, result.status?.description);
      const code = executionCode === 'AC'
        ? (outputsMatch(result.stdout, tc.expectedOutput) ? 'AC' : 'WA')
        : executionCode;

      const stderrText = result.compile_output || result.stderr || result.message || null;
      const parseErr = isPlatformParseError(result.stderr);

      return {
        caseNumber: i + 1,
        statusCode: parseErr ? 'RE' : code,
        status: parseErr
          ? 'Internal Parse Error'
          : (code === 'WA' ? 'Wrong Answer' : (result.status?.description || 'Unknown')),
        time: result.time || null,
        memory: result.memory || null,
        stdout: tc.isHidden ? null : (result.stdout || null),
        stderr: parseErr
          ? 'The platform could not parse the test input for this case. Please contact your admin.'
          : stderrText,
        expectedOutput: tc.isHidden ? '' : tc.expectedOutput,
        inputPreview: tc.isHidden ? '' : tc.input.slice(0, 240),
        isHidden: !!tc.isHidden,
      };
    });

    const codes = evaluatedCases.map((c) => c.statusCode);
    const verdict = finalVerdict(codes);
    const passed = evaluatedCases.filter((c) => c.statusCode === 'AC').length;
    const failedCase = evaluatedCases.find((c) => c.statusCode !== 'AC')?.caseNumber ?? null;

    return NextResponse.json({
      mode: 'submit',
      summary: {
        verdict,
        passed,
        total: testCases.length,
        failedCase,
      },
      cases: evaluatedCases,
    });
  }

  try {
    const result = await executeWithFallback(wrappedCode, language_id, {
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
