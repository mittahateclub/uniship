'use client';

import { useSyncExternalStore } from 'react';
import { Sun } from '@phosphor-icons/react/Sun';
import { Moon } from '@phosphor-icons/react/Moon';

type Theme = 'dark' | 'light';

let themeTransitionTimer: ReturnType<typeof setTimeout> | undefined;

const getThemeSnapshot = (): Theme => {
  if (typeof window === 'undefined') return 'dark';
  const saved = localStorage.getItem('theme') as Theme | null;
  const current = document.documentElement.getAttribute('data-theme') as Theme | null;
  return saved || current || 'dark';
};

const subscribeToTheme = (onStoreChange: () => void) => {
  window.addEventListener('storage', onStoreChange);
  window.addEventListener('theme-change', onStoreChange);
  return () => {
    window.removeEventListener('storage', onStoreChange);
    window.removeEventListener('theme-change', onStoreChange);
  };
};

// Always lives in the page's top chrome (nav / top bar), never floating.
// Pass a className to match the host surface; defaults to the app-chrome style.
export default function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, () => 'dark');

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    const root = document.documentElement;
    const apply = () => {
      root.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      window.dispatchEvent(new Event('theme-change'));
    };

    // Reduced-motion users get an instant switch.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      apply();
      return;
    }

    // Prefer the View Transitions API: one GPU-composited crossfade of the
    // whole-page snapshot (the same root dissolve routes use), instead of
    // transitioning the color of every element — which janks on box-shadow,
    // fill and stroke across a large tree.
    const doc = document as Document & { startViewTransition?: (cb: () => void) => void };
    if (typeof doc.startViewTransition === 'function') {
      doc.startViewTransition(apply);
      return;
    }

    // Fallback (no View Transitions): a class-scoped color crossfade. Force a
    // reflow so the transition commits with the *current* colors before the
    // palette flips — otherwise the class-add and value-change coalesce into one
    // paint and snap.
    root.classList.add('theme-transition');
    void root.offsetWidth;
    apply();
    if (themeTransitionTimer) clearTimeout(themeTransitionTimer);
    themeTransitionTimer = setTimeout(() => root.classList.remove('theme-transition'), 380);
  };

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      className={className ?? 'theme-btn-chrome'}
    >
      {theme === 'dark' ? <Sun size={16} weight="fill" /> : <Moon size={16} weight="fill" />}
    </button>
  );
}
