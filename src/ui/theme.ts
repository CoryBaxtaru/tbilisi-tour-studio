// Light/dark theme. "Systeem" follows prefers-color-scheme (pure CSS, no flash); "Licht"/"Donker" set
// data-theme on <html>. The choice is a per-device convenience in localStorage, so it is never synced.
import { useEffect, useState } from 'preact/hooks';

export type ThemeChoice = 'systeem' | 'licht' | 'donker';

const KEY = 'weergave';
const THEME_COLOR = { light: '#EFE8DA', dark: '#1F1D1B' };
const listeners = new Set<() => void>();
const media = () => (typeof matchMedia === 'undefined' ? null : matchMedia('(prefers-color-scheme: dark)'));

export function getThemeChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'licht' || v === 'donker') return v;
  } catch { /* storage unavailable: follow the system */ }
  return 'systeem';
}

export function isDark(choice = getThemeChoice()): boolean {
  return choice === 'donker' || (choice === 'systeem' && !!media()?.matches);
}

/** Applies the choice to <html> and the browser's toolbar colour. Call once before the first render. */
export function applyTheme(choice = getThemeChoice()): void {
  const el = document.documentElement;
  if (choice === 'systeem') delete el.dataset.theme;
  else el.dataset.theme = choice === 'donker' ? 'dark' : 'light';
  // index.html has one theme-color per colour scheme; with a forced theme both take the forced colour.
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    const forDark = m.getAttribute('media')?.includes('dark') ?? false;
    const dark = choice === 'systeem' ? forDark : choice === 'donker';
    m.setAttribute('content', dark ? THEME_COLOR.dark : THEME_COLOR.light);
  });
}

export function setThemeChoice(choice: ThemeChoice): void {
  try {
    if (choice === 'systeem') localStorage.removeItem(KEY); else localStorage.setItem(KEY, choice);
  } catch { /* not remembered, still applied */ }
  applyTheme(choice);
  listeners.forEach((l) => l());
}

/** Current choice and whether the app is dark right now; re-renders when either changes. */
export function useTheme(): { choice: ThemeChoice; dark: boolean } {
  const [, force] = useState(0);
  useEffect(() => {
    const update = () => { applyTheme(); force((n) => n + 1); };
    listeners.add(update);
    const m = media();
    m?.addEventListener('change', update);
    return () => { listeners.delete(update); m?.removeEventListener('change', update); };
  }, []);
  const choice = getThemeChoice();
  return { choice, dark: isDark(choice) };
}
