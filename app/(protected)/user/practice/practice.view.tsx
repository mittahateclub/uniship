'use client';

import { Code2, Search, CheckCircle2, ArrowRight, Pin, Clock, RotateCcw, Trophy, Target } from 'lucide-react';

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
}

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: 'bg-teal-500/10 text-teal-400 border border-teal-500/20',
  Medium: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  Hard: 'bg-red-500/10 text-red-400 border border-red-500/20',
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
}: PracticeViewProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-dots"><span /><span /><span /></div>
      </div>
    );
  }

  return (
    <div className="px-3 sm:px-6 py-4 sm:py-6 animate-fade-in max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight">Practice Problems</h1>
          <p className="text-[var(--text-tertiary)] text-xs sm:text-sm mt-1">Sharpen your skills with coding challenges</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-6">
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#4B8BBE]/10 flex items-center justify-center shrink-0">
            <Target size={18} className="text-[#4B8BBE]" />
          </div>
          <div>
            <p className="text-xl font-bold text-[var(--text-primary)]">{problems.length}</p>
            <p className="text-[11px] text-[var(--text-faint)]">Total Problems</p>
          </div>
        </div>
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#4CAF50]/10 flex items-center justify-center shrink-0">
            <Trophy size={18} className="text-[#4CAF50]" />
          </div>
          <div>
            <p className="text-xl font-bold text-[var(--text-primary)]">{solvedIds.size}</p>
            <p className="text-[11px] text-[var(--text-faint)]">Solved</p>
          </div>
        </div>
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
            <Clock size={18} className="text-amber-400" />
          </div>
          <div>
            <p className="text-xl font-bold text-[var(--text-primary)]">{problems.length - solvedIds.size}</p>
            <p className="text-[11px] text-[var(--text-faint)]">Remaining</p>
          </div>
        </div>
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#4B8BBE]/10 flex items-center justify-center shrink-0">
            <Pin size={18} className="text-[#4B8BBE]" />
          </div>
          <div>
            <p className="text-xl font-bold text-[var(--text-primary)]">{pinnedIds.size}</p>
            <p className="text-[11px] text-[var(--text-faint)]">Pinned</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 mb-5">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
          <input
            value={searchQuery}
            onChange={e => onSearchQueryChange(e.target.value)}
            placeholder="Search problems..."
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[#4B8BBE] focus:ring-1 focus:ring-[#4B8BBE]/30 transition-all"
          />
        </div>
        <div className="inline-flex rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1">
          {['All', 'Easy', 'Medium', 'Hard'].map(d => (
            <button
              key={d}
              onClick={() => onDifficultyFilterChange(d)}
              className={`px-4 py-2 text-xs font-semibold rounded-md transition-all ${
                difficultyFilter === d
                  ? 'bg-[#4B8BBE] text-white shadow-sm'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-16 text-center">
          <Code2 size={40} className="mx-auto mb-4 text-[var(--text-faint)]" />
          <p className="text-[var(--text-secondary)] text-sm font-medium">
            {problems.length === 0 ? 'No practice problems available yet.' : 'No problems match your filter.'}
          </p>
          <p className="text-[var(--text-faint)] text-xs mt-1">
            {problems.length === 0 ? 'Check back later for new challenges.' : 'Try adjusting your search or filters.'}
          </p>
        </div>
      ) : (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl overflow-hidden">
          <div className="hidden sm:grid grid-cols-12 gap-4 px-6 py-3 text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wider bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)]">
            <div className="col-span-1">Status</div>
            <div className="col-span-6">Title</div>
            <div className="col-span-2">Difficulty</div>
            <div className="col-span-3 text-right">Actions</div>
          </div>
          {filtered.map((p) => {
            const isSolved = solvedIds.has(p.id);
            const isPinned = pinnedIds.has(p.id);
            const isExpired = !!(p.visibleUntil && p.visibleUntil.seconds * 1000 < Date.now());
            const msLeft = p.visibleUntil ? p.visibleUntil.seconds * 1000 - Date.now() : null;
            const daysLeft = msLeft !== null && msLeft > 0 ? Math.ceil(msLeft / 86400000) : null;
            const showExpiry = daysLeft !== null && daysLeft <= 3;
            return (
              <div
                key={p.id}
                onClick={() => !isExpired && onOpenProblem(p.id)}
                className={`border-b border-[var(--border-subtle)] last:border-b-0 group transition-all duration-150 ${
                  isExpired ? 'opacity-40 cursor-default' : 'cursor-pointer hover:bg-[var(--bg-elevated)]'
                }`}
              >
                <div className="hidden sm:grid grid-cols-12 gap-4 px-6 py-4 items-center">
                  <div className="col-span-1 flex items-center justify-center">
                    {isSolved
                      ? <CheckCircle2 size={18} className="text-[#4CAF50]" />
                      : <div className="w-4 h-4 rounded-full border-2 border-[var(--border-subtle)]" />
                    }
                  </div>
                  <div className="col-span-6 min-w-0">
                    <p className={`text-sm font-medium truncate transition-colors ${
                      isExpired ? 'text-[var(--text-faint)] line-through' : 'text-[var(--text-primary)] group-hover:text-[#4B8BBE]'
                    }`}>
                      {p.title}
                    </p>
                    {showExpiry && (
                      <div className="flex items-center gap-1 mt-1">
                        <Clock size={10} className="text-amber-400" />
                        <span className="text-[11px] text-amber-400 font-medium">
                          Expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                    {isExpired && (
                      <span className="text-[10px] text-[var(--text-faint)] mt-0.5 block">Expired — pinned copy</span>
                    )}
                  </div>
                  <div className="col-span-2">
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${DIFFICULTY_COLORS[p.difficulty] || DIFFICULTY_COLORS['Medium']}`}>
                      {p.difficulty}
                    </span>
                  </div>
                  <div className="col-span-3 flex items-center justify-end gap-2">
                    {isExpired ? (
                      <span className="text-xs text-[var(--text-faint)] font-medium w-24 text-right">Expired</span>
                    ) : isSolved ? (
                      <span className="text-xs font-medium text-[#4CAF50] flex items-center gap-1.5 w-24 justify-end">
                        <RotateCcw size={12} /> Reattempt
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-[#4B8BBE] flex items-center gap-1.5 w-24 justify-end">
                        Solve <ArrowRight size={12} />
                      </span>
                    )}
                    <button
                      onClick={(e) => onTogglePin(e, p.id)}
                      title={isPinned ? 'Unpin' : 'Pin — keeps question after expiry'}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all shrink-0 ${
                        isPinned
                          ? 'text-[#4B8BBE] bg-[#4B8BBE]/10'
                          : 'text-[var(--text-faint)] hover:text-[#4B8BBE] hover:bg-[#4B8BBE]/5'
                      }`}
                    >
                      <Pin size={14} className={isPinned ? 'fill-current' : ''} />
                    </button>
                  </div>
                </div>

                <div className="flex sm:hidden items-center gap-3 px-4 py-3">
                  <div className="shrink-0">
                    {isSolved
                      ? <CheckCircle2 size={16} className="text-[#4CAF50]" />
                      : <div className="w-4 h-4 rounded-full border-2 border-[var(--border-subtle)]" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] font-medium truncate transition-colors ${
                      isExpired ? 'text-[var(--text-faint)] line-through' : 'text-[var(--text-primary)]'
                    }`}>
                      {p.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${DIFFICULTY_COLORS[p.difficulty] || DIFFICULTY_COLORS['Medium']}`}>
                        {p.difficulty}
                      </span>
                      {showExpiry && (
                        <span className="flex items-center gap-1 text-[10px] text-amber-400 font-medium">
                          <Clock size={9} /> {daysLeft}d left
                        </span>
                      )}
                      {isExpired && (
                        <span className="text-[10px] text-[var(--text-faint)]">Expired</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => onTogglePin(e, p.id)}
                      className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${
                        isPinned
                          ? 'text-[#4B8BBE] bg-[#4B8BBE]/10'
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
