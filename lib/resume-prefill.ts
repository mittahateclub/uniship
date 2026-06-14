// Hands a job's company + description to the AI Resume Builder so a student can
// tailor their resume to a posting in one click. Mirrors the Flutter app's
// ResumePrefill (set on the feed/College Space, read by the resume builder).

const KEY = 'uniship:resume-prefill';

export interface ResumePrefill {
  company: string;
  jobDescription: string;
}

/// Builds the prefill the same way the app's _generateResume does: company
/// falls back to the title, and the JD is title + location + description.
export function buildResumePrefill(opts: {
  title: string;
  company?: string | null;
  location?: string | null;
  description?: string | null;
}): ResumePrefill {
  const company = (opts.company ?? '').trim();
  const location = (opts.location ?? '').trim();
  return {
    company: company || opts.title,
    jobDescription: [
      opts.title,
      location ? `Location: ${location}` : '',
      (opts.description ?? '').trim(),
    ].filter(Boolean).join('\n'),
  };
}

export function setResumePrefill(p: ResumePrefill): void {
  try { sessionStorage.setItem(KEY, JSON.stringify(p)); } catch {}
}

/// Reads and clears the prefill (one-shot handoff).
export function takeResumePrefill(): ResumePrefill | null {
  try {
    const v = sessionStorage.getItem(KEY);
    if (!v) return null;
    sessionStorage.removeItem(KEY);
    return JSON.parse(v) as ResumePrefill;
  } catch {
    return null;
  }
}
