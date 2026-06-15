// app/(protected)/user/resume/ats-score.tsx
'use client';

import React, { useMemo } from 'react';

// ──────────────────────────────────────────────────────────────────────────
//  Industry-grade ATS analyzer
//
//  Deterministic, client-side, privacy-preserving (no network). Models what
//  real applicant-tracking screeners (Jobscan / Resume Worded class tools) do:
//    • Hard-skill match vs the job description — frequency-weighted, with
//      word-boundary matching plus a synonym/acronym lexicon (js↔javascript,
//      k8s↔kubernetes, "machine learning"↔ml, …) so "react" never matches
//      "reactor" and "AWS" matches "Amazon Web Services".
//    • Searchability/contact parse-ability, section coverage, quantified
//      impact + strong verbs, and formatting best-practices.
//    • A prioritized, actionable recommendation list ranked by score gain.
//
//  The job description is analyzed on its own (no AI needed) — paste a JD and
//  the skill-gap analysis is instant; AI-extracted keywords are merged in when
//  present for extra signal.
// ──────────────────────────────────────────────────────────────────────────

interface ResumeFields {
  fullName: string;
  phone: string;
  email: string;
  website: string;
  github: string;
  linkedin: string;
  education: string;
  experience: string;
  skills: string;
  projects: string;
  coursework: string;
  extracurriculars: string;
  achievements: string;
}

export interface ATSCategory {
  key: string;
  label: string;
  score: number;
  max: number;
  details: string[]; // each prefixed ✓ / △ / ✗ for coloring
}

export interface ATSSkill {
  key: string;   // normalized, for matching/dedupe
  label: string; // display
  freq: number;  // importance (JD frequency)
}

export interface ATSRecommendation {
  priority: 'high' | 'medium' | 'low';
  text: string;
}

export interface ScoreBreakdown {
  total: number;
  grade: string;
  categories: ATSCategory[];
  skills: { matched: ATSSkill[]; missing: ATSSkill[]; matchRate: number; hasTarget: boolean };
  recommendations: ATSRecommendation[];
}

// ── Lexicons ───────────────────────────────────────────────────────────────

const ACTION_VERBS = [
  'achieved', 'architected', 'analyzed', 'automated', 'built', 'collaborated',
  'configured', 'coordinated', 'created', 'delivered', 'deployed', 'designed',
  'developed', 'directed', 'drove', 'engineered', 'established', 'executed',
  'expanded', 'generated', 'implemented', 'improved', 'increased', 'initiated',
  'integrated', 'launched', 'led', 'maintained', 'managed', 'mentored',
  'migrated', 'modernized', 'monitored', 'negotiated', 'optimized',
  'orchestrated', 'overhauled', 'pioneered', 'planned', 'prototyped',
  'published', 'reduced', 'refactored', 'researched', 'resolved', 'scaled',
  'secured', 'shipped', 'spearheaded', 'streamlined', 'transformed',
];

const MEASURABLE_PATTERNS = [
  /\d+\s*%/,
  /\d+\s*x\b/i,
  /[$₹€£]\s?\d/,
  /\b\d[\d,.]*\s*(k|m|b|bn|million|billion|thousand)\b/i,
  /\b\d[\d,.]*\+?\s*(users?|customers?|clients?|requests?|transactions?|records?|projects?|teams?|members?|downloads?|stars?|hours?|days?|weeks?|months?)\b/i,
  /\b(reduced|increased|improved|grew|cut|saved|boosted|raised|lowered|accelerated)\b[^.\n]*\b\d/i,
];

// Filler / clichés that ATS reviewers flag as low-signal.
const CLICHES = [
  'team player', 'hard worker', 'hard working', 'go-getter', 'detail-oriented',
  'detail oriented', 'results-driven', 'results driven', 'self-starter',
  'self starter', 'think outside the box', 'synergy', 'go getter',
  'responsible for', 'duties included', 'fast learner', 'people person',
  'best of breed', 'value add', 'dynamic', 'guru', 'ninja', 'rockstar',
];

const PRONOUNS = /\b(i|me|my|mine|myself)\b/gi;

// Canonical skill -> all surface forms (lowercased). Matching is word-boundary
// safe, so short forms (js, go, r) only match as standalone tokens.
const SKILL_LEXICON: { label: string; terms: string[] }[] = [
  // Languages
  { label: 'JavaScript', terms: ['javascript', 'js'] },
  { label: 'TypeScript', terms: ['typescript', 'ts'] },
  { label: 'Python', terms: ['python'] },
  { label: 'Java', terms: ['java'] },
  { label: 'C++', terms: ['c++', 'cpp'] },
  { label: 'C#', terms: ['c#', 'c sharp', 'csharp'] },
  { label: 'C', terms: ['c language', 'c programming'] },
  { label: 'Go', terms: ['golang', 'go lang'] },
  { label: 'Rust', terms: ['rust'] },
  { label: 'Ruby', terms: ['ruby'] },
  { label: 'PHP', terms: ['php'] },
  { label: 'Swift', terms: ['swift'] },
  { label: 'Kotlin', terms: ['kotlin'] },
  { label: 'Scala', terms: ['scala'] },
  { label: 'R', terms: ['r programming', 'r language'] },
  { label: 'SQL', terms: ['sql'] },
  { label: 'HTML', terms: ['html', 'html5'] },
  { label: 'CSS', terms: ['css', 'css3'] },
  { label: 'Dart', terms: ['dart'] },
  { label: 'MATLAB', terms: ['matlab'] },
  // Frontend
  { label: 'React', terms: ['react', 'react.js', 'reactjs'] },
  { label: 'Next.js', terms: ['next.js', 'nextjs', 'next js'] },
  { label: 'Vue', terms: ['vue', 'vue.js', 'vuejs'] },
  { label: 'Angular', terms: ['angular', 'angularjs'] },
  { label: 'Svelte', terms: ['svelte', 'sveltekit'] },
  { label: 'Redux', terms: ['redux'] },
  { label: 'Tailwind CSS', terms: ['tailwind', 'tailwindcss', 'tailwind css'] },
  { label: 'Sass', terms: ['sass', 'scss'] },
  { label: 'jQuery', terms: ['jquery'] },
  { label: 'Webpack', terms: ['webpack'] },
  { label: 'Vite', terms: ['vite'] },
  // Backend / runtime
  { label: 'Node.js', terms: ['node.js', 'nodejs', 'node js', 'node'] },
  { label: 'Express', terms: ['express', 'express.js', 'expressjs'] },
  { label: 'Django', terms: ['django'] },
  { label: 'Flask', terms: ['flask'] },
  { label: 'FastAPI', terms: ['fastapi', 'fast api'] },
  { label: 'Spring Boot', terms: ['spring boot', 'spring', 'springboot'] },
  { label: '.NET', terms: ['.net', 'dotnet', 'asp.net'] },
  { label: 'Rails', terms: ['rails', 'ruby on rails'] },
  { label: 'GraphQL', terms: ['graphql'] },
  { label: 'REST API', terms: ['rest', 'rest api', 'restful', 'rest apis'] },
  { label: 'gRPC', terms: ['grpc'] },
  { label: 'Microservices', terms: ['microservices', 'microservice'] },
  // Databases
  { label: 'PostgreSQL', terms: ['postgresql', 'postgres', 'psql'] },
  { label: 'MySQL', terms: ['mysql'] },
  { label: 'MongoDB', terms: ['mongodb', 'mongo'] },
  { label: 'Redis', terms: ['redis'] },
  { label: 'SQLite', terms: ['sqlite'] },
  { label: 'Firebase', terms: ['firebase', 'firestore'] },
  { label: 'DynamoDB', terms: ['dynamodb', 'dynamo'] },
  { label: 'Elasticsearch', terms: ['elasticsearch', 'elastic search'] },
  { label: 'Cassandra', terms: ['cassandra'] },
  { label: 'Oracle', terms: ['oracle db', 'oracle database'] },
  // Cloud / DevOps
  { label: 'AWS', terms: ['aws', 'amazon web services'] },
  { label: 'Azure', terms: ['azure', 'microsoft azure'] },
  { label: 'GCP', terms: ['gcp', 'google cloud', 'google cloud platform'] },
  { label: 'Docker', terms: ['docker'] },
  { label: 'Kubernetes', terms: ['kubernetes', 'k8s'] },
  { label: 'Terraform', terms: ['terraform'] },
  { label: 'CI/CD', terms: ['ci/cd', 'cicd', 'continuous integration', 'continuous deployment', 'continuous delivery'] },
  { label: 'Jenkins', terms: ['jenkins'] },
  { label: 'GitHub Actions', terms: ['github actions'] },
  { label: 'Linux', terms: ['linux', 'unix'] },
  { label: 'Nginx', terms: ['nginx'] },
  { label: 'Kafka', terms: ['kafka', 'apache kafka'] },
  { label: 'RabbitMQ', terms: ['rabbitmq'] },
  { label: 'Serverless', terms: ['serverless', 'lambda'] },
  // Data / ML / AI
  { label: 'Machine Learning', terms: ['machine learning', 'ml'] },
  { label: 'Deep Learning', terms: ['deep learning'] },
  { label: 'NLP', terms: ['nlp', 'natural language processing'] },
  { label: 'Computer Vision', terms: ['computer vision', 'opencv'] },
  { label: 'TensorFlow', terms: ['tensorflow'] },
  { label: 'PyTorch', terms: ['pytorch'] },
  { label: 'scikit-learn', terms: ['scikit-learn', 'sklearn', 'scikit learn'] },
  { label: 'Pandas', terms: ['pandas'] },
  { label: 'NumPy', terms: ['numpy'] },
  { label: 'Data Analysis', terms: ['data analysis', 'data analytics'] },
  { label: 'Data Science', terms: ['data science'] },
  { label: 'Power BI', terms: ['power bi', 'powerbi'] },
  { label: 'Tableau', terms: ['tableau'] },
  { label: 'Spark', terms: ['spark', 'apache spark', 'pyspark'] },
  { label: 'Hadoop', terms: ['hadoop'] },
  { label: 'LLMs', terms: ['llm', 'llms', 'large language model', 'large language models', 'generative ai', 'gen ai'] },
  // Mobile
  { label: 'Flutter', terms: ['flutter'] },
  { label: 'React Native', terms: ['react native'] },
  { label: 'Android', terms: ['android'] },
  { label: 'iOS', terms: ['ios'] },
  // Testing / tooling
  { label: 'Git', terms: ['git', 'github', 'gitlab', 'version control'] },
  { label: 'Jest', terms: ['jest'] },
  { label: 'Cypress', terms: ['cypress'] },
  { label: 'Selenium', terms: ['selenium'] },
  { label: 'Playwright', terms: ['playwright'] },
  { label: 'Unit Testing', terms: ['unit testing', 'unit tests'] },
  { label: 'Postman', terms: ['postman'] },
  { label: 'Jira', terms: ['jira'] },
  { label: 'Figma', terms: ['figma'] },
  // Methodologies / concepts
  { label: 'Agile', terms: ['agile', 'scrum', 'kanban'] },
  { label: 'OOP', terms: ['oop', 'object-oriented', 'object oriented'] },
  { label: 'Data Structures', terms: ['data structures', 'dsa'] },
  { label: 'Algorithms', terms: ['algorithms', 'algorithm'] },
  { label: 'System Design', terms: ['system design'] },
  { label: 'TDD', terms: ['tdd', 'test driven', 'test-driven'] },
  { label: 'OAuth', terms: ['oauth', 'jwt', 'authentication'] },
  // Soft skills
  { label: 'Communication', terms: ['communication'] },
  { label: 'Leadership', terms: ['leadership'] },
  { label: 'Problem Solving', terms: ['problem solving', 'problem-solving'] },
  { label: 'Teamwork', terms: ['teamwork', 'collaboration'] },
  { label: 'Project Management', terms: ['project management'] },
];

// ── Text helpers ─────────────────────────────────────────────────────────

const BOUNDARY = '[^a-z0-9+#./]';

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalize(s: string): string {
  return (s || '').toLowerCase().replace(/\s+/g, ' ');
}

function hasContent(val: string): boolean {
  return !!val && val.trim().length > 0;
}

// Word-boundary aware presence test (handles c++, node.js, ci/cd; avoids
// matching "react" inside "reactor"). No lookbehind — safe on every engine.
function testPresence(text: string, term: string): boolean {
  if (!term) return false;
  const e = escapeRegExp(term.toLowerCase());
  return new RegExp(`(?:^|${BOUNDARY})(?:${e})(?:${BOUNDARY}|$)`, 'i').test(text);
}

function countOccurrences(text: string, term: string): number {
  if (!term) return 0;
  const e = escapeRegExp(term.toLowerCase());
  const re = new RegExp(`(?:^|${BOUNDARY})(?:${e})(?=${BOUNDARY}|$)`, 'gi');
  return (text.match(re) || []).length;
}

function bulletLines(text: string): string[] {
  if (!hasContent(text)) return [];
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^[-•*]/.test(l) || l.length > 24);
}

function variantsForKey(key: string): string[] {
  const lex = SKILL_LEXICON.find((e) => e.label.toLowerCase() === key);
  return lex ? lex.terms : [key];
}

// Build the JD/target skill set: lexicon hits in the JD (frequency-weighted)
// merged with any AI-extracted keywords (normalized to canonical skills).
function buildTargetSkills(jobText: string, aiKeywords: string[]): ATSSkill[] {
  const jd = normalize(jobText);
  const map = new Map<string, ATSSkill>();

  if (jd) {
    for (const entry of SKILL_LEXICON) {
      let freq = 0;
      for (const t of entry.terms) freq += countOccurrences(jd, t);
      if (freq > 0) {
        const key = entry.label.toLowerCase();
        map.set(key, { key, label: entry.label, freq });
      }
    }
  }

  for (const raw of aiKeywords) {
    const norm = normalize(raw).trim();
    if (!norm) continue;
    const lex = SKILL_LEXICON.find((e) => e.label.toLowerCase() === norm || e.terms.includes(norm));
    const key = lex ? lex.label.toLowerCase() : norm;
    const label = lex ? lex.label : raw.trim();
    if (map.has(key)) continue;
    const freq = jd ? Math.max(1, countOccurrences(jd, norm)) : 1;
    map.set(key, { key, label, freq });
  }

  return [...map.values()].sort((a, b) => b.freq - a.freq);
}

// ── Core scoring ───────────────────────────────────────────────────────────

export function calculateATSScore(
  data: ResumeFields,
  keywords: string[] = [],
  jobDescription = '',
): ScoreBreakdown {
  const resumeText = normalize([
    data.education, data.experience, data.skills, data.projects,
    data.coursework, data.extracurriculars, data.achievements,
  ].join('\n'));

  const recs: { priority: 'high' | 'medium' | 'low'; text: string; gain: number }[] = [];
  const categories: ATSCategory[] = [];

  // ── 1. Searchability & Contact (15) ──
  {
    const details: string[] = [];
    let score = 0;
    const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((data.email || '').trim());
    const phoneDigits = (data.phone || '').replace(/\D/g, '').length;

    const add = (ok: boolean, pts: number, okMsg: string, badMsg: string) => {
      if (ok) { score += pts; details.push(`✓ ${okMsg}`); } else { details.push(`✗ ${badMsg}`); }
    };
    add(hasContent(data.fullName), 2, 'Name present', 'Name missing');
    add(hasContent(data.email), 2, 'Email present', 'Email missing');
    add(hasContent(data.email) && emailValid, 1, 'Email is well-formed', 'Email format looks off');
    add(hasContent(data.phone), 2, 'Phone present', 'Phone missing');
    add(hasContent(data.phone) && phoneDigits >= 10, 1, 'Phone is parseable', 'Phone number incomplete');
    add(hasContent(data.linkedin), 3, 'LinkedIn linked', 'LinkedIn URL missing');
    add(hasContent(data.github) || hasContent(data.website), 2, 'GitHub / portfolio linked', 'GitHub or portfolio missing');
    const datesPresent = /\b(19|20)\d{2}\b/.test(data.experience + ' ' + data.education) || /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(data.experience);
    add(datesPresent, 2, 'Dates detected (parseable timeline)', 'Add dates so ATS can build a timeline');

    if (!hasContent(data.linkedin)) recs.push({ priority: 'medium', text: 'Add your LinkedIn URL — recruiters and ATS profiles expect it.', gain: 3 });
    if (!hasContent(data.github) && !hasContent(data.website)) recs.push({ priority: 'low', text: 'Add a GitHub or portfolio link to show your work.', gain: 2 });
    categories.push({ key: 'contact', label: 'Searchability & Contact', score, max: 15, details });
  }

  // ── 2. Hard-skill match vs JD (30) ──
  const target = buildTargetSkills(jobDescription, keywords);
  const matched: ATSSkill[] = [];
  const missing: ATSSkill[] = [];
  for (const s of target) (variantsForKey(s.key).some((v) => testPresence(resumeText, v)) ? matched : missing).push(s);
  const totalWeight = target.reduce((a, s) => a + s.freq, 0) || 1;
  const matchedWeight = matched.reduce((a, s) => a + s.freq, 0);
  const matchRate = target.length ? matchedWeight / totalWeight : 0;
  {
    const details: string[] = [];
    let score: number;
    if (target.length) {
      score = Math.round(matchRate * 30);
      const pct = Math.round(matchRate * 100);
      details.push(`${pct >= 75 ? '✓' : pct >= 50 ? '△' : '✗'} Matches ${matched.length}/${target.length} target skills (${pct}% weighted)`);
      if (missing.length) {
        const top = missing.slice(0, 8).map((s) => s.label);
        details.push(`✗ Missing: ${top.join(', ')}${missing.length > 8 ? `, +${missing.length - 8} more` : ''}`);
        const topMiss = missing.slice(0, 6).map((s) => s.label).join(', ');
        recs.push({
          priority: matchRate < 0.5 ? 'high' : 'medium',
          text: `Weave in ${missing.length} missing JD skill${missing.length > 1 ? 's' : ''} you have experience with: ${topMiss}${missing.length > 6 ? '…' : ''}.`,
          gain: Math.round((1 - matchRate) * 30),
        });
      } else {
        details.push('✓ Resume covers every target skill');
      }
    } else {
      // No JD — reward a skill-rich resume so the score still means something.
      const distinct = SKILL_LEXICON.filter((e) => e.terms.some((t) => testPresence(resumeText, t)));
      const n = distinct.length;
      score = n >= 14 ? 22 : n >= 10 ? 18 : n >= 7 ? 14 : n >= 4 ? 10 : n >= 1 ? 6 : 0;
      details.push(`${n >= 7 ? '✓' : n >= 4 ? '△' : '✗'} ${n} recognized skills detected`);
      details.push('△ Paste a job description above for a real skill-gap match');
      recs.push({ priority: 'high', text: 'Paste the target job description to unlock a real keyword/skill-gap match — the #1 ATS factor.', gain: 30 - score });
    }
    categories.push({ key: 'skills', label: 'Hard-Skill Match', score, max: 30, details });
  }

  // ── 3. Section coverage (15) ──
  {
    const checks = [
      { field: data.education, label: 'Education', pts: 3 },
      { field: data.experience, label: 'Experience', pts: 3 },
      { field: data.skills, label: 'Technical Skills', pts: 3 },
      { field: data.projects, label: 'Projects', pts: 3 },
      { field: data.achievements, label: 'Achievements', pts: 1 },
      { field: data.coursework, label: 'Coursework', pts: 1 },
      { field: data.extracurriculars, label: 'Extracurriculars', pts: 1 },
    ];
    let score = 0;
    const details: string[] = [];
    for (const c of checks) {
      if (hasContent(c.field)) { score += c.pts; details.push(`✓ ${c.label}`); }
      else { details.push(`✗ ${c.label} empty`); if (c.pts >= 3) recs.push({ priority: 'medium', text: `Add a ${c.label} section — core sections are expected by ATS parsers.`, gain: c.pts }); }
    }
    categories.push({ key: 'sections', label: 'Section Coverage', score, max: 15, details });
  }

  // ── 4. Impact & depth (25) ──
  {
    const details: string[] = [];
    let score = 0;
    const expProj = normalize(data.experience + '\n' + data.projects);
    const lines = (data.experience + '\n' + data.projects).split('\n').map((l) => l.trim()).filter(Boolean);

    const usedVerbs = ACTION_VERBS.filter((v) => testPresence(expProj, v));
    if (usedVerbs.length >= 10) { score += 8; details.push(`✓ Strong action verbs (${usedVerbs.length})`); }
    else if (usedVerbs.length >= 6) { score += 6; details.push(`△ Decent action verbs (${usedVerbs.length}, aim 10+)`); }
    else if (usedVerbs.length >= 3) { score += 4; details.push(`△ Few action verbs (${usedVerbs.length})`); recs.push({ priority: 'medium', text: 'Start more bullets with strong action verbs (Built, Led, Optimized…).', gain: 4 }); }
    else { score += 1; details.push(`✗ Very few action verbs (${usedVerbs.length})`); recs.push({ priority: 'high', text: 'Rewrite bullets to lead with action verbs (Built, Designed, Reduced…).', gain: 7 }); }

    const metrics = lines.filter((l) => MEASURABLE_PATTERNS.some((p) => p.test(l))).length;
    if (metrics >= 6) { score += 9; details.push(`✓ Well quantified (${metrics} metrics)`); }
    else if (metrics >= 3) { score += 6; details.push(`△ Some quantified impact (${metrics}, aim 6+)`); recs.push({ priority: 'medium', text: `Quantify more results — only ${metrics} bullets have numbers. Add %, $, scale or time saved.`, gain: 3 }); }
    else if (metrics >= 1) { score += 3; details.push(`✗ Thin quantification (${metrics})`); recs.push({ priority: 'high', text: 'Add measurable impact (numbers, %, $, users) to your bullets — this is what recruiters scan for.', gain: 6 }); }
    else { details.push('✗ No quantified impact'); recs.push({ priority: 'high', text: 'Add measurable impact (numbers, %, $, users) — none detected. e.g. "cut load time by 40%".', gain: 9 }); }

    const expBullets = bulletLines(data.experience).length;
    const projBullets = bulletLines(data.projects).length;
    if (expBullets >= 6 && projBullets >= 3) { score += 8; details.push(`✓ Good detail (${expBullets} exp / ${projBullets} project bullets)`); }
    else if (expBullets + projBullets >= 5) { score += 5; details.push(`△ Moderate detail (${expBullets} exp / ${projBullets} project bullets)`); }
    else if (expBullets + projBullets >= 2) { score += 3; details.push(`✗ Thin detail (${expBullets + projBullets} bullets)`); recs.push({ priority: 'medium', text: 'Expand experience/projects to 3–6 bullets each describing what you did and the outcome.', gain: 5 }); }
    else { details.push('✗ Very little experience/project detail'); recs.push({ priority: 'high', text: 'Describe your experience and projects with concrete bullet points.', gain: 8 }); }

    categories.push({ key: 'impact', label: 'Impact & Depth', score, max: 25, details });
  }

  // ── 5. Formatting & best practices (15) ──
  {
    const details: string[] = [];
    let score = 0;
    const words = resumeText.split(/\s+/).filter(Boolean).length;
    if (words >= 400 && words <= 850) { score += 5; details.push(`✓ Good length (~${words} words)`); }
    else if ((words >= 250 && words < 400) || (words > 850 && words <= 1050)) { score += 3; details.push(`△ Length okay (~${words} words)`); }
    else if (words < 250) { score += 1; details.push(`✗ Too sparse (~${words} words)`); recs.push({ priority: 'medium', text: 'Resume is light — flesh out experience and projects to ~400–800 words.', gain: 4 }); }
    else { score += 1; details.push(`✗ Likely too long (~${words} words)`); recs.push({ priority: 'low', text: 'Trim to one page (~400–800 words) — tighten or cut the weakest bullets.', gain: 4 }); }

    const pronouns = (data.experience + ' ' + data.projects + ' ' + data.achievements).match(PRONOUNS)?.length ?? 0;
    if (pronouns === 0) { score += 3; details.push('✓ No first-person pronouns'); }
    else if (pronouns <= 2) { score += 2; details.push(`△ ${pronouns} first-person pronoun(s)`); }
    else { details.push(`✗ ${pronouns} first-person pronouns`); recs.push({ priority: 'low', text: 'Drop first-person pronouns ("I", "my") — resumes are written in implied first person.', gain: 3 }); }

    const clichesFound = CLICHES.filter((c) => testPresence(resumeText, c));
    if (clichesFound.length === 0) { score += 4; details.push('✓ No filler clichés'); }
    else if (clichesFound.length <= 2) { score += 2; details.push(`△ Some clichés (${clichesFound.slice(0, 3).join(', ')})`); recs.push({ priority: 'low', text: `Replace vague clichés (${clichesFound.slice(0, 3).join(', ')}) with concrete, evidenced statements.`, gain: 2 }); }
    else { details.push(`✗ Many clichés (${clichesFound.length})`); recs.push({ priority: 'medium', text: 'Cut buzzwords/clichés ("team player", "responsible for"…) — show, don\'t tell.', gain: 4 }); }

    const usesBullets = bulletLines(data.experience).length > 0 || bulletLines(data.projects).length > 0;
    if (usesBullets) { score += 3; details.push('✓ Uses bullet points'); }
    else { details.push('✗ No bullet points detected'); recs.push({ priority: 'medium', text: 'Use bullet points for experience and projects — paragraphs parse poorly in ATS.', gain: 3 }); }

    categories.push({ key: 'format', label: 'Formatting & Best Practices', score, max: 15, details });
  }

  const total = Math.min(100, categories.reduce((a, c) => a + c.score, 0));
  const grade = total >= 85 ? 'Excellent' : total >= 70 ? 'Strong' : total >= 50 ? 'Needs Work' : 'Weak';

  const priorityRank = { high: 0, medium: 1, low: 2 };
  const recommendations: ATSRecommendation[] = recs
    .sort((a, b) => (priorityRank[a.priority] - priorityRank[b.priority]) || (b.gain - a.gain))
    .slice(0, 6)
    .map(({ priority, text }) => ({ priority, text }));

  return {
    total,
    grade,
    categories,
    skills: { matched, missing, matchRate, hasTarget: target.length > 0 },
    recommendations,
  };
}

// ── UI ───────────────────────────────────────────────────────────────────

function scoreColor(pct: number): string {
  return pct >= 75 ? 'var(--status-success)' : pct >= 50 ? 'var(--status-warning)' : 'var(--accent-orange)';
}

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = scoreColor(score);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border-subtle)" strokeWidth={4} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={4}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease-out' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-[19px] font-bold tabular-nums" style={{ color }}>{score}</span>
        <span className="text-[8px] font-semibold text-[var(--text-faint)] mt-0.5">/100</span>
      </div>
    </div>
  );
}

function CategoryBar({ label, score, max }: { label: string; score: number; max: number }) {
  const pct = max ? Math.round((score / max) * 100) : 0;
  const color = scoreColor(pct);
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-[11px] font-medium text-[var(--text-secondary)]">{label}</span>
        <span className="text-[10px] font-semibold tabular-nums" style={{ color }}>{score}/{max}</span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--border-subtle)] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

const PRIORITY_STYLE: Record<ATSRecommendation['priority'], { dot: string; label: string }> = {
  high:   { dot: 'var(--status-danger)',  label: 'High' },
  medium: { dot: 'var(--status-warning)', label: 'Med' },
  low:    { dot: 'var(--text-faint)',     label: 'Low' },
};

function Recommendations({ items }: { items: ATSRecommendation[] }) {
  if (!items.length) return null;
  return (
    <div className="space-y-1.5">
      {items.map((r, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="mt-[5px] w-1.5 h-1.5 rounded-full shrink-0" style={{ background: PRIORITY_STYLE[r.priority].dot }} />
          <p className="text-[11.5px] leading-snug text-[var(--text-secondary)]">{r.text}</p>
        </div>
      ))}
    </div>
  );
}

function SkillChips({ skills, kind }: { skills: ATSSkill[]; kind: 'matched' | 'missing' }) {
  if (!skills.length) return null;
  const cls = kind === 'matched'
    ? 'bg-[var(--status-success)]/15 text-[var(--status-success)] border-[var(--status-success)]/20'
    : 'bg-[var(--accent-orange)]/10 text-[var(--accent-orange)] border-[var(--accent-orange)]/20';
  return (
    <div>
      <span className="text-[10px] text-[var(--text-muted)]">{kind === 'matched' ? 'Matched' : 'Missing'} ({skills.length}):</span>
      <div className="flex flex-wrap gap-1 mt-1">
        {skills.map((s) => (
          <span key={s.key} className={`px-1.5 py-0.5 rounded text-[9.5px] font-semibold border ${cls}`}>
            {s.label}{kind === 'missing' && s.freq > 1 ? ` ·${s.freq}` : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

function DetailSection({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="font-semibold text-[var(--text-secondary)] mb-1 uppercase tracking-[0.07em] text-[10px]">{title}</p>
      <div className="space-y-0.5">
        {items.map((item, i) => (
          <p key={i} className={`text-[11px] ${
            item.startsWith('✓') ? 'text-[var(--status-success)]' :
            item.startsWith('△') ? 'text-[var(--status-warning)]' :
            'text-[var(--accent-orange)]'
          }`}>{item}</p>
        ))}
      </div>
    </div>
  );
}

interface ATSScorePanelProps {
  data: ResumeFields;
  keywords?: string[];
  jobDescription?: string;
  compact?: boolean;
}

export default function ATSScorePanel({ data, keywords = [], jobDescription = '', compact = false }: ATSScorePanelProps) {
  const breakdown = useMemo(
    () => calculateATSScore(data, keywords, jobDescription),
    [data, keywords, jobDescription],
  );
  const [expanded, setExpanded] = React.useState(false);
  const gradeColor = scoreColor(breakdown.total);
  const { skills, recommendations } = breakdown;
  const matchPct = skills.hasTarget ? Math.round(skills.matchRate * 100) : null;

  return (
    <div className="window overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 flex items-center gap-5">
        <ScoreRing score={breakdown.total} size={compact ? 66 : 82} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">ATS Score</h3>
            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded"
              style={{ background: `color-mix(in srgb, ${gradeColor} 13%, transparent)`, color: gradeColor }}>
              {breakdown.grade}
            </span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)]">
            {matchPct !== null
              ? <>Skill match to job: <span className="font-semibold" style={{ color: scoreColor(matchPct) }}>{matchPct}%</span> · {skills.matched.length}/{skills.matched.length + skills.missing.length} keywords</>
              : 'How your resume performs against ATS screeners.'}
          </p>
        </div>
      </div>

      {/* Category bars */}
      <div className="px-5 pb-4 space-y-2">
        {breakdown.categories.map((c) => (
          <CategoryBar key={c.key} label={c.label} score={c.score} max={c.max} />
        ))}
      </div>

      {/* Top recommendations — the actionable core */}
      {recommendations.length > 0 && (
        <div className="px-5 py-3.5 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)]/40">
          <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)] mb-2">
            Top fixes to raise your score
          </p>
          <Recommendations items={compact ? recommendations.slice(0, 3) : recommendations.slice(0, 5)} />
        </div>
      )}

      {/* Expandable detail */}
      <div className="border-t border-[var(--border-subtle)]">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="w-full px-5 py-2.5 text-[11px] font-semibold text-[var(--text-tertiary)] hover:text-[var(--text-primary)] flex items-center justify-between transition-colors"
        >
          <span>{expanded ? 'Hide breakdown' : 'View detailed breakdown'}</span>
          <span className="text-[10px]">{expanded ? '▲' : '▼'}</span>
        </button>

        {expanded && (
          <div className="px-5 pb-5 space-y-4 text-[11px]">
            {skills.hasTarget && (
              <div className="space-y-2">
                <p className="font-semibold text-[var(--text-secondary)] uppercase tracking-[0.07em] text-[10px]">Keyword / Skill Gap</p>
                <SkillChips skills={skills.matched} kind="matched" />
                <SkillChips skills={skills.missing} kind="missing" />
              </div>
            )}
            {breakdown.categories.map((c) => (
              <DetailSection key={c.key} title={c.label} items={c.details} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
