const JUDGE0_CE_URL = 'https://ce.judge0.com';

function decode(val: string | null | undefined): string {
  if (!val) return '';
  try {
    return Buffer.from(val, 'base64').toString('utf-8');
  } catch {
    return val;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Concurrency limiter ──────────────────────────────────────────────
// In production JUDGE0_API_URL is unset, so every run goes to the public
// ce.judge0.com, which rate-limits hard and drops requests under parallel
// load. Callers fan out many submissions at once (Promise.all over test
// cases), so we cap how many actually hit Judge0 simultaneously. A
// self-hosted instance can take more than the shared public one.
const MAX_CONCURRENCY =
  Number(process.env.JUDGE0_MAX_CONCURRENCY) ||
  (process.env.JUDGE0_API_URL && process.env.JUDGE0_AUTH_TOKEN ? 5 : 2);

let active = 0;
const waiters: Array<() => void> = [];

async function acquire(): Promise<void> {
  if (active < MAX_CONCURRENCY) {
    active++;
    return;
  }
  // Wait for a slot; release() hands it over without changing `active`.
  await new Promise<void>((resolve) => waiters.push(resolve));
}

function release(): void {
  const next = waiters.shift();
  if (next) next(); // transfer the slot to the next waiter
  else active--;
}

// ── Transient-failure retry ──────────────────────────────────────────
class Judge0HttpError extends Error {
  constructor(public status: number, public retryAfterMs?: number) {
    super(`Judge0 returned ${status}`);
  }
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

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
    // Don't let a hung Judge0 stall the whole generation request.
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    const ra = response.headers.get('retry-after');
    const retryAfterMs = ra ? Number(ra) * 1000 || undefined : undefined;
    throw new Judge0HttpError(response.status, retryAfterMs);
  }
  const data = await response.json();

  return {
    stdout: decode(data.stdout),
    stderr: decode(data.stderr) + (decode(data.compile_output) || ''),
    statusId: data.status?.id ?? 0,
  };
}

// Retry only transient failures (rate limits, 5xx, network/timeouts).
// A real program result — even a runtime error — comes back as a normal
// response and is returned immediately, never retried.
async function submitWithRetry(
  url: string,
  authToken: string | null,
  sourceCode: string,
  languageId: number,
  stdin: string,
  attempts = 4,
): Promise<{ stdout: string; stderr: string; statusId: number }> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await submitToJudge0(url, authToken, sourceCode, languageId, stdin);
    } catch (e) {
      lastErr = e;
      const status = e instanceof Judge0HttpError ? e.status : 0; // 0 = network/timeout
      const retryable = status === 0 || RETRYABLE_STATUS.has(status);
      if (!retryable || i === attempts - 1) throw e;
      const retryAfter = e instanceof Judge0HttpError ? e.retryAfterMs : undefined;
      const backoff = retryAfter ?? Math.min(4000, 400 * 2 ** i) + Math.random() * 250;
      await sleep(backoff);
    }
  }
  throw lastErr;
}

export async function runCode(
  sourceCode: string,
  languageId: number,
  stdin: string,
): Promise<{ stdout: string; stderr: string; ok: boolean }> {
  const selfHostedUrl = process.env.JUDGE0_API_URL;
  const selfHostedToken = process.env.JUDGE0_AUTH_TOKEN;

  await acquire();
  try {
    let result;
    if (selfHostedUrl && selfHostedToken) {
      try {
        result = await submitWithRetry(selfHostedUrl, selfHostedToken, sourceCode, languageId, stdin);
      } catch {
        result = await submitWithRetry(JUDGE0_CE_URL, null, sourceCode, languageId, stdin);
      }
    } else {
      result = await submitWithRetry(JUDGE0_CE_URL, null, sourceCode, languageId, stdin);
    }

    return {
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim(),
      ok: result.statusId === 3,
    };
  } finally {
    release();
  }
}
