/** Redis keys for cheapest-model ranking (JSON string arrays + ISO timestamp). */
export const MODEL_RANK_GEMINI_KEY = 'models:rank:gemini';
export const MODEL_RANK_OPENAI_KEY = 'models:rank:openai';
export const MODEL_RANK_UPDATED_AT_KEY = 'models:rank:updatedAt';

/** Hardcoded cheapest defaults when Redis empty and refresh fails (verified via pricing search). */
export const DEFAULT_GEMINI_RANK = [
  'gemini-2.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
] as const;

export const DEFAULT_OPENAI_RANK = [
  'gpt-5-nano',
  'gpt-4.1-nano',
  'gpt-4o-mini',
] as const;

/** Seed input $/1M for ranking when live parse misses a model. */
export const SEED_GEMINI_INPUT_USD: Record<string, number> = {
  'gemini-2.5-flash-lite': 0.1,
  'gemini-3.1-flash-lite': 0.25,
  'gemini-3.5-flash-lite': 0.3,
  'gemini-2.5-flash': 0.3,
  'gemini-3-flash': 0.5,
  'gemini-3-flash-preview': 0.5,
  'gemini-3.6-flash': 0.75,
  'gemini-3.7-flash': 0.75,
  'gemini-3.5-flash': 1.5,
  'gemini-2.5-pro': 1.25,
  'gemini-3.1-pro': 2.0,
};

export const SEED_OPENAI_INPUT_USD: Record<string, number> = {
  'gpt-5-nano': 0.05,
  'gpt-4.1-nano': 0.1,
  'gpt-4o-mini': 0.15,
  'gpt-5.6-luna': 0.2,
  'gpt-5-mini': 0.25,
  'gpt-4.1-mini': 0.4,
  'gpt-5': 1.25,
  'gpt-4.1': 2.0,
  'gpt-4o': 2.5,
};

export const MODEL_RANK_TOP_N = 3;

export const PRICING_PAGES = [
  'https://ai.google.dev/gemini-api/docs/pricing',
  'https://openai.com/api/pricing/',
  'https://developers.openai.com/api/docs/pricing',
] as const;

export const WEB_SEARCH_QUERIES = [
  'cheapest Gemini API Flash-Lite pricing per million tokens',
  'cheapest OpenAI API nano mini models pricing',
] as const;
