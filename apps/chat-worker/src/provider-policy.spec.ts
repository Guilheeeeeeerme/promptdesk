import {
  createGeminiGuidelineProvider,
  resolveProviderOrder,
  type GuidelineModelProvider,
} from './provider-policy';
import { LlmBudgetExceededError } from './llm-budget';

function provider(
  implementation: (content: string, model?: string) => Promise<unknown>,
): GuidelineModelProvider {
  return { validateGuideline: implementation };
}

describe('pinned Gemini guideline provider', () => {
  it('calls the pinned model once', async () => {
    const calls: string[] = [];
    const selected = createGeminiGuidelineProvider(
      provider(async (_, model) => {
        calls.push(`gemini:${model}`);
        return { status: 'valid' };
      }),
      'gemini-2.5-flash-lite',
    );

    const result = await selected.validateGuideline('policy');

    expect(result).toEqual({ status: 'valid' });
    expect(calls).toEqual(['gemini:gemini-2.5-flash-lite']);
  });

  it('halts when the company LLM budget is exceeded', async () => {
    const calls: string[] = [];
    const selected = createGeminiGuidelineProvider(
      provider(async (_, model) => {
        calls.push(`gemini:${model}`);
        throw new LlmBudgetExceededError('budget_exceeded', 'company-1');
      }),
      'gemini-2.5-flash-lite',
    );

    await expect(selected.validateGuideline('policy')).rejects.toBeInstanceOf(
      LlmBudgetExceededError,
    );
    expect(calls).toEqual(['gemini:gemini-2.5-flash-lite']);
  });

  it('wraps a provider failure with the pinned model name', async () => {
    const selected = createGeminiGuidelineProvider(
      provider(async () => {
        throw new Error('Gemini unavailable');
      }),
      'gemini-2.5-flash-lite',
    );

    await expect(selected.validateGuideline('policy')).rejects.toThrow(
      /Gemini gemini-2.5-flash-lite: Gemini unavailable/,
    );
  });
});

describe('resolveProviderOrder', () => {
  it('is gemini only, even if a leftover order names openai', () => {
    expect(resolveProviderOrder(undefined, { gemini: true, openai: true })).toEqual([
      'gemini',
    ]);
    expect(resolveProviderOrder('openai,gemini', { gemini: true, openai: true })).toEqual([
      'gemini',
    ]);
    expect(resolveProviderOrder(undefined, { gemini: false })).toEqual([]);
  });
});
