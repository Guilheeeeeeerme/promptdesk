import {
  DEFAULT_LOCALE,
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  detectLocale,
  isLocale,
  localeDirection,
  translate,
} from '../../../shared/auth/index.js';
import {
  SUPPORTED_LOCALES as API_SUPPORTED_LOCALES,
  isSupportedLocale,
  parseSupportedLocale,
  toSupportedLocale,
} from './supported-locales';

describe('supported locales contract', () => {
  it('exposes the 10 most spoken languages in the world', () => {
    expect([...SUPPORTED_LOCALES]).toEqual([
      'en-US', // English
      'zh-CN', // Mandarin Chinese
      'hi-IN', // Hindi
      'es-ES', // Spanish
      'fr-FR', // French
      'ar-SA', // Arabic
      'bn-BD', // Bengali
      'pt-BR', // Portuguese
      'ru-RU', // Russian
      'ur-PK', // Urdu
    ]);
  });

  it('keeps the API locale list in sync with the shared client list', () => {
    expect([...API_SUPPORTED_LOCALES]).toEqual([...SUPPORTED_LOCALES]);
  });
});

describe('detectLocale fallback chain (browser → English)', () => {
  it('returns English when nothing matches', () => {
    expect(detectLocale([])).toBe('en-US');
    expect(detectLocale(['ja-JP', 'de-DE'])).toBe('en-US');
    expect(detectLocale([''])).toBe('en-US');
  });

  it('prefers the first browser language with an exact supported tag', () => {
    expect(detectLocale(['pt-BR', 'en-US'])).toBe('pt-BR');
    expect(detectLocale(['pt-br'])).toBe('pt-BR');
    expect(detectLocale(['en-US', 'pt-BR'])).toBe('en-US');
    expect(detectLocale(['zh-CN', 'en'])).toBe('zh-CN');
  });

  it('maps language variants to the closest supported locale', () => {
    expect(detectLocale(['pt-PT'])).toBe('pt-BR');
    expect(detectLocale(['es-MX'])).toBe('es-ES');
    expect(detectLocale(['es'])).toBe('es-ES');
    expect(detectLocale(['zh-TW', 'en'])).toBe('zh-CN');
    expect(detectLocale(['fr-CA'])).toBe('fr-FR');
    expect(detectLocale(['ar-EG'])).toBe('ar-SA');
    expect(detectLocale(['bn-IN'])).toBe('bn-BD');
    expect(detectLocale(['hi-IN'])).toBe('hi-IN');
    expect(detectLocale(['ru-RU'])).toBe('ru-RU');
    expect(detectLocale(['ur-PK'])).toBe('ur-PK');
  });

  it('skips unsupported entries and falls back to the next supported one', () => {
    expect(detectLocale(['ja-JP', 'pt-BR'])).toBe('pt-BR');
    expect(detectLocale(['ko', 'fr-FR'])).toBe('fr-FR');
  });
});

describe('locale helpers', () => {
  it('validates locales strictly', () => {
    expect(isLocale('pt-BR')).toBe(true);
    expect(isLocale('ur-PK')).toBe(true);
    expect(isLocale('xx-XX')).toBe(false);
    expect(isLocale('pt')).toBe(false);
  });

  it('marks Arabic and Urdu as right-to-left', () => {
    expect(localeDirection('ar-SA')).toBe('rtl');
    expect(localeDirection('ur-PK')).toBe('rtl');
    for (const locale of SUPPORTED_LOCALES) {
      if (locale !== 'ar-SA' && locale !== 'ur-PK') {
        expect(localeDirection(locale)).toBe('ltr');
      }
    }
  });

  it('has a native label and real translations for every locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(LOCALE_LABELS[locale].length).toBeGreaterThan(0);
      if (locale === DEFAULT_LOCALE) continue;
      expect(translate('Language', locale)).not.toBe('Language');
      expect(translate('Log out', locale)).not.toBe('Log out');
      expect(translate('AI Support Assistant', locale)).not.toBe(
        'AI Support Assistant',
      );
    }
    expect(translate('Language', 'en-US')).toBe('Language');
  });
});

describe('api locale parsing', () => {
  it('parses known locales and rejects unknown ones', () => {
    expect(parseSupportedLocale('pt-BR')).toBe('pt-BR');
    expect(parseSupportedLocale('xx-XX')).toBeNull();
    expect(parseSupportedLocale(null)).toBeNull();
    expect(parseSupportedLocale(undefined)).toBeNull();
    expect(toSupportedLocale('zh-CN')).toBe('zh-CN');
    expect(toSupportedLocale('bogus')).toBe(DEFAULT_LOCALE);
    expect(isSupportedLocale('ur-PK')).toBe(true);
    expect(isSupportedLocale('pt')).toBe(false);
  });
});
