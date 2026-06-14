// Streams a remote image through our own origin. Event/internship posts carry
// scraped og:image URLs that load natively in the Flutter app but are blocked
// in the browser by hotlink/referrer protection or missing CORS. Fetching them
// server-side (no browser Referer, browser-like UA) and re-serving from our
// origin makes the SAME image render on the website.

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB cap

// SSRF guard — only public http(s) hosts.
function safeUrl(raw: string): URL | null {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  const h = u.hostname.toLowerCase();
  if (h === 'localhost' || h === '0.0.0.0' || h === '::1' || h.endsWith('.local')
    || h === 'metadata.google.internal'
    || h.startsWith('127.') || h.startsWith('10.') || h.startsWith('192.168.')
    || h.startsWith('169.254.') || /^172\.(1[6-9]|2\d|3[01])\./.test(h)) {
    return null;
  }
  return u;
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('url');
  if (!raw) return new NextResponse('Missing url', { status: 400 });
  const target = safeUrl(raw);
  if (!target) return new NextResponse('Invalid url', { status: 400 });

  let upstream: Response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    upstream = await fetch(target.toString(), {
      headers: {
        // No Referer (hotlink protection), browser-like UA.
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
      // Don't forward our own referer to the upstream host.
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    });
    clearTimeout(timer);
  } catch {
    return new NextResponse('Upstream fetch failed', { status: 502 });
  }

  const contentType = upstream.headers.get('content-type') ?? '';
  if (!upstream.ok || !contentType.startsWith('image/')) {
    return new NextResponse('Not an image', { status: 415 });
  }

  const buf = await upstream.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) {
    return new NextResponse('Image too large', { status: 413 });
  }

  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      // Cache aggressively at the edge/browser — these images are immutable.
      'Cache-Control': 'public, max-age=86400, s-maxage=604800, immutable',
    },
  });
}
