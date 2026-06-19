'use client';

import Code2 from '@/components/icons/Code2';
import Search from '@/components/icons/Search';
import CheckCircle2 from '@/components/icons/CheckCircle2';
import ArrowRight from '@/components/icons/ArrowRight';
import Pin from '@/components/icons/Pin';
import Clock from '@/components/icons/Clock';
import RotateCcw from '@/components/icons/RotateCcw';
import Trophy from '@/components/icons/Trophy';
import Target from '@/components/icons/Target';
import { ListSkeleton } from '@/components/Skeleton';

export interface PracticeProblem {
  id: string;
  title: string;
  difficulty: string;
  functionName: string;
  testCases: Array<{ isHidden: boolean }>;
  createdAt: { seconds: number } | null;
  visibleUntil: { seconds: number } | null;
}

export interface PracticeViewProps {
  loading: boolean;
  problems: PracticeProblem[];
  filtered: PracticeProblem[];
  solvedIds: Set<string>;
  pinnedIds: Set<string>;
  searchQuery: string;
  difficultyFilter: string;
  onSearchQueryChange: (q: string) => void;
  onDifficultyFilterChange: (d: string) => void;
  onTogglePin: (e: React.MouseEvent, problemId: string) => void;
  onOpenProblem: (problemId: string) => void;
  now: number;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: 'bg-[var(--status-success)]/10 text-[var(--status-success)]',
  Medium: 'bg-[var(--status-warning)]/10 text-[var(--status-warning)]',
  Hard: 'bg-[var(--status-danger)]/10 text-[var(--status-danger)]',
};

export function PracticeView({
  loading,
  problems,
  filtered,
  solvedIds,
  pinnedIds,
  searchQuery,
  difficultyFilter,
  onSearchQueryChange,
  onDifficultyFilterChange,
  onTogglePin,
  onOpenProblem,
  now,
}: PracticeViewProps) {
  if (loading) {
    return <ListSkeleton withStats rows={6} />;
  }

  const stats = [
    { icon: Target, value: problems.length, label: 'Total Problems' },
    { icon: Trophy, value: solvedIds.size, label: 'Solved' },
    { icon: Clock, value: problems.length - solvedIds.size, label: 'Remaining' },
    { icon: Pin, value: pinnedIds.size, label: 'Pinned' },
  ];

  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in">
      <div className="pt-8 mb-7">
        <h1 className="text-[26px] font-semibold text-[var(--text-primary)] tracking-[-0.025em]">Practice Problems</h1>
        <p className="text-[var(--text-tertiary)] text-[13.5px] mt-1.5">Sharpen your skills with coding challenges</p>
      </div>

      {/* ── Stat strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden mb-6">
        {stats.map((s) => (
          <div key={s.label} className="p-4 border-b md:border-b-0 border-r border-[var(--border-subtle)] [&:nth-child(2n)]:border-r-0 md:[&:nth-child(2n)]:border-r md:last:!border-r-0">
            <div className="flex items-center gap-1.5 mb-2.5 text-[var(--text-faint)]">
              <s.icon size={13} />
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.07em]">{s.label}</span>
            </div>
            <p className="text-[19px] font-semibold text-[var(--text-primary)] tabular-nums tracking-[-0.01em]">{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Search + difficulty filter ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 mb-5">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
          <input
            value={searchQuery}
            onChange={e => onSearchQueryChange(e.target.value)}
            placeholder="Search problems..."
            className="w-full h-9 pl-9 pr-3 text-[13px] placeholder:text-[var(--text-faint)]"
          />
        </div>
        <div className="inline-flex rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-[3px]">
          {['All', 'Easy', 'Medium', 'Hard'].map(d => (
            <button
              key={d}
              onClick={() => onDifficultyFilterChange(d)}
              className={`px-3.5 py-1.5 text-[12px] font-medium rounded-[8px] transition-colors duration-150 ${
                difficultyFilter === d
                  ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-active)]'
                  : 'text-[var(--text-muted)] border border-transparent hover:text-[var(--text-primary)]'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius)] p-16 text-center">
          <Code2 size={36} className="mx-auto mb-4 text-[var(--text-faint)]" />
          <p className="text-[var(--text-secondary)] text-[13px] font-medium">
            {problems.length === 0 ? 'No practice problems available yet.' : 'No problems match your filter.'}
          </p>
          <p className="text-[var(--text-faint)] text-[12px] mt-1">
            {problems.length === 0 ? 'Check back later for new challenges.' : 'Try adjusting your search or filters.'}
          </p>
        </div>
      ) : (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius)] overflow-hidden">
          <div className="hidden sm:grid grid-cols-12 gap-4 px-5 py-2.5 text-[10.5px] font-semibold text-[var(--text-faint)] uppercase tracking-[0.07em] border-b border-[var(--border-subtle)]">
            <div className="col-span-1">Status</div>
            <div className="col-span-6">Title</div>
            <div className="col-span-2">Difficulty</div>
            <div className="col-span-3 text-right">Actions</div>
          </div>
          {filtered.map((p) => {
            const isSolved = solvedIds.has(p.id);
            const isPinned = pinnedIds.has(p.id);
            const isExpired = !!(p.visibleUntil && p.visibleUntil.seconds * 1000 < now);
            const msLeft = p.visibleUntil ? p.visibleUntil.seconds * 1000 - now : null;
            const daysLeft = msLeft !== null && msLeft > 0 ? Math.ceil(msLeft / 86400000) : null;
            const showExpiry = daysLeft !== null && daysLeft <= 3;
            return (
              <div
                key={p.id}
                onClick={() => !isExpired && onOpenProblem(p.id)}
                className={`border-b border-[var(--border-subtle)] last:border-b-0 group transition-colors duration-150 ${
                  isExpired ? 'opacity-40 cursor-default' : 'cursor-pointer hover:bg-[var(--bg-elevated)]'
                }`}
              >
                <div className="hidden sm:grid grid-cols-12 gap-4 px-5 py-3.5 items-center">
                  <div className="col-span-1 flex items-center justify-center">
                    {isSolved
                      ? <CheckCircle2 size={16} className="text-[var(--status-success)]" />
                      : <div className="w-[14px] h-[14px] rounded-full border-[1.5px] border-[var(--border-active)]" />
                    }
                  </div>
                  <div className="col-span-6 min-w-0">
                    <p className={`text-[13.5px] font-medium truncate transition-colors ${
                      isExpired ? 'text-[var(--text-faint)] line-through' : 'text-[var(--text-primary)]'
                    }`}>
                      {p.title}
                    </p>
                    {showExpiry && (
                      <div className="flex items-center gap-1 mt-1">
                        <Clock size={10} className="text-[var(--status-warning)]" />
                        <span className="text-[11px] text-[var(--status-warning)] font-medium">
                          Expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                    {isExpired && (
                      <span className="text-[10.5px] text-[var(--text-faint)] mt-0.5 block">Expired — pinned copy</span>
                    )}
                  </div>
                  <div className="col-span-2">
                    <span className={`text-[11px] font-medium px-2.5 py-[3px] rounded-full ${DIFFICULTY_COLORS[p.difficulty] || DIFFICULTY_COLORS['Medium']}`}>
                      {p.difficulty}
                    </span>
                  </div>
                  <div className="col-span-3 flex items-center justify-end gap-2">
                    {isExpired ? (
                      <span className="text-[12px] text-[var(--text-faint)] font-medium w-24 text-right">Expired</span>
                    ) : isSolved ? (
                      <span className="text-[12px] font-medium text-[var(--status-success)] flex items-center gap-1.5 w-24 justify-end">
                        <RotateCcw size={12} /> Reattempt
                      </span>
                    ) : (
                      <span className="text-[12px] font-medium text-[var(--accent-orange)] flex items-center gap-1.5 w-24 justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                        Solve <ArrowRight size={12} />
                      </span>
                    )}
                    <button
                      onClick={(e) => onTogglePin(e, p.id)}
                      title={isPinned ? 'Unpin' : 'Pin — keeps question after expiry'}
                      className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors shrink-0 ${
                        isPinned
                          ? 'text-[var(--accent-orange)] bg-[var(--accent-orange)]/10'
                          : 'text-[var(--text-faint)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
                      }`}
                    >
                      <Pin size={14} className={isPinned ? 'fill-current' : ''} />
                    </button>
                  </div>
                </div>

                <div className="flex sm:hidden items-center gap-3 px-4 py-3">
                  <div className="shrink-0">
                    {isSolved
                      ? <CheckCircle2 size={15} className="text-[var(--status-success)]" />
                      : <div className="w-[14px] h-[14px] rounded-full border-[1.5px] border-[var(--border-active)]" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] font-medium truncate transition-colors ${
                      isExpired ? 'text-[var(--text-faint)] line-through' : 'text-[var(--text-primary)]'
                    }`}>
                      {p.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10.5px] font-medium px-2 py-[2px] rounded-full ${DIFFICULTY_COLORS[p.difficulty] || DIFFICULTY_COLORS['Medium']}`}>
                        {p.difficulty}
                      </span>
                      {showExpiry && (
                        <span className="flex items-center gap-1 text-[10.5px] text-[var(--status-warning)] font-medium">
                          <Clock size={9} /> {daysLeft}d left
                        </span>
                      )}
                      {isExpired && (
                        <span className="text-[10.5px] text-[var(--text-faint)]">Expired</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => onTogglePin(e, p.id)}
                      className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors ${
                        isPinned
                          ? 'text-[var(--accent-orange)] bg-[var(--accent-orange)]/10'
                          : 'text-[var(--text-faint)]'
                      }`}
                    >
                      <Pin size={12} className={isPinned ? 'fill-current' : ''} />
                    </button>
                    {!isExpired && <ArrowRight size={14} className="text-[var(--text-faint)]" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
