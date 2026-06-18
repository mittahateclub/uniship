'use client';

export interface Stat {
  label: string;
  value: React.ReactNode;
  /** Small leading glyph for quick scannability. */
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  /** Optional text-color class for the value, e.g. 'text-[var(--status-warning)]'. */
  accent?: string;
  /** Optional text-color class for the icon (defaults to faint). */
  iconAccent?: string;
  /** When provided, the segment becomes a button. */
  onClick?: () => void;
  /** Dims a clickable segment and blocks the click. */
  disabled?: boolean;
}

// One compact, divided stat bar — identifiable (border + icon + bold value)
// without the heavy, repetitive wall of tall metric boxes. Segments become
// buttons when an onClick is supplied (e.g. the proctoring stat strip).
export function StatBar({ items, className = '' }: { items: Stat[]; className?: string }) {
  return (
    <div className={`inline-flex flex-wrap items-stretch rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden divide-x divide-[var(--border-subtle)] ${className}`}>
      {items.map((it, i) => {
        const inner = (
          <>
            {it.icon && <it.icon size={14} className={`shrink-0 ${it.iconAccent ?? 'text-[var(--text-faint)]'}`} />}
            <span className={`text-[15px] font-semibold tabular-nums tracking-[-0.01em] ${it.accent ?? 'text-[var(--text-primary)]'}`}>{it.value}</span>
            <span className="text-[12px] text-[var(--text-faint)]">{it.label}</span>
          </>
        );
        return it.onClick ? (
          <button
            key={i}
            type="button"
            onClick={it.onClick}
            disabled={it.disabled}
            className="flex items-center gap-2 px-4 py-2.5 transition-colors enabled:hover:bg-[var(--bg-elevated)] disabled:opacity-55 disabled:cursor-not-allowed"
          >
            {inner}
          </button>
        ) : (
          <div key={i} className="flex items-center gap-2 px-4 py-2.5">
            {inner}
          </div>
        );
      })}
    </div>
  );
}
