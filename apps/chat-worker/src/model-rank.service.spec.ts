import {
  filterAllowlistedPrices,
  isAllowlistedGeminiId,
  isAllowlistedOpenAiId,
} from './model-rank.service';
import {
  DEFAULT_GEMINI_RANK,
  DEFAULT_OPENAI_RANK,
  SEED_GEMINI_INPUT_USD,
  SEED_OPENAI_INPUT_USD,
} from './model-rank.constants';

describe('model-rank allowlist', () => {
  it('allows only gemini-<digit> generative ids', () => {
    expect(isAllowlistedGeminiId('gemini-2.5-flash-lite')).toBe(true);
    expect(isAllowlistedGeminiId('gemini-embedding-001')).toBe(false);
    expect(isAllowlistedGeminiId('text-bison')).toBe(false);
    expect(isAllowlistedGeminiId('gemini-imagen-3')).toBe(false);
  });

  it('allows only gpt- text-generation ids', () => {
    expect(isAllowlistedOpenAiId('gpt-5-nano')).toBe(true);
    expect(isAllowlistedOpenAiId('gpt-4o-mini')).toBe(true);
    expect(isAllowlistedOpenAiId('o1-mini')).toBe(false);
    expect(isAllowlistedOpenAiId('text-embedding-3-small')).toBe(false);
    expect(isAllowlistedOpenAiId('gpt-4o-realtime-preview')).toBe(false);
  });

  it('never promotes non-allowlisted scraped prices into the map', () => {
    expect(
      filterAllowlistedPrices(
        {
          'gemini-2.5-flash-lite': 0.1,
          'gemini-embedding-001': 0.01,
          'evil-model': 0.001,
        },
        isAllowlistedGeminiId,
      ),
    ).toEqual({ 'gemini-2.5-flash-lite': 0.1 });

    expect(
      filterAllowlistedPrices(
        {
          'gpt-5-nano': 0.05,
          'o1-mini': 0.02,
          'whisper-1': 0.01,
        },
        isAllowlistedOpenAiId,
      ),
    ).toEqual({ 'gpt-5-nano': 0.05 });
  });

  it('keeps static seed prices as the scrape-failure fallback set', () => {
    for (const id of DEFAULT_GEMINI_RANK) {
      expect(SEED_GEMINI_INPUT_USD[id]).toEqual(expect.any(Number));
      expect(isAllowlistedGeminiId(id)).toBe(true);
    }
    for (const id of DEFAULT_OPENAI_RANK) {
      expect(SEED_OPENAI_INPUT_USD[id]).toEqual(expect.any(Number));
      expect(isAllowlistedOpenAiId(id)).toBe(true);
    }
  });
});
