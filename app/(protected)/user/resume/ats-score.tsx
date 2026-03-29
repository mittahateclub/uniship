// app/(protected)/user/resume/ats-score.tsx
'use client';

import React, { useMemo } from 'react';

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

interface ScoreBreakdown {
  total: number;
  contact: { score: number; max: number; details: string[] };
  sections: { score: number; max: number; details: string[] };
  keywords: { score: number; max: number; matched: string[]; missing: string[] };
  depth: { score: number; max: number; details: string[] };
  quality: { score: number; max: number; details: string[] };
}

const ACTION_VERBS = [
  'achieved', 'built', 'created', 'designed', 'developed', 'engineered',
  'established', 'implemented', 'improved', 'increased', 'integrated',
  'launched', 'led', 'managed', 'optimized', 'orchestrated', 'reduced',
  'resolved', 'spearheaded', 'streamlined', 'transformed', 'architected',
  'automated', 'collaborated', 'configured', 'delivered', 'deployed',
  'maintained', 'mentored', 'migrated', 'monitored', 'published',
  'refactored', 'scaled', 'secured', 'utilized', 'analyzed', 'coordinated',
];

const MEASURABLE_PATTERNS = [
  /\d+%/,
  /\d+x/,
  /\$\d/,
  /\d+\+?\s*(users?|clients?|customers?|projects?|teams?|members?)/i,
  /reduced\s+.*\s+by\s+\d/i,
  /increased\s+.*\s+by\s+\d/i,
  /improved\s+.*\s+by\s+\d/i,
  /saved\s+.*\s+\d/i,
];

function hasContent(val: string) {
  return val && val.trim().length > 0;
}

function countBullets(text: string): number {
  if (!hasContent(text)) return 0;
  return text.split('\n').filter(l => /^\s*[-•]/.test(l) || l.trim().length > 20).length;
}

export function calculateATSScore(data: ResumeFields, keywords: string[] = []): ScoreBreakdown {
  const allText = [
    data.education, data.experience, data.skills, data.projects,
    data.coursework, data.extracurriculars, data.achievements,
  ].join(' ').toLowerCase();

  // ── 1. Contact Info (15 pts) ──
  const contactChecks = [
    { field: data.fullName, label: 'Full name', pts: 3 },
    { field: data.email, label: 'Email', pts: 3 },
    { field: data.phone, label: 'Phone', pts: 3 },
    { field: data.linkedin, label: 'LinkedIn URL', pts: 3 },
    { field: data.github || data.website, label: 'GitHub/Website', pts: 3 },
  ];
  let contactScore = 0;
  const contactDetails: string[] = [];
  for (const c of contactChecks) {
    if (hasContent(c.field)) {
      contactScore += c.pts;
      contactDetails.push(`✓ ${c.label}`);
    } else {
      contactDetails.push(`✗ ${c.label} missing`);
    }
  }

  // ── 2. Section Coverage (25 pts) ──
  const sectionChecks = [
    { field: data.education, label: 'Education', pts: 5 },
    { field: data.experience, label: 'Experience', pts: 5 },
    { field: data.projects, label: 'Projects', pts: 4 },
    { field: data.skills, label: 'Technical Skills', pts: 5 },
    { field: data.coursework, label: 'Coursework', pts: 2 },
    { field: data.achievements, label: 'Achievements', pts: 2 },
    { field: data.extracurriculars, label: 'Extracurriculars', pts: 2 },
  ];
  let sectionScore = 0;
  const sectionDetails: string[] = [];
  for (const s of sectionChecks) {
    if (hasContent(s.field)) {
      sectionScore += s.pts;
      sectionDetails.push(`✓ ${s.label}`);
    } else {
      sectionDetails.push(`✗ ${s.label} empty`);
    }
  }

  // ── 3. Keyword Match (25 pts) ──
  let keywordScore = 0;
  const matched: string[] = [];
  const missing: string[] = [];
  if (keywords.length > 0) {
    for (const kw of keywords) {
      const kwLower = kw.toLowerCase();
      if (allText.includes(kwLower)) {
        matched.push(kw);
      } else {
        missing.push(kw);
      }
    }
    const matchRatio = matched.length / keywords.length;
    keywordScore = Math.round(matchRatio * 25);
  } else {
    // No keywords provided — give partial credit
    keywordScore = 10;
  }

  // ── 4. Content Depth (20 pts) ──
  let depthScore = 0;
  const depthDetails: string[] = [];

  const expBullets = countBullets(data.experience);
  const projBullets = countBullets(data.projects);

  if (expBullets >= 6) {
    depthScore += 7;
    depthDetails.push(`✓ Experience depth good (${expBullets} bullets)`);
  } else if (expBullets >= 3) {
    depthScore += 4;
    depthDetails.push(`△ Experience could use more detail (${expBullets} bullets)`);
  } else if (expBullets > 0) {
    depthScore += 2;
    depthDetails.push(`✗ Experience too thin (${expBullets} bullets)`);
  } else {
    depthDetails.push('✗ No experience bullets');
  }

  if (projBullets >= 4) {
    depthScore += 5;
    depthDetails.push(`✓ Projects well described (${projBullets} bullets)`);
  } else if (projBullets >= 2) {
    depthScore += 3;
    depthDetails.push(`△ Projects could use more detail (${projBullets} bullets)`);
  } else if (projBullets > 0) {
    depthScore += 1;
    depthDetails.push(`✗ Projects too brief (${projBullets} bullets)`);
  } else {
    depthDetails.push('✗ No project bullets');
  }

  // Skills depth: multiple categories
  const skillLines = data.skills ? data.skills.split('\n').filter(l => l.trim()).length : 0;
  if (skillLines >= 3) {
    depthScore += 5;
    depthDetails.push(`✓ Skills well categorized (${skillLines} lines)`);
  } else if (skillLines >= 1) {
    depthScore += 3;
    depthDetails.push(`△ Skills could be more detailed (${skillLines} lines)`);
  } else {
    depthDetails.push('✗ No skills listed');
  }

  // Education entries
  const eduBlocks = data.education ? data.education.split(/\n\n+/).filter(b => b.trim()).length : 0;
  if (eduBlocks >= 1) {
    depthScore += 3;
    depthDetails.push(`✓ Education present (${eduBlocks} entries)`);
  } else {
    depthDetails.push('✗ No education entries');
  }

  // ── 5. Quality Signals (15 pts) ──
  let qualityScore = 0;
  const qualityDetails: string[] = [];

  // Action verbs
  const expText = (data.experience + ' ' + data.projects).toLowerCase();
  const usedVerbs = ACTION_VERBS.filter(v => expText.includes(v));
  if (usedVerbs.length >= 8) {
    qualityScore += 5;
    qualityDetails.push(`✓ Strong action verbs (${usedVerbs.length} found)`);
  } else if (usedVerbs.length >= 4) {
    qualityScore += 3;
    qualityDetails.push(`△ Some action verbs (${usedVerbs.length} found, aim for 8+)`);
  } else {
    qualityScore += 1;
    qualityDetails.push(`✗ Few action verbs (${usedVerbs.length} found)`);
  }

  // Measurable impact
  const bulletLines = (data.experience + '\n' + data.projects).split('\n').filter(l => l.trim());
  const measurableCount = bulletLines.filter(l =>
    MEASURABLE_PATTERNS.some(p => p.test(l))
  ).length;
  if (measurableCount >= 5) {
    qualityScore += 5;
    qualityDetails.push(`✓ Good quantified impact (${measurableCount} metrics)`);
  } else if (measurableCount >= 2) {
    qualityScore += 3;
    qualityDetails.push(`△ Some quantified impact (${measurableCount} metrics, aim for 5+)`);
  } else {
    qualityScore += 1;
    qualityDetails.push(`✗ Lacks quantified impact (${measurableCount} found)`);
  }

  // Resume length check
  const totalWords = allText.split(/\s+/).filter(Boolean).length;
  if (totalWords >= 250 && totalWords <= 800) {
    qualityScore += 5;
    qualityDetails.push(`✓ Good length (~${totalWords} words)`);
  } else if (totalWords >= 150) {
    qualityScore += 3;
    qualityDetails.push(`△ Resume could be more detailed (~${totalWords} words)`);
  } else if (totalWords > 800) {
    qualityScore += 3;
    qualityDetails.push(`△ Resume may be too long (~${totalWords} words)`);
  } else {
    qualityScore += 1;
    qualityDetails.push(`✗ Resume too short (~${totalWords} words)`);
  }

  const total = contactScore + sectionScore + keywordScore + depthScore + qualityScore;

  return {
    total,
    contact: { score: contactScore, max: 15, details: contactDetails },
    sections: { score: sectionScore, max: 25, details: sectionDetails },
    keywords: { score: keywordScore, max: 25, matched, missing },
    depth: { score: depthScore, max: 20, details: depthDetails },
    quality: { score: qualityScore, max: 15, details: qualityDetails },
  };
}

// ── Score Ring ─────────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 75 ? '#4CAF50' : score >= 50 ? '#F1A82C' : '#F54E00';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="var(--border-subtle)" strokeWidth={4} />
        <circle cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={4}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease-out' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[18px] font-extrabold tabular-nums" style={{ color }}>
          {score}
        </span>
      </div>
    </div>
  );
}

// ── Category Bar ──────────────────────────────────────────────────────────────

function CategoryBar({ label, score, max }: { label: string; score: number; max: number }) {
  const pct = Math.round((score / max) * 100);
  const color = pct >= 75 ? '#4CAF50' : pct >= 50 ? '#F1A82C' : '#F54E00';

  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-[11px] font-semibold text-[var(--text-secondary)]">{label}</span>
        <span className="text-[10px] font-bold tabular-nums" style={{ color }}>
          {score}/{max}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--border-subtle)] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// ── ATS Score Panel ───────────────────────────────────────────────────────────

interface ATSScorePanelProps {
  data: ResumeFields;
  keywords?: string[];
  compact?: boolean;
}

export default function ATSScorePanel({ data, keywords = [], compact = false }: ATSScorePanelProps) {
  const breakdown = useMemo(() => calculateATSScore(data, keywords), [data, keywords]);
  const [expanded, setExpanded] = React.useState(false);

  const gradeLabel =
    breakdown.total >= 85 ? 'Excellent' :
    breakdown.total >= 70 ? 'Good' :
    breakdown.total >= 50 ? 'Needs Work' : 'Poor';

  const gradeColor =
    breakdown.total >= 75 ? '#4CAF50' :
    breakdown.total >= 50 ? '#F1A82C' : '#F54E00';

  return (
    <div className="window overflow-hidden">
      {/* Header row */}
      <div className="px-5 py-4 flex items-center gap-5">
        <ScoreRing score={breakdown.total} size={compact ? 64 : 80} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">ATS Score</h3>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded"
              style={{ background: `${gradeColor}15`, color: gradeColor }}>
              {gradeLabel}
            </span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] mb-3">
            How well your resume performs against ATS parsing systems.
          </p>
          <div className="space-y-2">
            <CategoryBar label="Contact Info" score={breakdown.contact.score} max={breakdown.contact.max} />
            <CategoryBar label="Section Coverage" score={breakdown.sections.score} max={breakdown.sections.max} />
            <CategoryBar label="Keyword Match" score={breakdown.keywords.score} max={breakdown.keywords.max} />
            <CategoryBar label="Content Depth" score={breakdown.depth.score} max={breakdown.depth.max} />
            <CategoryBar label="Quality Signals" score={breakdown.quality.score} max={breakdown.quality.max} />
          </div>
        </div>
      </div>

      {/* Expandable details */}
      <div className="border-t border-[var(--border-subtle)]">
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full px-5 py-2.5 text-[11px] font-semibold text-[var(--text-tertiary)] hover:text-[var(--text-primary)] flex items-center justify-between transition-colors"
        >
          <span>{expanded ? 'Hide Details' : 'View Detailed Breakdown'}</span>
          <span className="text-[10px]">{expanded ? '▲' : '▼'}</span>
        </button>

        {expanded && (
          <div className="px-5 pb-5 space-y-4 text-[11px]">
            {/* Contact */}
            <DetailSection title="Contact Info" items={breakdown.contact.details} />

            {/* Sections */}
            <DetailSection title="Section Coverage" items={breakdown.sections.details} />

            {/* Keywords */}
            {keywords.length > 0 && (
              <div>
                <p className="font-bold text-[var(--text-secondary)] mb-1.5 uppercase tracking-widest text-[10px]">Keyword Match</p>
                {breakdown.keywords.matched.length > 0 && (
                  <div className="mb-2">
                    <span className="text-[10px] text-[var(--text-muted)]">Matched ({breakdown.keywords.matched.length}):</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {breakdown.keywords.matched.map((kw, i) => (
                        <span key={i} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#4CAF50]/15 text-[#4CAF50] border border-[#4CAF50]/20">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {breakdown.keywords.missing.length > 0 && (
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)]">Missing ({breakdown.keywords.missing.length}):</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {breakdown.keywords.missing.map((kw, i) => (
                        <span key={i} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#F54E00]/10 text-[#F54E00] border border-[#F54E00]/20">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Depth */}
            <DetailSection title="Content Depth" items={breakdown.depth.details} />

            {/* Quality */}
            <DetailSection title="Quality Signals" items={breakdown.quality.details} />
          </div>
        )}
      </div>
    </div>
  );
}

function DetailSection({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-widest text-[10px]">{title}</p>
      <div className="space-y-0.5">
        {items.map((item, i) => (
          <p key={i} className={`text-[11px] ${
            item.startsWith('✓') ? 'text-[#4CAF50]' :
            item.startsWith('△') ? 'text-[#F1A82C]' :
            'text-[#F54E00]'
          }`}>
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}
