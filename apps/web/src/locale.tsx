import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { detectLocale, formatLocaleDate, isLocale, translate, type Locale } from '@shared/auth';
import { apiFetch } from './api';

type LocaleContextValue = { locale: Locale; setLocale: (locale: Locale) => Promise<void>; t: (value: string) => string; formatDate: (value: string | Date) => string };
const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children, initialLocale }: { children: ReactNode; initialLocale?: Locale | null }) {
  const [locale, setCurrent] = useState<Locale>(initialLocale && isLocale(initialLocale) ? initialLocale : detectLocale());
  useEffect(() => { if (initialLocale && isLocale(initialLocale)) setCurrent(initialLocale); }, [initialLocale]);
  async function setLocale(next: Locale) {
    const previous = locale;
    setCurrent(next);
    try { await apiFetch('/auth/locale', { method: 'PATCH', body: JSON.stringify({ locale: next }) }); }
    catch (error) { setCurrent(previous); throw error; }
  }
  const value = useMemo(() => ({ locale, setLocale, t: (value: string) => translate(value, locale), formatDate: (value: string | Date) => formatLocaleDate(value, locale) }), [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (!value) throw new Error('useLocale must be used within LocaleProvider');
  return value;
}
