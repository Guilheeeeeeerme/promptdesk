import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';

/** Dark-only theme — Linear UI requires primary surfaces with lightness < 20. */
export type Theme = 'dark';

interface ThemeContextValue {
  theme: Theme;
  resolved: 'dark';
  setTheme: (theme: Theme) => void;
}

const STORAGE_KEY = 'promptdesk-theme';
const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyDark() {
  document.documentElement.dataset.theme = 'dark';
  try {
    localStorage.setItem(STORAGE_KEY, 'dark');
  } catch {
    // ignore
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    applyDark();
  }, []);

  const setTheme = useCallback((_next: Theme) => {
    applyDark();
  }, []);

  const value = useMemo(
    () =>
      ({
        theme: 'dark' as const,
        resolved: 'dark' as const,
        setTheme,
      }),
    [setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
