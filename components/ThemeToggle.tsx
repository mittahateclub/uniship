'use client';

import { useSyncExternalStore } from 'react';
import { Sun, Moon } from '@/components/icons';

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

    // Enable the crossfade, then force a reflow so the transition property is
    // committed with the *current* colors before we flip the palette — without
    // this the class-add and value-change coalesce into one paint and snap.
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
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
