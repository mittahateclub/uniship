import { NextResponse } from 'next/server';
import { wrapCode } from '@/lib/code-wrapper';

const JUDGE0_CE_URL = 'https://ce.judge0.com';

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

function normalizeOutput(value: string | null | undefined): string {
  return (value || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[\[\],]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase())
    .filter((line, index, arr) => !(line === '' && index === arr.length - 1))
    .join('\n')
    .trim();
}

function outputsMatch(actual: string | null | undefined, expected: string | null | undefined) {
  return normalizeOutput(actual) === normalizeOutput(expected);
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

  const body: Record<string, unknown> = {
    source_code: encodedCode,
    language_id,
    stdin: encodedStdin,
    cpu_time_limit: options.timeLimitSec ?? 2,
    wall_time_limit: Math.max((options.timeLimitSec ?? 2) + 1, 3),
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

  // Auto-detect function, params, and wrap if applicable
  const wrappedCode = wrapCode(source_code, language_id);

  if (mode === 'submit') {
    if (!Array.isArray(testCases) || testCases.length === 0) {
      return NextResponse.json({ error: 'testCases are required for submit mode' }, { status: 400 });
    }

    const evaluatedCases: Array<{
      caseNumber: number;
      statusCode: string;
      status: string;
      time: string | null;
      memory: number | null;
      stdout: string | null;
      stderr: string | null;
      expectedOutput: string;
      inputPreview: string;
      isHidden: boolean;
    }> = [];

    for (let i = 0; i < testCases.length; i += 1) {
      const tc = testCases[i];
      if (!tc || typeof tc.input !== 'string' || typeof tc.expectedOutput !== 'string') {
        return NextResponse.json({ error: `Invalid test case at index ${i}` }, { status: 400 });
      }

      try {
        const result = await executeWithFallback(wrappedCode, language_id, {
          stdin: tc.input,
          timeLimitSec,
          memoryLimitKb,
        });

        const executionCode = mapStatusToCode(result.status?.id, result.status?.description);
        const actualNorm = normalizeOutput(result.stdout);
        const expectedNorm = normalizeOutput(tc.expectedOutput);
        const code = executionCode === 'AC'
          ? (actualNorm === expectedNorm ? 'AC' : 'WA')
          : executionCode;

        if (code !== 'AC') {
          console.log(`[CASE ${i + 1}] status=${code} execCode=${executionCode}`);
          console.log(`  STDIN:    ${JSON.stringify(tc.input.slice(0, 500))}`);
          console.log(`  ACTUAL:   ${JSON.stringify((result.stdout || '').slice(0, 500))}`);
          console.log(`  EXPECTED: ${JSON.stringify(tc.expectedOutput.slice(0, 500))}`);
          if (result.stderr) console.log(`  STDERR:   ${JSON.stringify(result.stderr.slice(0, 500))}`);
        }

        evaluatedCases.push({
          caseNumber: i + 1,
          statusCode: code,
          status: code === 'WA' ? 'Wrong Answer' : (result.status?.description || 'Unknown'),
          time: result.time || null,
          memory: result.memory || null,
          stdout: tc.isHidden ? null : (result.stdout || null),
          stderr: result.compile_output || result.stderr || result.message || null,
          expectedOutput: tc.isHidden ? '' : tc.expectedOutput,
          inputPreview: tc.isHidden ? '' : tc.input.slice(0, 240),
          isHidden: !!tc.isHidden,
        });

        if (code !== 'AC') break;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        evaluatedCases.push({
          caseNumber: i + 1,
          statusCode: 'RE',
          status: 'Runtime Error',
          time: null,
          memory: null,
          stdout: null,
          stderr: message,
          expectedOutput: tc.isHidden ? '' : tc.expectedOutput,
          inputPreview: tc.isHidden ? '' : tc.input.slice(0, 240),
          isHidden: !!tc.isHidden,
        });
        break;
      }
    }

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
      timeLimitSec,
      memoryLimitKb,
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
