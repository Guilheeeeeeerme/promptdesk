import { useSyncExternalStore } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'theme';

const systemDarkQuery = window.matchMedia('(prefers-color-scheme: dark)');

function readStoredPreference(): ThemePreference {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'light' || stored === 'dark' || stored === 'system'
    ? stored
    : 'system';
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference !== 'system') {
    return preference;
  }
  return systemDarkQuery.matches ? 'dark' : 'light';
}

function applyTheme(preference: ThemePreference): ResolvedTheme {
  const resolved = resolveTheme(preference);
  document.documentElement.classList.toggle('dark', resolved === 'dark');
  document.documentElement.style.colorScheme = resolved;
  return resolved;
}

let preference = readStoredPreference();
let resolved = applyTheme(preference);

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

systemDarkQuery.addEventListener('change', () => {
  const next = applyTheme(preference);
  if (next !== resolved) {
    resolved = next;
    notify();
  }
});

export function initTheme(): ResolvedTheme {
  return applyTheme(preference);
}

export function setThemePreference(next: ThemePreference): void {
  preference = next;
  localStorage.setItem(THEME_STORAGE_KEY, next);
  resolved = applyTheme(next);
  notify();
}

export function nextThemePreference(
  current: ThemePreference,
): ThemePreference {
  if (current === 'system') return 'light';
  return current === 'light' ? 'dark' : 'system';
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useTheme(): {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (next: ThemePreference) => void;
} {
  const currentPreference = useSyncExternalStore(subscribe, () => preference);
  const currentResolved = useSyncExternalStore(subscribe, () => resolved);
  return {
    preference: currentPreference,
    resolved: currentResolved,
    setPreference: setThemePreference,
  };
}
