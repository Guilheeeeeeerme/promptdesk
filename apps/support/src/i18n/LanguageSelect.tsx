import { LOCALES, LOCALE_LABELS, useI18n, type Locale } from './index';

export function LanguageSelect() {
  const { locale, setLocale, t } = useI18n();

  return (
    <select
      aria-label={t('common.language')}
      value={locale}
      onChange={(e) => setLocale(e.currentTarget.value as Locale)}
      className="rounded-md border-gray-300 shadow-sm text-sm py-1.5 bg-white text-gray-900 focus:border-indigo-500 focus:ring-indigo-500"
    >
      {LOCALES.map((code) => (
        <option key={code} value={code}>
          {LOCALE_LABELS[code]}
        </option>
      ))}
    </select>
  );
}
