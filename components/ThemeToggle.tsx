'use client';

import { useSyncExternalStore } from 'react';
import { Sun, Moon } from 'lucide-react';

type Theme = 'dark' | 'light';

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

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, () => 'dark');

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    window.dispatchEvent(new Event('theme-change'));
  };

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      className="fixed bottom-5 right-5 z-50 p-2.5 rounded-full border transition-all duration-200 ease-out shadow-lg hover:scale-105 active:scale-95"
      style={{
        background: theme === 'dark' ? 'var(--bg-surface)' : 'var(--bg-primary)',
        borderColor: 'var(--border-subtle)',
        color: 'var(--text-primary)',
      }}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
