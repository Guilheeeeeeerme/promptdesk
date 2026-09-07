/** The 10 most spoken languages in the world (by total speakers). */
export const SUPPORTED_LOCALES = [
  'en-US',
  'zh-CN',
  'hi-IN',
  'es-ES',
  'fr-FR',
  'ar-SA',
  'bn-BD',
  'pt-BR',
  'ru-RU',
  'ur-PK',
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'en-US';

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly unknown[]).includes(value);
}

/** `SupportedLocale` when `value` is in the list, `null` otherwise. */
export function parseSupportedLocale(
  value: string | null | undefined,
): SupportedLocale | null {
  return isSupportedLocale(value) ? value : null;
}

/** `SupportedLocale` when `value` is in the list, English otherwise. */
export function toSupportedLocale(
  value: string | null | undefined,
): SupportedLocale {
  return parseSupportedLocale(value) ?? DEFAULT_LOCALE;
}
