'use client';

// One standardized modal shell so every popup shares the same margins, radius,
// backdrop and header rhythm. Portaled to document.body to dodge the
// `.animate-fade-in` transform containing-block trap (fixed overlays inside a
// view root otherwise position against the page panel, not the viewport).

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import X from '@/components/icons/X';

type Size = 'sm' | 'md' | 'lg' | 'xl';
const MAXW: Record<Size, string> = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
};

export function Modal({
  open,
  onClose,
  size = 'md',
  className = '',
  children,
}: {
  open: boolean;
  onClose: () => void;
  size?: Size;
  className?: string;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  // A client-only portal mount flag is required to avoid server/client body hydration mismatch.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-[6px] animate-fade-in"
      onClick={onClose}
    >
      <div
        className={`w-full ${MAXW[size]} max-h-[88vh] flex flex-col overflow-hidden rounded-[14px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

// Consistent header: optional icon tile + title/subtitle + close button.
export function ModalHeader({
  icon: Icon,
  iconClass = 'text-[var(--text-secondary)]',
  iconWrapClass = 'bg-[var(--bg-elevated)]',
  title,
  subtitle,
  right,
  onClose,
}: {
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  iconClass?: string;
  iconWrapClass?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Optional content shown just before the close button (e.g. a summary chip). */
  right?: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[var(--border-subtle)] shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div className={`w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0 ${iconWrapClass}`}>
            <Icon size={17} className={iconClass} />
          </div>
        )}
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-[var(--text-primary)] truncate leading-tight">{title}</h3>
          {subtitle && <p className="text-[11.5px] text-[var(--text-tertiary)] truncate mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {right}
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

// Scroll region. Default has the standard px-5 py-4 inset; pass `flush` for
// full-bleed divided lists whose rows supply their own px-5.
export function ModalBody({
  children,
  flush = false,
  className = '',
}: {
  children: React.ReactNode;
  flush?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex-1 min-h-0 overflow-y-auto ${flush ? '' : 'px-5 py-4'} ${className}`}>
      {children}
    </div>
  );
}
