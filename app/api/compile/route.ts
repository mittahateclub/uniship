import { NextResponse } from 'next/server';

const JUDGE0_CE_URL = 'https://ce.judge0.com';

function decode(val: string | null | undefined) {
  if (!val) return val;
  try { return Buffer.from(val, 'base64').toString('utf-8'); } catch { return val; }
}

async function executeOnJudge0(url: string, authToken: string | null, source_code: string, language_id: number, stdin: string) {
  const encodedCode = Buffer.from(source_code).toString('base64');
  const encodedStdin = stdin ? Buffer.from(stdin).toString('base64') : '';

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) headers['X-Auth-Token'] = authToken;

  const response = await fetch(`${url}/submissions?base64_encoded=true&wait=true`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ source_code: encodedCode, language_id, stdin: encodedStdin }),
  });

  if (!response.ok) throw new Error(`Judge0 returned ${response.status}`);

  const data = await response.json();
  if (data.status?.id === 13) throw new Error('sandbox_error');

  return {
    ...data,
    stdout: decode(data.stdout),
    stderr: decode(data.stderr),
    compile_output: decode(data.compile_output),
    message: decode(data.message),
  };
}

export async function POST(request: Request) {
  const { source_code, language_id, stdin } = await request.json();

  if (!source_code || !language_id) {
    return NextResponse.json({ error: 'source_code and language_id are required' }, { status: 400 });
  }

  const selfHostedUrl = process.env.JUDGE0_API_URL;
  const selfHostedToken = process.env.JUDGE0_AUTH_TOKEN;

  // Try self-hosted Judge0 first
  if (selfHostedUrl && selfHostedToken) {
    try {
      const result = await executeOnJudge0(selfHostedUrl, selfHostedToken, source_code, language_id, stdin || '');
      return NextResponse.json(result);
    } catch {
      // Fall through to public CE
    }
  }

  // Fallback: public Judge0 CE
  try {
    const result = await executeOnJudge0(JUDGE0_CE_URL, null, source_code, language_id, stdin || '');
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Compiler unavailable: ${message}` }, { status: 502 });
  }
}
