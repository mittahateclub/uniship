import { rateLimit } from '@/lib/rate-limit';

const ALLOWED_METRICS = new Set(['CLS', 'FCP', 'INP', 'LCP', 'TTFB']);

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`web-vitals:${ip}`, { maxRequests: 120, windowMs: 60_000 })) {
    return new Response(null, { status: 429 });
  }
  try {
    const metric = await request.json() as Record<string, unknown>;
    if (!ALLOWED_METRICS.has(String(metric.name)) || typeof metric.value !== 'number') {
      return new Response(null, { status: 400 });
    }
    console.info(JSON.stringify({
      event: 'web_vital',
      ...metric,
      userAgent: request.headers.get('user-agent'),
    }));
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 400 });
  }
}
