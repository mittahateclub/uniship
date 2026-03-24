const JUDGE0_CE_URL = 'https://ce.judge0.com';

function decode(val: string | null | undefined): string {
  if (!val) return '';
  try {
    return Buffer.from(val, 'base64').toString('utf-8');
  } catch {
    return val;
  }
}

async function submitToJudge0(
  url: string,
  authToken: string | null,
  sourceCode: string,
  languageId: number,
  stdin: string,
): Promise<{ stdout: string; stderr: string; statusId: number }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) headers['X-Auth-Token'] = authToken;

  const body = {
    source_code: Buffer.from(sourceCode).toString('base64'),
    language_id: languageId,
    stdin: Buffer.from(stdin).toString('base64'),
    cpu_time_limit: 5,
    wall_time_limit: 10,
    memory_limit: 262144,
  };

  const response = await fetch(`${url}/submissions?base64_encoded=true&wait=true`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) throw new Error(`Judge0 returned ${response.status}`);
  const data = await response.json();

  return {
    stdout: decode(data.stdout),
    stderr: decode(data.stderr) + (decode(data.compile_output) || ''),
    statusId: data.status?.id ?? 0,
  };
}

export async function runCode(
  sourceCode: string,
  languageId: number,
  stdin: string,
): Promise<{ stdout: string; stderr: string; ok: boolean }> {
  const selfHostedUrl = process.env.JUDGE0_API_URL;
  const selfHostedToken = process.env.JUDGE0_AUTH_TOKEN;

  let result;
  if (selfHostedUrl && selfHostedToken) {
    try {
      result = await submitToJudge0(selfHostedUrl, selfHostedToken, sourceCode, languageId, stdin);
    } catch {
      result = await submitToJudge0(JUDGE0_CE_URL, null, sourceCode, languageId, stdin);
    }
  } else {
    result = await submitToJudge0(JUDGE0_CE_URL, null, sourceCode, languageId, stdin);
  }

  return {
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
    ok: result.statusId === 3,
  };
}
