export const SUPPORTED_LANGUAGES = ['en', 'es', 'zh', 'hi', 'ar'] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
