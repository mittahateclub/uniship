'use server';

// Server-side port of the Flutter app's EventScraper (lib/services/event_scraper.dart):
// fetch a job/event link, pull its og:image and visible text, then ask Groq to
// structure it into event fields. Runs on the server so there's no CORS issue
// and the Groq key stays private.

import { groq } from '@/lib/groq';

export interface ScrapedEvent {
  ok: boolean;
  error?: string;
  title?: string | null;
  description?: string | null;
  company?: string | null;
  location?: string | null;
  type?: string | null;          // event | internship | hackathon | research | workshop
  imageUrl?: string | null;      // og:image if the page exposes one
  deadline?: string | null;      // YYYY-MM-DD
  note?: string;
}

const MAX_PAGE_TEXT = 9000;
const TYPES = ['event', 'internship', 'hackathon', 'research', 'workshop'];

// SSRF guard — block private/internal hosts and non-HTTP schemes. Public hosts
// are allowed (admins paste arbitrary company career pages).
function safeHost(u: URL): boolean {
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  const h = u.hostname.toLowerCase();
  if (h === 'localhost' || h === '0.0.0.0' || h === '::1' || h.endsWith('.local')
    || h === 'metadata.google.internal'
    || h.startsWith('127.') || h.startsWith('10.') || h.startsWith('192.168.')
    || h.startsWith('169.254.') || /^172\.(1[6-9]|2\d|3[01])\./.test(h)) {
    return false;
  }
  return true;
}

/// og:image / twitter:image, resolved to an absolute URL.
function extractImage(html: string, pageUrl: URL): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i,
  ];
  for (const p of patterns) {
    const raw = html.match(p)?.[1]?.trim();
    if (!raw) continue;
    try {
      const resolved = new URL(raw, pageUrl).toString();
      if (resolved.startsWith('http')) return resolved;
    } catch { /* ignore */ }
  }
  return null;
}

/// Strips scripts/styles/tags and collapses whitespace.
function visibleText(html: string): string {
  let text = html
    .replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  const entities: Record<string, string> = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'",
    '&nbsp;': ' ', '&mdash;': '—', '&ndash;': '–',
  };
  for (const [k, v] of Object.entries(entities)) text = text.split(k).join(v);
  text = text
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text.length > MAX_PAGE_TEXT ? text.slice(0, MAX_PAGE_TEXT) : text;
}

export async function scrapeEvent(rawUrl: string): Promise<ScrapedEvent> {
  let url = (rawUrl ?? '').trim();
  if (!url) return { ok: false, error: 'Enter a link first.' };
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  let uri: URL;
  try { uri = new URL(url); } catch { return { ok: false, error: 'Invalid link.' }; }
  if (!uri.host || !safeHost(uri)) return { ok: false, error: 'That link cannot be reached.' };

  // 1. Fetch the page with a browser-like User-Agent (many job boards block bots).
  let html: string;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    const res = await fetch(uri.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return { ok: false, error: `Page returned ${res.status}.` };
    html = await res.text();
  } catch {
    return { ok: false, error: 'Could not reach the link.' };
  }

  const imageUrl = extractImage(html, uri);
  const pageText = visibleText(html);
  if (pageText.length < 80) {
    if (imageUrl) return { ok: true, imageUrl, note: 'Found an image, but no readable text to auto-fill.' };
    return { ok: false, error: 'The page has no readable content.' };
  }

  // 2. Ask Groq to structure it (same prompt + model as the app).
  const prompt = `You are helping a university placement admin create an event post from a web page.
Below is the visible text scraped from ${url}

PAGE TEXT:
${pageText}

Extract the posting into STRICT JSON (no markdown fences, no extra text):
{
  "title": "short event/job title, max 80 chars",
  "company": "organizing company or institution, or null",
  "location": "city / venue / Remote, or null",
  "eventType": "one of: event, internship, hackathon, research, workshop",
  "description": "clean 80-140 word description written like a social post caption: what it is, who should apply, key requirements/skills, perks. Plain text, no hashtags.",
  "deadline": "application deadline or event date as YYYY-MM-DD, or null"
}
Use null for anything not present in the text. Do not invent details.`;

  let content: string | undefined;
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    });
    content = completion.choices?.[0]?.message?.content ?? undefined;
  } catch {
    return { ok: false, error: 'AI request failed — try again.', imageUrl };
  }
  if (!content) return { ok: false, error: 'No response from AI.', imageUrl };

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '').trim());
  } catch {
    return { ok: false, error: 'Could not parse the AI response.', imageUrl };
  }

  const str = (v: unknown): string | null => {
    const s = (v as { toString?: () => string } | null | undefined)?.toString?.().trim();
    return !s || s === 'null' ? null : s;
  };
  const type = str(parsed.eventType)?.toLowerCase();

  return {
    ok: true,
    title: str(parsed.title),
    description: str(parsed.description),
    company: str(parsed.company),
    location: str(parsed.location),
    type: type && TYPES.includes(type) ? type : null,
    imageUrl,
    deadline: str(parsed.deadline),
    note: imageUrl
      ? 'Details and image pulled from the page — review below.'
      : 'Details filled. No image on the page, so the post will be text-only.',
  };
}
