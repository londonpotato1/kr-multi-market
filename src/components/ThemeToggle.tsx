import { useEffect, useState, useCallback } from 'react';

const VALID_THEMES = ['light', 'dark', 'system'] as const;
type Theme = typeof VALID_THEMES[number];
const STORAGE_KEY = 'kr-mm:theme';

function isValidTheme(v: unknown): v is Theme {
  return typeof v === 'string' && (VALID_THEMES as readonly string[]).includes(v);
}

function safeReadTheme(): Theme {
  try {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    return isValidTheme(v) ? v : 'system';
  } catch {
    return 'system';
  }
}

function safeWriteTheme(t: Theme): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (t === 'system') {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, t);
    }
  } catch {
    // private browsing / quota — silently swallow per Codex feedback
  }
}

function getSystemPreference(): 'light' | 'dark' {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function resolveTheme(t: Theme): 'light' | 'dark' {
  return t === 'system' ? getSystemPreference() : t;
}

function applyTheme(t: 'light' | 'dark') {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', t);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(safeReadTheme);

  useEffect(() => {
    applyTheme(resolveTheme(theme));
    safeWriteTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (theme !== 'system') return;
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = () => applyTheme(getSystemPreference());
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const cycle = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : prev === 'light' ? 'system' : 'dark'));
  }, []);

  const icon = theme === 'dark' ? '☾' : theme === 'light' ? '☀' : '◑';
  const label = theme === 'dark' ? 'Dark' : theme === 'light' ? 'Light' : 'System';

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={cycle}
      title={`Theme: ${label} (click to cycle dark → light → system)`}
      aria-label={`Toggle theme. Current: ${label}`}
    >
      <span className="theme-icon" aria-hidden>{icon}</span>
      <span className="theme-label">{label}</span>
    </button>
  );
}
