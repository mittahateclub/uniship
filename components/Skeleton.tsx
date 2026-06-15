'use client';

// Shimmer placeholders built on the global `.skeleton` class (see globals.css).
// Used in place of the bare three-dot spinner on data-heavy pages so the
// page frame + header render immediately and content fades in.

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

function PageHeaderSkeleton() {
  return (
    <div className="pt-8 mb-7">
      <Skeleton className="h-[26px] w-52 max-w-[60%] !rounded-[8px] mb-2.5" />
      <Skeleton className="h-[14px] w-80 max-w-[75%] !rounded-[6px]" />
    </div>
  );
}

const panel = 'rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]';

// ── List pages (results, applications, practice, internships, test-portal, export list) ──
export function ListSkeleton({
  rows = 5,
  withStats = false,
  leadingChip = true,
}: {
  rows?: number;
  withStats?: boolean;
  leadingChip?: boolean;
}) {
  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in">
      <PageHeaderSkeleton />

      {withStats && (
        <div className={`grid grid-cols-2 md:grid-cols-4 ${panel} overflow-hidden mb-6`}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-4 border-b md:border-b-0 border-r border-[var(--border-subtle)] [&:nth-child(2n)]:border-r-0 md:[&:nth-child(2n)]:border-r md:last:!border-r-0">
              <Skeleton className="h-3 w-20 !rounded-[5px] mb-3" />
              <Skeleton className="h-5 w-12 !rounded-[6px]" />
            </div>
          ))}
        </div>
      )}

      <div className={`${panel} overflow-hidden`}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 sm:px-5 py-4 border-b border-[var(--border-subtle)] last:border-b-0">
            {leadingChip && <Skeleton className="w-9 h-9 !rounded-[8px] shrink-0" />}
            <div className="flex-1 min-w-0 space-y-2">
              <Skeleton className="h-3 w-24 !rounded-[5px]" />
              <Skeleton className="h-4 w-3/5 !rounded-[6px]" />
              <Skeleton className="h-3 w-2/5 !rounded-[5px]" />
            </div>
            <Skeleton className="h-6 w-20 !rounded-full shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Dashboard feed ──
export function FeedSkeleton() {
  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
        <div className="min-w-0 flex flex-col gap-5">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className={`${panel} overflow-hidden`}>
              <div className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="w-9 h-9 !rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-32 !rounded-[5px]" />
                  <Skeleton className="h-2.5 w-24 !rounded-[4px]" />
                </div>
                <Skeleton className="h-5 w-20 !rounded-full" />
              </div>
              <Skeleton className="w-full h-44 !rounded-none" />
              <div className="px-4 pt-3 space-y-2">
                <Skeleton className="h-4 w-1/2 !rounded-[6px]" />
                <Skeleton className="h-3 w-full !rounded-[5px]" />
                <Skeleton className="h-3 w-4/5 !rounded-[5px]" />
              </div>
              <div className="flex items-center gap-2 px-4 py-3 mt-1">
                <Skeleton className="h-7 w-24 !rounded-[8px]" />
                <div className="flex-1" />
                <Skeleton className="h-7 w-20 !rounded-[10px]" />
                <Skeleton className="h-7 w-16 !rounded-[10px]" />
              </div>
            </div>
          ))}
        </div>
        <aside className="hidden lg:flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <Skeleton className="w-12 h-12 !rounded-full" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-3.5 w-24 !rounded-[5px]" />
              <Skeleton className="h-2.5 w-32 !rounded-[4px]" />
            </div>
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={`${panel} p-4 space-y-3`}>
              <Skeleton className="h-3 w-24 !rounded-[5px]" />
              <Skeleton className="h-3 w-full !rounded-[5px]" />
              <Skeleton className="h-3 w-2/3 !rounded-[5px]" />
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}

// ── Calendar (month grid + sidebar) ──
export function CalendarSkeleton() {
  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in">
      <PageHeaderSkeleton />
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1">
          <div className={`${panel} overflow-hidden`}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
              <Skeleton className="w-7 h-7 !rounded-full" />
              <Skeleton className="h-4 w-32 !rounded-[6px]" />
              <Skeleton className="w-7 h-7 !rounded-full" />
            </div>
            <div className="grid grid-cols-7 border-b border-[var(--border-subtle)]">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="py-2.5 flex justify-center"><Skeleton className="h-2.5 w-6 !rounded-[4px]" /></div>
              ))}
            </div>
            <div>
              {Array.from({ length: 5 }).map((_, w) => (
                <div key={w} className="grid grid-cols-7 border-b border-[var(--border-subtle)] last:border-b-0">
                  {Array.from({ length: 7 }).map((_, c) => (
                    <div key={c} className="min-h-[68px] md:min-h-[80px] p-1.5 border-r border-[var(--border-subtle)] last:border-r-0">
                      <Skeleton className="w-6 h-6 !rounded-full" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="w-full lg:w-[300px] space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className={`${panel} p-4 space-y-3`}>
              <Skeleton className="h-3 w-20 !rounded-[5px]" />
              <Skeleton className="h-3 w-full !rounded-[5px]" />
              <Skeleton className="h-3 w-2/3 !rounded-[5px]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Detail page (internship detail: content + sticky facts rail) ──
export function DetailSkeleton() {
  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in">
      <div className="pt-8 mb-5"><Skeleton className="h-4 w-32 !rounded-[6px]" /></div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 space-y-5">
          <div className={`${panel} p-6 space-y-3`}>
            <Skeleton className="h-3 w-28 !rounded-[5px]" />
            <Skeleton className="h-7 w-3/5 !rounded-[8px]" />
            <Skeleton className="h-3.5 w-40 !rounded-[6px]" />
          </div>
          <div className={`${panel} p-6 space-y-2.5`}>
            <Skeleton className="h-3 w-24 !rounded-[5px] mb-1" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className={`h-3 !rounded-[5px] ${i === 4 ? 'w-2/3' : 'w-full'}`} />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className={`${panel} overflow-hidden`}>
            <div className="divide-y divide-[var(--border-subtle)]">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="w-8 h-8 !rounded-[8px] shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-2.5 w-16 !rounded-[4px]" />
                    <Skeleton className="h-3.5 w-24 !rounded-[5px]" />
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-[var(--border-subtle)]"><Skeleton className="h-10 w-full !rounded-[10px]" /></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Result review (summary chips + question cards) ──
export function ReviewSkeleton() {
  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in pb-16">
      <div className="pt-8 mb-5 space-y-4">
        <Skeleton className="h-4 w-28 !rounded-[6px]" />
        <Skeleton className="h-7 w-1/2 !rounded-[8px]" />
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-7 w-28 !rounded-full" />)}
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="window p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-10 !rounded-[5px]" />
              <Skeleton className="h-6 w-20 !rounded-full" />
            </div>
            <Skeleton className="h-3.5 w-4/5 !rounded-[6px]" />
            <div className="space-y-1.5">
              {Array.from({ length: 4 }).map((_, o) => <Skeleton key={o} className="h-9 w-full !rounded-[8px]" />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Resume builder (controls left, A4 preview right) ──
export function ResumeSkeleton() {
  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(320px,380px)_1fr] gap-5 items-start">
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={`${panel} p-5 space-y-3`}>
              <Skeleton className="h-3.5 w-32 !rounded-[6px]" />
              <Skeleton className="h-3 w-full !rounded-[5px]" />
              <Skeleton className="h-3 w-3/4 !rounded-[5px]" />
            </div>
          ))}
          <Skeleton className="h-11 w-full !rounded-[10px]" />
        </div>
        <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/40 overflow-hidden p-6">
          <div className="mx-auto bg-[var(--bg-surface)] w-full max-w-[640px] aspect-[1/1.414] rounded-[6px] p-8 space-y-3">
            <Skeleton className="h-6 w-1/3 mx-auto !rounded-[6px] mb-4" />
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className={`h-2.5 !rounded-[4px] ${[2, 6, 10].includes(i) ? 'w-1/4' : 'w-full'}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Profile (hero card + detail panels) ──
export function ProfileSkeleton() {
  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in">
      <PageHeaderSkeleton />
      <div className={`${panel} p-6 flex flex-col items-center gap-3 mb-5`}>
        <Skeleton className="w-24 h-24 !rounded-full" />
        <Skeleton className="h-5 w-40 !rounded-[6px]" />
        <Skeleton className="h-3 w-64 max-w-[80%] !rounded-[5px]" />
        <Skeleton className="h-1.5 w-full max-w-md !rounded-full mt-2" />
      </div>
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className={`${panel} p-6 space-y-4 mb-4`}>
          <Skeleton className="h-4 w-32 !rounded-[6px]" />
          {Array.from({ length: 3 }).map((_, f) => (
            <div key={f} className="space-y-1.5">
              <Skeleton className="h-2.5 w-24 !rounded-[4px]" />
              <Skeleton className="h-9 w-full !rounded-[8px]" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
