import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { en } from './catalogs/en';
import { es } from './catalogs/es';
import { zh } from './catalogs/zh';
import { hi } from './catalogs/hi';
import { ar } from './catalogs/ar';

export const LOCALES = ['en', 'es', 'zh', 'hi', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_STORAGE_KEY = 'locale';

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  zh: '中文',
  hi: 'हिन्दी',
  ar: 'العربية',
};

// en is the source of truth: every key above exists here, so a key missing
// from the active catalog always falls back to English, never the raw key.
const CATALOGS: Record<Locale, Record<string, string>> = { en, es, zh, hi, ar };

type TranslateParams = Record<string, string | number>;

function isLocale(value: string | null): value is Locale {
  return value !== null && (LOCALES as readonly string[]).includes(value);
}

function readStoredLocale(): Locale | null {
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(raw) ? raw : null;
  } catch {
    return null;
  }
}

function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: TranslateParams) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * Locale resolution: user override (localStorage) → company default
 * (Company.defaultLanguage, when available in UI data) → 'en'.
 */
export function I18nProvider({
  companyDefault,
  children,
}: {
  companyDefault?: string | null;
  children: ReactNode;
}) {
  const [override, setOverride] = useState<Locale | null>(() =>
    readStoredLocale(),
  );

  const companyLocale = isLocale(companyDefault ?? null)
    ? (companyDefault as Locale)
    : null;
  const locale = override ?? companyLocale ?? 'en';

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setOverride(next);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // ignore storage failures
    }
  }, []);

  const t = useMemo(() => {
    const catalog = CATALOGS[locale];
    const fallback = CATALOGS.en;
    return (key: string, params?: TranslateParams) => {
      const template = catalog[key] ?? fallback[key];
      return interpolate(template ?? '', params);
    };
  }, [locale]);

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return ctx;
}
